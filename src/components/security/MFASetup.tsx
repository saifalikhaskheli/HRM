import { useState } from 'react';
import { useMFAStatus, useMFAEnrollment, useMFAEnforcement } from '@/hooks/useSecurity';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Smartphone, Check, AlertTriangle, Loader2, QrCode } from 'lucide-react';

interface MFASetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  required?: boolean;
}

export function MFASetupDialog({ open, onOpenChange, required = false }: MFASetupDialogProps) {
  const { enrollTOTP, verifyTOTP } = useMFAEnrollment();
  const [step, setStep] = useState<'intro' | 'qr' | 'verify' | 'success'>('intro');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');

  const handleStartEnrollment = async () => {
    const result = await enrollTOTP.mutateAsync();
    if (result) {
      setFactorId(result.id);
      setQrCode(result.totp.qr_code);
      setSecret(result.totp.secret);
      setStep('qr');
    }
  };

  const handleVerify = async () => {
    if (!factorId || !verifyCode) return;
    
    await verifyTOTP.mutateAsync({ factorId, code: verifyCode });
    setStep('success');
  };

  const handleClose = () => {
    if (!required || step === 'success') {
      setStep('intro');
      setFactorId(null);
      setQrCode(null);
      setSecret(null);
      setVerifyCode('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {step === 'success' ? 'MFA Enabled!' : 'Set Up Two-Factor Authentication'}
          </DialogTitle>
          <DialogDescription>
            {step === 'intro' && 'Add an extra layer of security to your account using an authenticator app.'}
            {step === 'qr' && 'Scan this QR code with your authenticator app.'}
            {step === 'verify' && 'Enter the 6-digit code from your authenticator app.'}
            {step === 'success' && 'Your account is now protected with two-factor authentication.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'intro' && (
          <div className="space-y-4">
            {required && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  As an administrator, you are required to enable MFA for security.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex items-start gap-4 p-4 border rounded-lg">
              <Smartphone className="h-8 w-8 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium">Authenticator App</p>
                <p className="text-sm text-muted-foreground">
                  Use apps like Google Authenticator, Authy, or 1Password to generate verification codes.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 'qr' && qrCode && (
          <div className="space-y-4">
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <img src={qrCode} alt="QR Code" className="w-48 h-48" />
            </div>
            {secret && (
              <div className="space-y-2">
                <Label>Or enter this code manually:</Label>
                <code className="block p-2 bg-muted rounded text-sm font-mono break-all">
                  {secret}
                </code>
              </div>
            )}
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verify-code">Verification Code</Label>
              <Input
                id="verify-code"
                placeholder="000000"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-widest"
                maxLength={6}
              />
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-muted-foreground">
              You'll need your authenticator app each time you sign in.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'intro' && (
            <Button onClick={handleStartEnrollment} disabled={enrollTOTP.isPending}>
              {enrollTOTP.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                'Get Started'
              )}
            </Button>
          )}
          {step === 'qr' && (
            <Button onClick={() => setStep('verify')}>
              Continue
            </Button>
          )}
          {step === 'verify' && (
            <Button 
              onClick={handleVerify} 
              disabled={verifyCode.length !== 6 || verifyTOTP.isPending}
            >
              {verifyTOTP.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify & Enable'
              )}
            </Button>
          )}
          {step === 'success' && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Card component showing MFA status and setup option
 */
export function MFAStatusCard() {
  const { data: mfaStatus, isLoading } = useMFAStatus();
  const { mustEnrollMFA } = useMFAEnforcement();
  const { unenroll } = useMFAEnrollment();
  const [setupOpen, setSetupOpen] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Protect your account with an additional verification step
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>Status:</span>
              {mfaStatus?.isVerified ? (
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <Check className="h-3 w-3 mr-1" />
                  Enabled
                </Badge>
              ) : (
                <Badge variant="secondary">Not Enabled</Badge>
              )}
            </div>
          </div>

          {mustEnrollMFA && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                MFA is required for administrators. Please enable it now.
              </AlertDescription>
            </Alert>
          )}

          {mfaStatus?.isVerified ? (
            <Button 
              variant="outline" 
              onClick={() => {
                if (mfaStatus.verifiedFactors[0]) {
                  unenroll.mutate(mfaStatus.verifiedFactors[0].id);
                }
              }}
              disabled={unenroll.isPending}
            >
              {unenroll.isPending ? 'Disabling...' : 'Disable MFA'}
            </Button>
          ) : (
            <Button onClick={() => setSetupOpen(true)}>
              <QrCode className="h-4 w-4 mr-2" />
              Enable MFA
            </Button>
          )}
        </CardContent>
      </Card>

      <MFASetupDialog 
        open={setupOpen || mustEnrollMFA} 
        onOpenChange={setSetupOpen}
        required={mustEnrollMFA}
      />
    </>
  );
}
