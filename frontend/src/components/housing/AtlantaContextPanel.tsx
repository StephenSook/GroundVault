// Stats here MUST trace to a primary source listed in
// CitationsPanel.tsx — earlier hardcoded figures (15% / $4k vs $238k /
// 24k units) were fabricated and would have been caught by anyone
// cross-checking against the linked sources. Replaced with verified
// numbers from NCRC, the Community Foundation for Greater Atlanta,
// and Coxe Curry. Each row carries an inline source attribution so
// the reader can see provenance without leaving the screen.

interface StatRow {
  figure: string;
  caption: string;
  source: string;
}

const STATS: StatRow[] = [
  {
    figure: "22,149",
    caption: "Black residents displaced from 16 majority-Black Atlanta census tracts between 1980 and 2020.",
    source: "NCRC 2020 / Property Owners Alliance",
  },
  {
    figure: "46:1",
    caption: "Atlanta's white-to-Black wealth ratio. Median Black household holds $1 of net worth for every $46 a median white household holds.",
    source: "Community Foundation for Greater Atlanta",
  },
  {
    figure: "1,500",
    caption: "Affordable housing units lost in metro Atlanta per year over the prior decade.",
    source: "Coxe Curry, 2024",
  },
];

export function AtlantaContextPanel() {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="font-display text-xl text-forest">The Local Challenge</h3>
      <p className="text-xs text-muted-foreground mt-1 mb-5">
        Systemic factors driving the need for permanent affordability in Oakland City.
      </p>
      <div className="space-y-4">
        {STATS.map((s) => (
          <div key={s.figure} className="border-l-2 border-sage pl-4">
            <div className="font-display text-3xl text-forest">{s.figure}</div>
            <p className="text-xs text-muted-foreground mt-1">{s.caption}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mt-1.5">
              — {s.source}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
