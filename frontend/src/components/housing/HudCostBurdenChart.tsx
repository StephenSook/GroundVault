import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { fetchCostBurden, type CostBurdenBreakdown } from "@/lib/api/hud";

interface Bar {
  label: string;
  pct: number;
  color: string;
}

function buildBars(d: CostBurdenBreakdown): Bar[] {
  return [
    { label: "Severely Cost Burdened (>50% income)", pct: d.severelyBurdenedPct, color: "hsl(0 55% 40%)" },
    { label: "Cost Burdened (30-50% income)", pct: d.costBurdenedPct, color: "hsl(var(--sage))" },
    { label: "Not Cost Burdened", pct: d.notBurdenedPct, color: "hsl(var(--forest))" },
  ];
}

export function HudCostBurdenChart() {
  const [data, setData] = useState<CostBurdenBreakdown | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchCostBurden("13121"); // Fulton County GA
      if (!cancelled) setData(result);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading HUD CHAS data…
      </div>
    );
  }

  const bars = buildBars(data);

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl text-forest">Fulton County Cost Burden</h3>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {data.source === "live" ? "live · HUD CHAS" : "cached snapshot"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1 mb-5">
        HUD CHAS data context for households earning ≤80% AMI.
      </p>
      <div className="space-y-4">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="flex justify-between text-xs mb-1.5">
              <span>{b.label}</span>
              <span className="font-medium">{b.pct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${b.pct}%`, backgroundColor: b.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
