import { useEffect, useState } from "react";
import { ExternalLink, History, Loader2 } from "lucide-react";
import { useContracts } from "@/hooks/useContracts";

const ARBISCAN_TX = "https://sepolia.arbiscan.io/tx/";
// Walk back this many blocks from `latest` for the audit history.
// 250,000 ≈ 17 hours on Arbitrum Sepolia (~250ms/block) which covers
// every regenerate during a typical demo + several days of soak.
const LOOKBACK_BLOCKS = 250_000n;

interface MemoUpdate {
  txHash: string;
  blockNumber: number;
  timestamp: number; // unix seconds
  memoHash: string;
  memoUri: string;
}

function shortHash(h: string): string {
  if (!h || h.length < 12) return h;
  return `${h.slice(0, 8)}…${h.slice(-4)}`;
}

function relativeTime(unixSec: number): string {
  const diff = Math.max(Date.now() / 1000 - unixSec, 0);
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function AuditLog({
  opportunityId,
  refreshKey = 0,
}: {
  opportunityId: number;
  // Bump from the parent (e.g. Memo.regenerate after tx.wait()) to force
  // a re-query of MemoUpdated events. Without this, the audit log shows
  // the events present at component mount only, which means a fresh
  // regenerate done after page load never appears here until the user
  // navigates away and back.
  refreshKey?: number;
}) {
  const { housingRegistry } = useContracts();
  const [events, setEvents] = useState<MemoUpdate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const provider = housingRegistry.runner?.provider;
        if (!provider) throw new Error("No provider");
        const head = await provider.getBlockNumber();
        const fromBlock = Math.max(0, Number(BigInt(head) - LOOKBACK_BLOCKS));
        const filter = housingRegistry.filters.MemoUpdated(BigInt(opportunityId));
        const logs = await housingRegistry.queryFilter(filter, fromBlock, head);

        // Resolve block timestamps in parallel; cap to 25 most recent
        // events so a long history doesn't fetch hundreds of blocks.
        const top = logs.slice(-25);
        const enriched: MemoUpdate[] = await Promise.all(
          top.map(async (log: any) => {
            const block = await provider.getBlock(log.blockNumber);
            return {
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              timestamp: Number(block?.timestamp ?? 0),
              memoHash: String(log.args?.memoHash ?? ""),
              memoUri: String(log.args?.memoUri ?? ""),
            };
          }),
        );
        // Newest first
        enriched.sort((a, b) => b.blockNumber - a.blockNumber);
        if (!cancelled) {
          setEvents(enriched);
          setError(null);
        }
      } catch (err: any) {
        console.error("AuditLog read failed:", err);
        if (!cancelled) {
          setEvents([]);
          setError(err?.shortMessage ?? err?.message ?? String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [opportunityId, housingRegistry, refreshKey]);

  return (
    <div className="rounded-lg border border-border bg-card p-6 mt-8">
      <div className="flex items-center gap-2 mb-1">
        <History className="h-4 w-4 text-forest" />
        <h3 className="font-display text-lg text-forest">On-chain audit log</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Every <code className="font-mono">setMemo</code> emission for this opportunity, read live from GroundVaultRegistry.
      </p>

      {events === null && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading MemoUpdated events…
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive/80 font-mono break-all py-2">
          {error}
        </div>
      )}

      {events && events.length === 0 && !error && (
        <div className="text-xs text-muted-foreground py-2">
          No regenerations yet. The chronological log will populate the moment a wallet holding MEMO_ROLE clicks Regenerate.
        </div>
      )}

      {events && events.length > 0 && (
        <ol className="relative border-l-2 border-border ml-1.5 space-y-4">
          {events.map((ev, i) => {
            const isFallback = ev.memoUri === "fallback";
            return (
              <li key={ev.txHash} className="relative pl-5">
                <span
                  className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-card ${
                    i === 0 ? "bg-sage" : "bg-forest/40"
                  }`}
                />
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="text-xs">
                    <span className="font-medium text-foreground">
                      {i === 0 ? "Latest regeneration" : "Earlier regeneration"}
                    </span>
                    <span className="text-muted-foreground"> · {relativeTime(ev.timestamp)}</span>
                    {isFallback && (
                      <span className="ml-2 text-[10px] uppercase tracking-widest text-warning">
                        fallback memo
                      </span>
                    )}
                  </div>
                  <a
                    href={`${ARBISCAN_TX}${ev.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-forest transition-colors"
                  >
                    {shortHash(ev.txHash)} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground break-all">
                  hash {shortHash(ev.memoHash)} · block #{ev.blockNumber.toLocaleString()}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
