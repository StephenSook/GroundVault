import { Link, useParams } from "react-router-dom";
import { ChevronRight, RefreshCw, ShieldCheck } from "lucide-react";
import { useImpactMemo } from "@/hooks/useMemo";
import { useOpportunity } from "@/hooks/useOpportunity";
import { MemoBody } from "@/components/memo/MemoBody";
import { ProvenancePanel } from "@/components/memo/ProvenancePanel";
import { Button } from "@/components/ui/button";

// TODO: replace with real role check from MemoRegistry contract
function useIsMemoBot() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("role") === "memo";
}

export default function Memo() {
  const { id } = useParams();
  const { data: memo } = useImpactMemo(id);
  const { data: opp } = useOpportunity(id);
  const isBot = useIsMemoBot();

  return (
    <div className="container py-10 pb-32 space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center justify-between text-sm">
        <ol className="flex items-center gap-2 text-muted-foreground">
          <li><Link to="/housing" className="hover:text-forest">Housing</Link></li>
          <ChevronRight className="h-3.5 w-3.5" />
          <li><Link to={`/housing/${id}`} className="hover:text-forest">{opp.address}</Link></li>
          <ChevronRight className="h-3.5 w-3.5" />
          <li className="text-foreground">Impact memo</li>
        </ol>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs">
            <ShieldCheck className="h-3 w-3 text-sage" /> ChainGPT
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-mono">
            Arbitrum Sepolia
          </span>
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
        <MemoBody memo={memo} />
        <ProvenancePanel provenance={memo.provenance} />
      </div>

      {/* Memo bot bar — only visible with MEMO_ROLE */}
      {isBot && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-secondary/80 backdrop-blur-md">
          <div className="container flex items-center justify-between py-3 text-sm">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sage" />
              MEMO_ROLE active. You have permissions to update this document.
            </span>
            <Button className="bg-forest hover:bg-forest/90">
              <RefreshCw className="h-3.5 w-3.5" /> Regenerate memo with ChainGPT
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
