import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Opportunity } from "@/types";

interface PropertyCardProps {
  opp: Opportunity | null;
  error?: string | null;
  onRetry?: () => void;
}

export function PropertyCard({ opp, error, onRetry }: PropertyCardProps) {
  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 rounded-lg border border-destructive/40 bg-destructive/5 overflow-hidden">
        <div className="aspect-[4/3] md:aspect-auto bg-muted" />
        <div className="p-8 flex flex-col items-center justify-center text-center gap-3">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <div className="text-sm text-destructive font-medium">Could not load opportunity</div>
          <div className="text-xs text-destructive/80 font-mono break-all max-w-sm">
            {error.length > 200 ? `${error.slice(0, 200)}…` : error}
          </div>
          {onRetry && (
            <Button onClick={onRetry} variant="outline" size="sm">
              <RefreshCcw className="h-3.5 w-3.5" /> Retry
            </Button>
          )}
        </div>
      </div>
    );
  }
  if (!opp) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 rounded-lg border border-border bg-card overflow-hidden">
        <div className="aspect-[4/3] md:aspect-auto bg-muted" />
        <div className="p-8 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading on-chain opportunity record…
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-lg border border-border bg-card overflow-hidden">
      <div className="aspect-[4/3] md:aspect-auto bg-muted overflow-hidden">
        <img
          src={opp.heroImage}
          alt={opp.address}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="p-8 flex flex-col gap-4">
        <span className="inline-flex items-center gap-2 self-start rounded-full bg-verified px-3 py-1 text-xs font-medium text-verified-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-verified-foreground" />
          {opp.status} · {opp.city} · {opp.neighborhood}
        </span>
        <h1 className="font-display text-3xl text-forest leading-tight">{opp.address}</h1>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Configuration</div>
            <div>{opp.bedBath}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Size</div>
            <div>{opp.sqft.toLocaleString()} sqft</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Target Price</div>
            <div>${opp.targetPrice.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Affordability</div>
            <div>{opp.affordability}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild className="bg-forest hover:bg-forest/90">
            <Link to={`/housing/${opp.id}/memo`}>Read impact memo <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/deposit">Deposit confidential capital <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
