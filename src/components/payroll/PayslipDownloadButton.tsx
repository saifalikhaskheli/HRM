import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PayslipDownloadButtonProps {
  entryId: string;
  employeeName?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function PayslipDownloadButton({ 
  entryId, 
  employeeName,
  variant = 'outline',
  size = 'sm'
}: PayslipDownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-payslip', {
        body: { payroll_entry_id: entryId },
      });

      if (error) throw error;

      if (data?.html) {
        // Create a Blob with the HTML content
        const blob = new Blob([data.html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename || `payslip_${entryId}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast.success('Payslip downloaded successfully');
      }
    } catch (error) {
      console.error('Error downloading payslip:', error);
      toast.error('Failed to generate payslip');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleDownload}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : size === 'icon' ? (
        <FileText className="h-4 w-4" />
      ) : (
        <>
          <Download className="h-4 w-4 mr-2" />
          Payslip
        </>
      )}
    </Button>
  );
}
