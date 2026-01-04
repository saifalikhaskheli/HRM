import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useCreatePayrollRun } from '@/hooks/usePayroll';
import { useLocalization, CURRENCY_CONFIG } from '@/contexts/LocalizationContext';

interface CreatePayrollRunDialogProps {
  onClose: () => void;
}

export function CreatePayrollRunDialog({ onClose }: CreatePayrollRunDialogProps) {
  const { settings } = useLocalization();
  const [formData, setFormData] = useState({
    name: '',
    period_start: '',
    period_end: '',
    pay_date: '',
    currency: settings.currency,
    notes: '',
    autoGenerateSummaries: true,
  });

  const createRun = useCreatePayrollRun();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRun.mutateAsync(formData);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Run Name</Label>
        <Input
          id="name"
          placeholder="e.g., January 2025 Payroll"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="period_start">Period Start</Label>
          <Input
            id="period_start"
            type="date"
            value={formData.period_start}
            onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="period_end">Period End</Label>
          <Input
            id="period_end"
            type="date"
            value={formData.period_end}
            onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pay_date">Pay Date</Label>
          <Input
            id="pay_date"
            type="date"
            value={formData.pay_date}
            onChange={(e) => setFormData({ ...formData, pay_date: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CURRENCY_CONFIG).map(([code, config]) => (
                <SelectItem key={code} value={code}>
                  {code} ({config.symbol})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div className="space-y-0.5">
          <Label htmlFor="auto-generate">Auto-generate Attendance Summaries</Label>
          <p className="text-xs text-muted-foreground">
            Automatically calculate attendance data from time entries and leave records
          </p>
        </div>
        <Switch
          id="auto-generate"
          checked={formData.autoGenerateSummaries}
          onCheckedChange={(checked) => setFormData({ ...formData, autoGenerateSummaries: checked })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input
          id="notes"
          placeholder="Any additional notes..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={createRun.isPending}>
          {createRun.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create Run
        </Button>
      </div>
    </form>
  );
}
