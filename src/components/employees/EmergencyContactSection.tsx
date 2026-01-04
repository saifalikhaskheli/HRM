import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Heart } from 'lucide-react';

export interface EmergencyContact {
  name?: string;
  relationship?: string;
  phone?: string;
  email?: string;
}

interface EmergencyContactSectionProps {
  value: EmergencyContact;
  onChange: (value: EmergencyContact) => void;
  disabled?: boolean;
}

export function EmergencyContactSection({ value, onChange, disabled }: EmergencyContactSectionProps) {
  const handleChange = (field: keyof EmergencyContact, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Heart className="h-4 w-4 text-red-500" />
          Emergency Contact
        </CardTitle>
        <CardDescription>Contact person in case of emergency</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="emergency-name">Contact Name</Label>
            <Input
              id="emergency-name"
              value={value.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., John Smith"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergency-relationship">Relationship</Label>
            <Input
              id="emergency-relationship"
              value={value.relationship || ''}
              onChange={(e) => handleChange('relationship', e.target.value)}
              placeholder="e.g., Spouse, Parent"
              disabled={disabled}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="emergency-phone">Phone Number</Label>
            <Input
              id="emergency-phone"
              type="tel"
              value={value.phone || ''}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+1 (555) 000-0000"
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergency-email">Email (Optional)</Label>
            <Input
              id="emergency-email"
              type="email"
              value={value.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="email@example.com"
              disabled={disabled}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
