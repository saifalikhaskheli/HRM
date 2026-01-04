import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  event_type: string;
  data: Record<string, unknown>;
  timestamp?: string;
}

// Generate HMAC signature for webhook verification
async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role to access webhooks
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: WebhookPayload = await req.json();
    
    if (!payload.event_type) {
      return new Response(
        JSON.stringify({ error: 'event_type is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add timestamp if not provided
    payload.timestamp = payload.timestamp || new Date().toISOString();

    console.log(`Processing webhook event: ${payload.event_type}`);

    // Find active webhooks subscribed to this event
    const { data: webhooks, error: webhooksError } = await supabase
      .from('webhooks')
      .select('*')
      .eq('is_active', true)
      .contains('events', [payload.event_type]);

    if (webhooksError) {
      console.error('Error fetching webhooks:', webhooksError);
      throw webhooksError;
    }

    if (!webhooks || webhooks.length === 0) {
      console.log(`No webhooks subscribed to event: ${payload.event_type}`);
      return new Response(
        JSON.stringify({ message: 'No webhooks to trigger', triggered: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${webhooks.length} webhook(s) for event: ${payload.event_type}`);

    const results = await Promise.allSettled(
      webhooks.map(async (webhook) => {
        const payloadString = JSON.stringify(payload);
        const signature = await generateSignature(payloadString, webhook.secret);
        const startTime = Date.now();

        let response: Response | null = null;
        let success = false;
        let errorMessage: string | null = null;
        let responseStatus: number | null = null;
        let responseBody: string | null = null;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), (webhook.timeout_seconds || 30) * 1000);

          response = await fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': signature,
              'X-Webhook-Event': payload.event_type,
              'X-Webhook-Timestamp': payload.timestamp!,
              ...(webhook.headers || {}),
            },
            body: payloadString,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          responseStatus = response.status;
          responseBody = await response.text();
          success = response.ok;

          if (!success) {
            errorMessage = `HTTP ${response.status}: ${responseBody.substring(0, 500)}`;
          }
        } catch (error: unknown) {
          const err = error instanceof Error ? error : new Error('Unknown error');
          errorMessage = err.name === 'AbortError' ? 'Request timeout' : err.message;
          console.error(`Webhook ${webhook.name} failed:`, errorMessage);
        }

        const durationMs = Date.now() - startTime;

        // Log the webhook call
        await supabase.from('webhook_logs').insert({
          webhook_id: webhook.id,
          event_type: payload.event_type,
          payload: payload,
          response_status: responseStatus,
          response_body: responseBody?.substring(0, 5000),
          duration_ms: durationMs,
          success,
          error_message: errorMessage,
        });

        // Update webhook stats
        await supabase
          .from('webhooks')
          .update({
            last_triggered_at: new Date().toISOString(),
            last_status: responseStatus,
            failure_count: success ? 0 : (webhook.failure_count || 0) + 1,
          })
          .eq('id', webhook.id);

        return { webhook_id: webhook.id, name: webhook.name, success, status: responseStatus };
      })
    );

    const summary = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return { webhook_id: webhooks[i].id, name: webhooks[i].name, success: false, error: 'Promise rejected' };
    });

    console.log('Webhook results:', JSON.stringify(summary));

    return new Response(
      JSON.stringify({ 
        message: 'Webhooks triggered',
        triggered: webhooks.length,
        results: summary,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-webhook function:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
