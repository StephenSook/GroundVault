import { CheckCircle2, Heart, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StepClaimProps {
  amount: number;
  rwaId?: string;
  address?: string;
  /** Property list price in dollars — for the impact-share calc. */
  listPriceUsd?: number;
  onClaim: () => void;
  onReset: () => void;
}

export function StepClaim({
  amount,
  rwaId,
  address,
  listPriceUsd,
  onClaim,
  onReset,
}: StepClaimProps) {
  const target = rwaId && address
    ? `${rwaId} (${address})`
    : rwaId ?? address ?? "the active opportunity";

  // Share of the property the user's deposit covers. cUSDC is 1:1
  // with USD by design (it wraps mUSDC at 6 decimals against a
  // dollar-denominated mock token), so the percentage is just amount
  // / listPrice. A 50 cUSDC contribution against a $250,000 home is
  // 0.02% — a small number, but the framing is "you helped fund a
  // permanently affordable Atlanta home" rather than the absolute
  // share size.
  const sharePct =
    listPriceUsd && listPriceUsd > 0
      ? Math.max(((amount / listPriceUsd) * 100), 0)
      : null;
  const sharePctLabel =
    sharePct !== null
      ? sharePct >= 0.01
        ? `${sharePct.toFixed(2)}%`
        : `${(sharePct * 100).toFixed(1)} bps`
      : null;

  return (
    <div className="space-y-4 text-center py-6">
      <CheckCircle2 className="h-10 w-10 text-sage mx-auto" />
      <h3 className="font-display text-2xl text-forest">Deposit confirmed</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        {amount.toLocaleString("en-US")} cUSDC has been committed to {target}. Claim your GVT shares.
      </p>

      {sharePctLabel && (
        <div className="rounded-lg border border-sage/40 bg-sage/10 px-5 py-4 max-w-md mx-auto text-left">
          <div className="flex items-start gap-3">
            <Home className="h-5 w-5 text-forest mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs uppercase tracking-widest text-forest/70 font-semibold">
                Your impact share
              </div>
              <div className="font-display text-lg text-forest mt-1">
                {sharePctLabel} of {address ?? "this acquisition"}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                Pooled with other GroundVault investors, this commits real capital
                to permanent affordability for an Atlanta Community Land Trust
                family. The covenant on the deed prevents speculative resale.
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-sage mt-2">
                <Heart className="h-3 w-3" />
                <span>Funds locked into a CLT acquisition, not a yield product.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 pt-2">
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
