import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StepWrapProps {
  amount: number;
  busy: boolean;
  onWrap: () => void;
}

export function StepWrap({ amount, busy, onWrap }: StepWrapProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        First, wrap public USDC into confidential cUSDC. Balance becomes a shielded handle.
      </p>
      <div className="rounded-md border border-border bg-secondary/40 p-4 flex items-center justify-between">
        <span className="text-sm">USDC → cUSDC</span>
        <span className="font-display text-xl text-forest">
          ${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
      </div>
      <Button onClick={onWrap} disabled={busy} className="bg-forest hover:bg-forest/90 w-full">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Wrap to cUSDC"}
      </Button>
    </div>
  );
}
