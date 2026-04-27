import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fetchCostBurden, type CostBurdenBreakdown } from "@/lib/api/hud";

interface Datum {
  label: string;
  short: string;
  pct: number;
  color: string;
  description: string;
}

function readCssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value ? `hsl(${value})` : fallback;
}

function buildData(d: CostBurdenBreakdown): Datum[] {
  // Resolve the CSS custom properties at runtime instead of writing
  // `hsl(var(--sage))` directly into the Recharts Cell `fill`. Recharts
  // renders inside an SVG that does not always inherit `:root` custom
  // properties consistently across browsers — Safari and Firefox
  // sometimes fail to resolve `var()` inside SVG attribute values and
  // render the bar as black. Reading the value here gives a literal
  // hsl(...) string the SVG fill attribute always understands.
  const sage = readCssVar("--sage", "hsl(120 13% 55%)");
  const forest = readCssVar("--forest", "hsl(150 35% 18%)");
  return [
    {
      label: "Severely Cost Burdened",
      short: "Severe (>50%)",
      pct: d.severelyBurdenedPct,
      color: "hsl(0 55% 40%)",
      description: ">50% of income on housing. The cohort GroundVault directly serves.",
    },
    {
      label: "Cost Burdened",
      short: "Moderate (30–50%)",
      pct: d.costBurdenedPct,
      color: sage,
      description: "30–50% of income on housing. At-risk cohort.",
    },
    {
      label: "Not Cost Burdened",
      short: "Stable (<30%)",
      pct: d.notBurdenedPct,
      color: forest,
      description: "Less than 30% of income on housing.",
    },
  ];
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as Datum;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-md max-w-xs">
      <div className="text-xs font-semibold text-forest">{d.label}</div>
      <div className="text-[10px] text-muted-foreground mt-1">{d.description}</div>
      <div className="font-mono text-sm mt-2">{d.pct}% of Fulton County renters</div>
    </div>
  );
}

export function HudCostBurdenChart() {
  const [data, setData] = useState<CostBurdenBreakdown | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // fetchCostBurden is defensive (always returns a CostBurdenBreakdown
      // even on token-missing / HTTP error / shape-change), so a throw
      // here would only mean a future edit broke that contract. The
      // try/catch + fallback assignment makes that future regression
      // visible (chart renders) instead of leaving the user staring at
      // the loading spinner forever.
      try {
        const result = await fetchCostBurden("13121"); // Fulton County GA
        if (!cancelled) setData(result);
      } catch (err) {
        console.error("HudCostBurdenChart: fetch threw unexpectedly:", err);
        if (!cancelled) {
          setData({
            severelyBurdenedPct: 26,
            costBurdenedPct: 24,
            notBurdenedPct: 50,
            source: "fallback",
          });
        }
      }
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

  const rows = buildData(data);

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl text-forest">Fulton County Cost Burden</h3>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {data.source === "live" ? "live · HUD CHAS" : "static fallback (HUD API unavailable)"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1 mb-5">
        HUD CHAS renter household tiers. Hover a row for source detail.
      </p>
      <div className="h-44 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" barSize={18} margin={{ left: 10, right: 24 }}>
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="short"
              tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
              axisLine={false}
              tickLine={false}
              width={120}
            />
            <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} content={<ChartTooltip />} />
            <Bar dataKey="pct" radius={[4, 4, 4, 4]}>
              {rows.map((row) => (
                <Cell key={row.label} fill={row.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
