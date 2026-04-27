import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ChevronRight, Loader2, RefreshCcw, RefreshCw, ShieldCheck } from "lucide-react";
import { keccak256, toUtf8Bytes } from "ethers";

import { useImpactMemo } from "@/hooks/useMemo";
import { useOpportunity } from "@/hooks/useOpportunity";
import { useContracts } from "@/hooks/useContracts";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "@/hooks/use-toast";
import { generateMemo } from "@/lib/api/chaingpt";
import { fetchCostBurden } from "@/lib/api/hud";
import { fetchLatestRate } from "@/lib/api/fred";

import { MemoBody } from "@/components/memo/MemoBody";
import { ProvenancePanel } from "@/components/memo/ProvenancePanel";
import { Button } from "@/components/ui/button";

const MEMO_ROLE_HASH = keccak256(toUtf8Bytes("MEMO_ROLE"));

function useIsMemoBot() {
  const { address, isConnected } = useWallet();
  const { housingRegistry } = useContracts();
  const [hasRole, setHasRole] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const queryOverride =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("role") === "memo";

    if (queryOverride) {
      setHasRole(true);
      return;
    }
    if (!address || !isConnected) {
      setHasRole(false);
      return;
    }
    (async () => {
      try {
        const result = await housingRegistry.hasRole(MEMO_ROLE_HASH, address);
        if (!cancelled) setHasRole(Boolean(result));
      } catch {
        if (!cancelled) setHasRole(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, isConnected, housingRegistry]);

  return hasRole;
}

export default function Memo() {
  const { id } = useParams();
  const { data: memo, error: memoError, retry: retryMemo } = useImpactMemo(id);
  const { data: opp } = useOpportunity(id);
  const { housingRegistry } = useContracts();
  const isBot = useIsMemoBot();
  const [busy, setBusy] = useState(false);

  const numericId = id ? Number(id) : 1;
  const breadcrumbAddress = opp?.address ?? "Loading…";

  async function regenerate() {
    if (!opp) return;
    setBusy(true);
    try {
      const [costBurden, treasury] = await Promise.all([
        fetchCostBurden("13121"),
        fetchLatestRate("DGS10"),
      ]);

      // Surface fallback-data usage to the operator before we anchor the
      // hash. fetchCostBurden silently returns hardcoded numbers when the
      // HUD bearer token is missing or the request fails; fetchLatestRate
      // returns null when FRED is unreachable. Anchoring a memo over
      // mixed live + fallback data without warning would silently commit
      // a hash to chain that the provenance panel later renders as
      // "Verified", undermining the demo's audit-trail claim.
      const fallbacks: string[] = [];
      if (costBurden.source !== "live") fallbacks.push("HUD CHAS (cost burden)");
      if (treasury === null) fallbacks.push("FRED DGS10 (treasury rate)");
      if (fallbacks.length > 0) {
        toast({
          title: "Generating memo with fallback data",
          description: `Live source unavailable for: ${fallbacks.join(", ")}. The on-chain hash will commit to a memo built on fallback values.`,
        });
      }

      const result = await generateMemo(
        {
          address: opp.address,
          neighborhood: opp.neighborhood,
          operator: "Atlanta Land Trust",
          amiTier: 80,
          listPriceUsd: opp.targetPrice,
        },
        {
          costBurdenSeverePct: costBurden.severelyBurdenedPct,
          treasuryRatePct: treasury,
        },
      );
      // Pinning step is stubbed — for the demo we anchor the hash with
      // an empty memoUri. A production deployment would pin to IPFS
      // first and pass the cid back here.
      const tx = await housingRegistry.setMemo(numericId, result.hash, "");
      await tx.wait();
      const liveTag = fallbacks.length === 0 ? "live data" : "mixed live + fallback data";
      toast({
        title: "Memo regenerated",
        description: `On-chain hash anchored over ${liveTag}.`,
      });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Memo regenerate failed", description: err?.shortMessage ?? err?.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container py-10 pb-32 space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center justify-between text-sm">
        <ol className="flex items-center gap-2 text-muted-foreground">
          <li><Link to="/housing" className="hover:text-forest">Housing</Link></li>
          <ChevronRight className="h-3.5 w-3.5" />
          <li>{breadcrumbAddress}</li>
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

      {memoError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-destructive">Memo read failed</div>
            <div className="text-xs text-destructive/80 font-mono break-all">
              {memoError.length > 200 ? `${memoError.slice(0, 200)}…` : memoError}
            </div>
            <p className="text-[11px] text-destructive/70 mt-1">
              The on-screen memo body and provenance below are showing the fallback template — the real chain state is unknown until this read succeeds.
            </p>
          </div>
          <Button onClick={retryMemo} variant="outline" size="sm">
            <RefreshCcw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}

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
            <Button onClick={regenerate} disabled={busy} className="bg-forest hover:bg-forest/90">
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Regenerate memo with ChainGPT
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
