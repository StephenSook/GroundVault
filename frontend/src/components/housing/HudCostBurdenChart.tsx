interface Bar {
  label: string;
  pct: number;
  color: string;
}

const BARS: Bar[] = [
  { label: "Severely Cost Burdened (>50% income)", pct: 42, color: "hsl(0 55% 40%)" },
  { label: "Cost Burdened (30-50% income)", pct: 28, color: "hsl(var(--sage))" },
  { label: "Not Cost Burdened", pct: 30, color: "hsl(var(--forest))" },
];

export function HudCostBurdenChart() {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="font-display text-xl text-forest">Fulton County Cost Burden</h3>
      <p className="text-xs text-muted-foreground mt-1 mb-5">
        HUD CHAS data context for households earning ≤80% AMI.
      </p>
      <div className="space-y-4">
        {BARS.map((b) => (
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
