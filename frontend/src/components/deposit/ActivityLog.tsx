import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  History,
  Loader2,
  PackageCheck,
  Send,
} from "lucide-react";
import { useContracts } from "@/hooks/useContracts";

const ARBISCAN_TX = "https://sepolia.arbiscan.io/tx/";
const LOOKBACK_BLOCKS = 250_000n; // ~17h on Arbitrum Sepolia

type Kind = "recorded" | "processed" | "claimed";

interface ActivityEvent {
  kind: Kind;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

const KIND_META: Record<
  Kind,
  { label: string; description: string; icon: typeof CheckCircle2 }
> = {
  recorded: {
    label: "Deposit recorded",
    description: "Encrypted amount written to the vault's pending mapping.",
    icon: Send,
  },
  processed: {
    label: "Operator processed",
    description: "Pending → claimable advanced by an OPERATOR_ROLE wallet.",
    icon: PackageCheck,
  },
  claimed: {
    label: "Shares claimed",
    description: "Encrypted gvSHARE minted from the claimable balance.",
    icon: CheckCircle2,
  },
};

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

export function ActivityLog({ address }: { address?: string }) {
  const { vault } = useContracts();
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const provider = vault.runner?.provider;
        if (!provider) throw new Error("No provider");
        const head = await provider.getBlockNumber();
        const fromBlock = Math.max(0, Number(BigInt(head) - LOOKBACK_BLOCKS));

        const [recordedLogs, processedLogs, claimedLogs] = await Promise.all([
          vault.queryFilter(vault.filters.DepositRecorded(address), fromBlock, head),
          vault.queryFilter(vault.filters.DepositProcessed(address), fromBlock, head),
          vault.queryFilter(vault.filters.DepositClaimed(address), fromBlock, head),
        ]);

        const allLogs: { kind: Kind; log: any }[] = [
          ...recordedLogs.map((l) => ({ kind: "recorded" as const, log: l })),
          ...processedLogs.map((l) => ({ kind: "processed" as const, log: l })),
          ...claimedLogs.map((l) => ({ kind: "claimed" as const, log: l })),
        ];

        // Cap to 30 most recent across all kinds before fetching block timestamps
        allLogs.sort((a, b) => b.log.blockNumber - a.log.blockNumber);
        const top = allLogs.slice(0, 30);

        const enriched: ActivityEvent[] = await Promise.all(
          top.map(async ({ kind, log }) => {
            const block = await provider.getBlock(log.blockNumber);
            return {
              kind,
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              timestamp: Number(block?.timestamp ?? 0),
            };
          }),
        );

        if (!cancelled) {
          setEvents(enriched);
          setError(null);
        }
      } catch (err: any) {
        console.error("ActivityLog read failed:", err);
        if (!cancelled) {
          setEvents([]);
          setError(err?.shortMessage ?? err?.message ?? String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, vault]);

  if (!address) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-1">
        <History className="h-4 w-4 text-forest" />
        <h3 className="font-display text-base text-forest">Your deposit activity</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        DepositRecorded · DepositProcessed · DepositClaimed events emitted by GroundVaultCore for this wallet.
      </p>

      {events === null && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading vault events…
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive/80 font-mono break-all py-2">
          {error}
        </div>
      )}

      {events && events.length === 0 && !error && (
        <div className="text-xs text-muted-foreground py-2">
          No vault events for this wallet in the last ~17 hours of chain history. Submit a deposit above to see this populate.
        </div>
      )}

      {events && events.length > 0 && (
        <ol className="relative border-l-2 border-border ml-1.5 space-y-3.5">
          {events.map((ev) => {
            const meta = KIND_META[ev.kind];
            const Icon = meta.icon;
            const dotColor =
              ev.kind === "claimed" ? "bg-sage" : ev.kind === "processed" ? "bg-forest" : "bg-forest/40";
            return (
              <li key={ev.txHash + ev.kind} className="relative pl-5">
                <span className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-card ${dotColor}`} />
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-xs">
                    <Icon className="h-3.5 w-3.5 text-forest/70" />
                    <span className="font-medium text-foreground">{meta.label}</span>
                    <span className="text-muted-foreground">· {relativeTime(ev.timestamp)}</span>
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
                <p className="text-[11px] text-muted-foreground mt-0.5 ml-5.5">
                  {meta.description}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
