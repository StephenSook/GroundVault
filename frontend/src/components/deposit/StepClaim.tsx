import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StepClaimProps {
  amount: number;
  rwaId?: string;
  address?: string;
  onClaim: () => void;
  onReset: () => void;
}

export function StepClaim({ amount, rwaId, address, onClaim, onReset }: StepClaimProps) {
  const target = rwaId && address
    ? `${rwaId} (${address})`
    : rwaId ?? address ?? "the active opportunity";

  return (
    <div className="space-y-4 text-center py-6">
      <CheckCircle2 className="h-10 w-10 text-sage mx-auto" />
      <h3 className="font-display text-2xl text-forest">Deposit confirmed</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        {amount.toLocaleString("en-US")} cUSDC has been committed to {target}. Claim your GVT shares.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Button onClick={onClaim} className="bg-forest hover:bg-forest/90">
          Claim GVT shares
        </Button>
        <Button variant="outline" onClick={onReset}>
          New deposit
        </Button>
      </div>
    </div>
  );
}
