import { Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StepPendingProps {
  busy: boolean;
  onFinalize: () => void; // refresh callback — re-reads chain state to advance
}

export function StepPending({ busy, onFinalize }: StepPendingProps) {
  return (
    <div className="space-y-4 text-center py-8">
      <Loader2 className="h-8 w-8 animate-spin text-forest mx-auto" />
      <h3 className="font-display text-xl text-forest">Awaiting operator processing</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        Your encrypted deposit was submitted. The vault operator will move it from pending to claimable shortly. The screen advances automatically when the chain state updates.
      </p>
      <Button onClick={onFinalize} disabled={busy} variant="outline">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
        Refresh now
      </Button>
    </div>
  );
}
