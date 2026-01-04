import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, Loader2, Plus, Clock, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MultiCompanyRequestDialogProps {
  trigger?: React.ReactNode;
}

export function MultiCompanyRequestDialog({ trigger }: MultiCompanyRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const [requestedCount, setRequestedCount] = useState("2");
  const [reason, setReason] = useState("");
  const { user } = useAuth();
  

  const currentMax = user?.max_companies ?? 1;
  const currentCompanyCount = user?.companies?.length ?? 0;

  // Check for existing pending request
  const { data: pendingRequest, refetch: refetchPending } = useQuery({
    queryKey: ["multi-company-request-pending", user?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("multi_company_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.user_id,
  });

  const submitRequest = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("request-multi-company", {
        body: {
          requested_count: parseInt(requestedCount),
          reason: reason.trim(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Your request has been submitted. Platform administrators will review it shortly.");
      setReason("");
      setOpen(false);
      refetchPending();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 10) {
      toast.error("Please provide a reason with at least 10 characters.");
      return;
    }
    submitRequest.mutate();
  };

  // Show pending status if there's a pending request
  if (pendingRequest) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Multi-company request pending review</span>
        <Badge variant="secondary">Requested: {pendingRequest.requested_count}</Badge>
      </div>
    );
  }

  // Don't show if user already has multi-company access
  if (currentMax > 1 && currentCompanyCount < currentMax) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <span>You can join up to {currentMax} companies ({currentMax - currentCompanyCount} slots available)</span>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Request Multi-Company Access
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Request Multi-Company Access
            </DialogTitle>
            <DialogDescription>
              By default, each account can belong to 1 company. Submit a request to join or create additional companies.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Current Status</Label>
              <div className="text-sm text-muted-foreground">
                You currently belong to <strong>{currentCompanyCount}</strong> company(ies) 
                with a limit of <strong>{currentMax}</strong>.
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requested-count">How many companies do you need access to?</Label>
              <Select value={requestedCount} onValueChange={setRequestedCount}>
                <SelectTrigger id="requested-count">
                  <SelectValue placeholder="Select number" />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 10, 20].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} companies
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">
                Why do you need multi-company access? <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reason"
                placeholder="Please explain your use case. For example: I'm a consultant working with multiple clients, I manage HR for multiple subsidiaries, etc."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Minimum 10 characters. This helps platform administrators understand your needs.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitRequest.isPending || reason.trim().length < 10}>
              {submitRequest.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
