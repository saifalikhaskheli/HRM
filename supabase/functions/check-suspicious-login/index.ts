import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { EmailService } from "../_shared/email/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckLoginRequest {
  userAgent: string;
  timestamp: string;
}

function parseUserAgent(userAgent: string): string {
  // Simple browser detection
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    const match = userAgent.match(/Chrome\/(\d+)/);
    return match ? `Chrome ${match[1]}` : 'Chrome';
  }
  if (userAgent.includes('Firefox')) {
    const match = userAgent.match(/Firefox\/(\d+)/);
    return match ? `Firefox ${match[1]}` : 'Firefox';
  }
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    const match = userAgent.match(/Version\/(\d+)/);
    return match ? `Safari ${match[1]}` : 'Safari';
  }
  if (userAgent.includes('Edg')) {
    const match = userAgent.match(/Edg\/(\d+)/);
    return match ? `Edge ${match[1]}` : 'Edge';
  }
  return 'Unknown Browser';
}

function parseOS(userAgent: string): string {
  if (userAgent.includes('Windows NT 10')) return 'Windows 10/11';
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac OS X')) {
    const match = userAgent.match(/Mac OS X (\d+[._]\d+)/);
    return match ? `macOS ${match[1].replace('_', '.')}` : 'macOS';
  }
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) {
    const match = userAgent.match(/Android (\d+)/);
    return match ? `Android ${match[1]}` : 'Android';
  }
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    const match = userAgent.match(/OS (\d+)/);
    return match ? `iOS ${match[1]}` : 'iOS';
  }
  return 'Unknown OS';
}

function getDeviceFingerprint(userAgent: string): string {
  // Create a simple fingerprint from the user agent
  const os = parseOS(userAgent);
  const browser = parseUserAgent(userAgent);
  return `${os} - ${browser}`;
}

function getDeviceName(userAgent: string): string {
  const os = parseOS(userAgent);
  const browser = parseUserAgent(userAgent);
  return `${browser} on ${os}`;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // User client for getting current user
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service client for querying all security events
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: CheckLoginRequest = await req.json();
    const currentUserAgent = body.userAgent;
    const currentFingerprint = getDeviceFingerprint(currentUserAgent);
    const currentBrowser = parseUserAgent(currentUserAgent);
    const currentOS = parseOS(currentUserAgent);
    const currentDeviceName = getDeviceName(currentUserAgent);

    console.log(`Checking login for user ${user.id} with fingerprint: ${currentFingerprint}`);

    // Get user profile for email
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('id', user.id)
      .single();

    if (!profile) {
      console.log('No profile found for user');
      return new Response(
        JSON.stringify({ suspicious: false, reason: 'No profile' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if device exists in trusted_devices table
    const { data: existingDevice } = await supabaseAdmin
      .from('trusted_devices')
      .select('id, is_trusted')
      .eq('user_id', user.id)
      .eq('device_fingerprint', currentFingerprint)
      .single();

    // Clear is_current flag from all devices for this user
    await supabaseAdmin
      .from('trusted_devices')
      .update({ is_current: false })
      .eq('user_id', user.id);

    if (existingDevice) {
      // Device exists - update last_used_at and set as current
      console.log('Known device found, updating last_used_at');
      await supabaseAdmin
        .from('trusted_devices')
        .update({
          last_used_at: new Date().toISOString(),
          is_current: true,
        })
        .eq('id', existingDevice.id);

      return new Response(
        JSON.stringify({ suspicious: false, reason: 'Known device' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get count of existing devices to determine if this is first login
    const { count: deviceCount } = await supabaseAdmin
      .from('trusted_devices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Add new device to trusted_devices
    console.log('Adding new device to trusted devices');
    await supabaseAdmin
      .from('trusted_devices')
      .insert({
        user_id: user.id,
        device_fingerprint: currentFingerprint,
        device_name: currentDeviceName,
        browser: currentBrowser,
        os: currentOS,
        is_current: true,
        is_trusted: true,
      });

    // If this is the first device, don't flag as suspicious
    if (!deviceCount || deviceCount === 0) {
      console.log('First device for user, not flagging as suspicious');
      return new Response(
        JSON.stringify({ suspicious: false, reason: 'First device' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // New device detected - flag as suspicious and send alert
    console.log('New device detected, sending security alert');

    const userName = profile.first_name || profile.email.split('@')[0];
    const loginTime = new Date().toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    // Log suspicious activity
    await supabaseAdmin.from('security_events').insert({
      event_type: 'suspicious_activity',
      user_id: user.id,
      description: 'Login from new device detected',
      user_agent: currentUserAgent,
      severity: 'medium',
      metadata: {
        reason: 'new_device',
        device_fingerprint: currentFingerprint,
        device_name: currentDeviceName,
      },
    });

    // Send email notification
    try {
      const emailService = new EmailService();
      const result = await emailService.send({
        template: 'suspicious_login',
        data: {
          userName,
          loginTime,
          browser: currentBrowser,
          location: 'Unknown (IP-based geolocation not enabled)',
          ipAddress: 'Hidden for privacy',
          reason: 'This login is from a new device we haven\'t seen before',
          secureAccountUrl: `${Deno.env.get('SITE_URL') || 'https://preview--hr-flow-platform.lovable.app'}/settings/security`,
        },
        to: { email: profile.email, name: userName },
      });

      console.log('Email send result:', result);
    } catch (emailError) {
      console.error('Failed to send suspicious login email:', emailError);
    }

    return new Response(
      JSON.stringify({ 
        suspicious: true, 
        reason: 'new_device',
        message: 'Login from new device detected'
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in check-suspicious-login:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
