import { useOpportunity } from "@/hooks/useOpportunity";
import { PropertyCard } from "@/components/housing/PropertyCard";
import { PropertyMap } from "@/components/housing/PropertyMap";
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
      <PropertyMap />
      <VaultFundingStrip />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HudCostBurdenChart />
        <AtlantaContextPanel />
      </div>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-2xl text-forest">Pipeline (illustrative)</h2>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            post-hackathon roadmap
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-4 max-w-2xl">
          These addresses are not on chain today. They illustrate the post-hackathon roadmap — additional Atlanta CLT acquisitions GroundVault is positioned to fund once the live opportunity above is closed.
        </p>
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
                Roadmap
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
