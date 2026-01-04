import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Landmark, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export interface BankDetails {
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  account_holder?: string;
}

interface BankDetailsSectionProps {
  value: BankDetails;
  onChange: (value: BankDetails) => void;
  disabled?: boolean;
}

/**
 * Mask account number for display (show last 4 digits only)
 */
function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber || accountNumber.length <= 4) return accountNumber;
  return '•'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
}

export function BankDetailsSection({ value, onChange, disabled }: BankDetailsSectionProps) {
  const [showAccountNumber, setShowAccountNumber] = useState(false);

  const handleChange = (field: keyof BankDetails, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  const displayAccountNumber = showAccountNumber 
    ? value.account_number || '' 
    : maskAccountNumber(value.account_number || '');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Landmark className="h-4 w-4" />
          Bank Details
        </CardTitle>
        <CardDescription>Employee payment information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bank-name">Bank Name</Label>
            <Input
              id="bank-name"
              value={value.bank_name || ''}
              onChange={(e) => handleChange('bank_name', e.target.value)}
              placeholder="e.g., State Bank"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-holder">Account Holder Name</Label>
            <Input
              id="account-holder"
              value={value.account_holder || ''}
              onChange={(e) => handleChange('account_holder', e.target.value)}
              placeholder="Name as on bank account"
              disabled={disabled}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="account-number">Account Number</Label>
            <div className="relative">
              <Input
                id="account-number"
                type={showAccountNumber ? 'text' : 'text'}
                value={disabled ? displayAccountNumber : (value.account_number || '')}
                onChange={(e) => handleChange('account_number', e.target.value)}
                placeholder="Enter account number"
                disabled={disabled}
                className="pr-10"
              />
              {value.account_number && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowAccountNumber(!showAccountNumber)}
                >
                  {showAccountNumber ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ifsc-code">IFSC / Branch Code</Label>
            <Input
              id="ifsc-code"
              value={value.ifsc_code || ''}
              onChange={(e) => handleChange('ifsc_code', e.target.value.toUpperCase())}
              placeholder="e.g., SBIN0001234"
              disabled={disabled}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Utility to check if bank details are complete for payroll
 */
export function isBankDetailsComplete(bankDetails: BankDetails | null | undefined): boolean {
  if (!bankDetails) return false;
  return !!(bankDetails.bank_name && bankDetails.account_number && bankDetails.account_holder);
}
