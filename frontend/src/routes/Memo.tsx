import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ChevronRight, Download, Loader2, RefreshCcw, RefreshCw, Share2, ShieldCheck } from "lucide-react";
import { keccak256, toUtf8Bytes } from "ethers";

import { useImpactMemo } from "@/hooks/useMemo";
import { useOpportunity } from "@/hooks/useOpportunity";
import { useContracts } from "@/hooks/useContracts";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "@/hooks/use-toast";
import { generateMemo } from "@/lib/api/chaingpt";
import { fetchCostBurden } from "@/lib/api/hud";
import { fetchLatestRate } from "@/lib/api/fred";
import { bumpedGasOverrides } from "@/lib/gasOverrides";

import { MemoBody } from "@/components/memo/MemoBody";
import { ProvenancePanel } from "@/components/memo/ProvenancePanel";
import { CitationsPanel } from "@/components/memo/CitationsPanel";
import { AuditLog } from "@/components/memo/AuditLog";
import { Button } from "@/components/ui/button";
import { Jargon } from "@/components/shared/Jargon";

const MEMO_ROLE_HASH = keccak256(toUtf8Bytes("MEMO_ROLE"));

type MemoRoleState = "yes" | "no" | "unknown";

function useIsMemoBot(): MemoRoleState {
  const { address, isConnected } = useWallet();
  const { housingRegistry } = useContracts();
  const [hasRole, setHasRole] = useState<MemoRoleState>("no");

  useEffect(() => {
    let cancelled = false;
    const allowBypass = import.meta.env.VITE_ALLOW_DEMO_BYPASSES === "1";
    const queryOverride =
      allowBypass &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("role") === "memo";

    if (queryOverride) {
      setHasRole("yes");
      return;
    }
    if (!address || !isConnected) {
      setHasRole("no");
      return;
    }
    (async () => {
      try {
        const result = await housingRegistry.hasRole(MEMO_ROLE_HASH, address);
        if (!cancelled) setHasRole(Boolean(result) ? "yes" : "no");
      } catch (err) {
        // Distinguish "wallet definitely does not have the role" from
        // "we could not check". Hiding the bar entirely on a read
        // error meant a real MEMO_ROLE holder hitting an RPC blip
        // could not regenerate at all. Surface the unknown state so
        // the bar still renders with a warning.
        console.error("useIsMemoBot read failed:", err);
        if (!cancelled) setHasRole("unknown");
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
  const memoRole = useIsMemoBot();
  const showRegenerateBar = memoRole === "yes" || memoRole === "unknown";
  type RegenerateStep =
    | "idle"
    | "fetching"
    | "generating"
    | "anchoring"
    | "confirming"
    | "done";
  const [regenStep, setRegenStep] = useState<RegenerateStep>("idle");
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up the "done" hold timer if the user navigates away mid-hold.
  // Prevents setRegenStep firing on an unmounted component.
  useEffect(() => {
    return () => {
      if (doneTimerRef.current) {
        clearTimeout(doneTimerRef.current);
        doneTimerRef.current = null;
      }
    };
  }, []);
  const [busy, setBusy] = useState(false);

  const numericId = id ? Number(id) : 1;
  const breadcrumbAddress = opp?.address ?? "Loading…";

  async function regenerate() {
    if (busy) return;
    if (!opp) {
      toast({
        title: "Memo regenerate skipped",
        description: "Opportunity record not loaded yet — wait for the housing read to complete.",
      });
      return;
    }
    // Cancel any pending "done" hold timer from a prior run so a rapid
    // successive click doesn't see a stale state during this run.
    if (doneTimerRef.current) {
      clearTimeout(doneTimerRef.current);
      doneTimerRef.current = null;
    }
    setBusy(true);
    setRegenStep("fetching");
    let success = false;
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

      setRegenStep("generating");
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
      // either an empty memoUri (live ChainGPT memo, body would be
      // pinned to IPFS in prod) or the literal "fallback" marker
      // (local fallback memo). A production deployment would replace
      // both with a real IPFS cid.
      //
      // The body itself lives in this client's localStorage for BOTH
      // sources, under a unified key. Without this, a page refresh
      // (or any later useImpactMemo re-run) sees memoUri="" for live
      // ChainGPT memos, has no body to fetch, falls back to the hard-
      // coded placeholder, and Provenance panel raises a tamper alert
      // because keccak(placeholder) != the on-chain hash. The unified
      // key lets both paths re-render the body and verify cleanly.
      const memoUri = result.source === "fallback" ? "fallback" : "";
      try {
        window.localStorage.setItem(
          `groundvault-memo-body:${numericId}`,
          result.markdown,
        );
      } catch (e) {
        // localStorage quota-full or private-mode browser. The hash
        // still anchors on chain, but the body is lost — Provenance
        // will read as tampered on a future page load. Surface so the
        // operator can decide whether to proceed.
        console.warn("Could not stash memo body in localStorage:", e);
        toast({
          title: "Memo body could not be saved locally",
          description:
            "Browser storage rejected the write. The on-chain hash anchored successfully, but Provenance verification on a future page load will read as tampered until the body is regenerated.",
        });
      }
      setRegenStep("anchoring");
      const overrides = await bumpedGasOverrides();
      const tx = await housingRegistry.setMemo(numericId, result.hash, memoUri, overrides);
      setRegenStep("confirming");
      await tx.wait();
      setRegenStep("done");
      success = true;
      // Re-trigger useImpactMemo so the Provenance panel picks up the
      // freshly-anchored hash and re-reads the body we just stashed in
      // localStorage. Without this, the panel keeps showing whatever
      // hash was returned at page mount until the user refreshes —
      // which is exactly the post-regenerate "Tamper alert" UX bug
      // since the chain advances but the panel state does not.
      retryMemo();
      const sourceLabel =
        result.source === "fallback"
          ? "fallback memo (ChainGPT unavailable)"
          : fallbacks.length === 0
            ? "live ChainGPT memo"
            : "live ChainGPT memo with fallback HUD/FRED data";
      toast({
        title: "Memo regenerated",
        description: `On-chain hash anchored over ${sourceLabel}.`,
      });
    } catch (err: any) {
      console.error(err);
      // Categorise the error so the toast message is more useful than a
      // generic "regenerate failed". ethers v6 surfaces specific codes
      // for user-rejected and contract reverts; the rest fall through
      // to the underlying shortMessage / message.
      let title = "Memo regenerate failed";
      const code = err?.code;
      if (code === "ACTION_REJECTED") title = "Wallet rejected the regenerate tx";
      else if (code === "CALL_EXCEPTION") title = "Contract reverted regenerate";
      else if (code === "INSUFFICIENT_FUNDS") title = "Out of gas for regenerate";
      else if (err?.name === "AbortError") title = "Regenerate aborted";
      toast({
        title,
        description: err?.shortMessage ?? err?.message ?? String(err).slice(0, 200),
      });
    } finally {
      setBusy(false);
      // Hold the "done" state visible briefly on the happy path so the
      // user sees the green check before the panel resets to idle. The
      // timer id is stored in a ref so a component unmount or a rapid
      // second regenerate click clears it before it fires.
      if (success) {
        doneTimerRef.current = setTimeout(() => {
          setRegenStep("idle");
          doneTimerRef.current = null;
        }, 2000);
      } else {
        setRegenStep("idle");
      }
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
            <ShieldCheck className="h-3 w-3 text-sage" />{" "}
            <Jargon term="ChainGPT">ChainGPT</Jargon>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-mono">
            Arbitrum Sepolia
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="ml-2"
            data-print-hidden
            title="Print or save as PDF"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Save PDF</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const host = window.location.hostname;
              if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
                toast({
                  title: "Share unavailable on localhost",
                  description:
                    "Deploy to a Vercel preview URL first — a tweet linking to localhost won't open for anyone else.",
                });
                return;
              }
              const propertyAddress = opp?.address ?? "an Atlanta CLT property";
              const text = `Just reviewed the on-chain impact memo for ${propertyAddress} on @GroundVault — confidential RWA lending for Community Land Trusts. ERC-7984 + iExec Nox. Same chain, two views.`;
              const url = window.location.href;
              const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
              window.open(shareUrl, "_blank", "noopener,noreferrer,width=600,height=420");
            }}
            data-print-hidden
            title="Share this memo on X"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        </div>
      </nav>

      {regenStep !== "idle" && (
        <RegenerateProgress step={regenStep} />
      )}

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
        <div className="space-y-8">
          {memo ? <MemoBody memo={memo} /> : <div />}
          <AuditLog opportunityId={numericId} />
          <CitationsPanel />
        </div>
        {memo?.provenance ? (
          <ProvenancePanel provenance={memo.provenance} />
        ) : (
          <div />
        )}
      </div>

      {/* Memo bot bar — visible with MEMO_ROLE or when role check is unknown */}
      {showRegenerateBar && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-secondary/80 backdrop-blur-md">
          <div className="container flex items-center justify-between py-3 text-sm">
            {memoRole === "yes" ? (
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-sage" />
                <Jargon term="MEMO_ROLE">MEMO_ROLE</Jargon> active. You have permissions to update this document.
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-warning">
                <AlertTriangle className="h-4 w-4" />
                MEMO_ROLE check failed (RPC error). The regenerate tx will
                still revert if your wallet does not actually hold the role.
              </span>
            )}
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

const REGEN_STEPS: { key: string; label: string }[] = [
  { key: "fetching", label: "Fetching HUD CHAS + FRED" },
  { key: "generating", label: "Calling ChainGPT" },
  { key: "anchoring", label: "Submitting setMemo tx" },
  { key: "confirming", label: "Awaiting block confirmation" },
  { key: "done", label: "On-chain hash anchored" },
];

function RegenerateProgress({ step }: { step: string }) {
  const currentIdx = REGEN_STEPS.findIndex((s) => s.key === step);
  return (
    <div className="rounded-md border border-forest/40 bg-forest/5 px-4 py-3">
      <div className="text-xs font-semibold text-forest mb-2">
        {step === "done" ? "Memo regenerate complete" : "Regenerating impact memo"}
      </div>
      <ol className="space-y-1.5">
        {REGEN_STEPS.map((s, i) => {
          const isDone = i < currentIdx || step === "done";
          const isActive = i === currentIdx && step !== "done";
          return (
            <li key={s.key} className="flex items-center gap-2 text-xs">
              {isDone ? (
                <ShieldCheck className="h-3.5 w-3.5 text-sage flex-shrink-0" />
              ) : isActive ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-forest flex-shrink-0" />
              ) : (
                <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 flex-shrink-0" />
              )}
              <span
                className={
                  isDone
                    ? "text-foreground"
                    : isActive
                      ? "text-forest font-medium"
                      : "text-muted-foreground"
                }
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
