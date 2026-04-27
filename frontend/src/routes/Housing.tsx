import { useOpportunity } from "@/hooks/useOpportunity";
import { PropertyCard } from "@/components/housing/PropertyCard";
import { VaultFundingStrip } from "@/components/housing/VaultFundingStrip";
import { HudCostBurdenChart } from "@/components/housing/HudCostBurdenChart";
import { AtlantaContextPanel } from "@/components/housing/AtlantaContextPanel";

export default function Housing() {
  const { data: opp, error, retry } = useOpportunity("1");

  const upcoming = [
    { name: "Adair Park Duplex", state: "Q3 Review" },
    { name: "Pittsburgh Multi-family", state: "Due Diligence" },
  ];

  return (
    <div className="container py-12 space-y-10">
      <PropertyCard opp={opp} error={error} onRetry={retry} />
      <VaultFundingStrip />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HudCostBurdenChart />
        <AtlantaContextPanel />
      </div>

      <section>
        <h2 className="font-display text-2xl text-forest mb-4">Upcoming Opportunities</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {upcoming.map((u) => (
            <div
              key={u.name}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-5"
            >
              <div>
                <div className="font-medium">{u.name}</div>
                <div className="text-xs text-muted-foreground">{u.state}</div>
              </div>
              <span className="text-[10px] uppercase tracking-widest rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">
                Coming soon
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
