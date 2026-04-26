const STATS = [
  {
    figure: "15%",
    caption: "Decline in Black resident population in target census tracts since 2010.",
  },
  {
    figure: "$4,000",
    caption: "Median wealth of Black families in Atlanta compared to $238,000 for white families.",
  },
  {
    figure: "24k",
    caption: "Affordable units lost in the metro area over the last five years.",
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
          </div>
        ))}
      </div>
    </div>
  );
}
