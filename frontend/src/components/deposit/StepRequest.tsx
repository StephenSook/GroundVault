import { ArrowRight, Home, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface StepRequestProps {
  amount: number;
  setAmount: (n: number) => void;
  busy: boolean;
  onSubmit: () => void;
}

export function StepRequest({ amount, setAmount, busy, onSubmit }: StepRequestProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-2xl text-forest">Funding: 960 Lawton St SW</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Select the amount of shielded cUSDC you wish to commit to this property.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 text-xs font-mono text-forest">
          <Home className="h-3 w-3" /> RWA-042
        </span>
      </div>

      <div className="rounded-md border border-border bg-secondary/30 p-5">
        <div className="flex items-baseline justify-between mb-4">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Deposit Amount</span>
          <div className="font-display">
            <span className="text-muted-foreground text-xl">$</span>
            <span className="text-4xl text-forest">{amount.toLocaleString("en-US")}</span>
            <span className="text-muted-foreground text-sm">.00</span>
          </div>
        </div>
        <Slider
          value={[amount]}
          min={1000}
          max={100000}
          step={500}
          onValueChange={(v) => setAmount(v[0])}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-2 font-mono">
          <span>$1,000</span>
          <span>$100,000</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs">
          <Shield className="h-3.5 w-3.5 text-sage" /> Privacy Proof
        </span>
        <Button onClick={onSubmit} disabled={busy} className="bg-forest hover:bg-forest/90">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <>Submit deposit <ArrowRight className="h-4 w-4" /></>
          )}
        </Button>
      </div>
    </div>
  );
}
