import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StepPendingProps {
  busy: boolean;
  onFinalize: () => void;
}

export function StepPending({ busy, onFinalize }: StepPendingProps) {
  return (
    <div className="space-y-4 text-center py-8">
      <Loader2 className="h-8 w-8 animate-spin text-forest mx-auto" />
      <h3 className="font-display text-xl text-forest">Awaiting on-chain settlement</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        Your encrypted deposit is being verified by the vault keeper. This typically takes one block.
      </p>
      <Button onClick={onFinalize} disabled={busy} className="bg-forest hover:bg-forest/90">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simulate settlement"}
      </Button>
    </div>
  );
}
