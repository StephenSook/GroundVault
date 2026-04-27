import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ExternalLink,
  History,
  Loader2,
  PackageCheck,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { keccak256, toUtf8Bytes } from "ethers";
import { useContracts } from "@/hooks/useContracts";
import { Skeleton } from "@/components/ui/skeleton";

const ARBISCAN_TX = "https://sepolia.arbiscan.io/tx/";
const ARBISCAN_ADDR = "https://sepolia.arbiscan.io/address/";
const LOOKBACK_BLOCKS = 500_000n; // ~34h on Arbitrum Sepolia

const OPERATOR_ROLE = keccak256(toUtf8Bytes("OPERATOR_ROLE"));
const MEMO_ROLE = keccak256(toUtf8Bytes("MEMO_ROLE"));

type ActivityKind = "recorded" | "processed" | "claimed";

interface ActivityEvent {
  kind: ActivityKind;
  controller: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

const KIND_META: Record<
  ActivityKind,
  { label: string; icon: typeof CheckCircle2; dot: string }
> = {
  recorded: { label: "Recorded", icon: Send, dot: "bg-forest/40" },
  processed: { label: "Processed", icon: PackageCheck, dot: "bg-forest" },
  claimed: { label: "Claimed", icon: CheckCircle2, dot: "bg-sage" },
};

function shortHash(h: string): string {
  if (!h || h.length < 12) return h;
  return `${h.slice(0, 8)}…${h.slice(-4)}`;
}
function shortAddr(a: string): string {
  if (!a || a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
function relativeTime(unixSec: number): string {
  const diff = Math.max(Date.now() / 1000 - unixSec, 0);
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Operator() {
  const { vault, housingRegistry } = useContracts();
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [counts, setCounts] = useState<{
    recorded: number;
    processed: number;
    claimed: number;
    pending: number;
  } | null>(null);
  const [memoCount, setMemoCount] = useState<number | null>(null);
  const [operators, setOperators] = useState<string[] | null>(null);
  const [memoHolders, setMemoHolders] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const provider = vault.runner?.provider;
        if (!provider) throw new Error("No provider");
        const head = await provider.getBlockNumber();
        const fromBlock = Math.max(0, Number(BigInt(head) - LOOKBACK_BLOCKS));

        const [recordedLogs, processedLogs, claimedLogs, memoLogs] = await Promise.all([
          vault.queryFilter(vault.filters.DepositRecorded(), fromBlock, head),
          vault.queryFilter(vault.filters.DepositProcessed(), fromBlock, head),
          vault.queryFilter(vault.filters.DepositClaimed(), fromBlock, head),
          housingRegistry.queryFilter(
            housingRegistry.filters.MemoUpdated(),
            fromBlock,
            head,
          ),
        ]);

        if (cancelled) return;

        // Pending = recorded - processed at the controller level (a
        // controller is "pending" if their last DepositRecorded
        // hasn't been followed by a DepositProcessed). Cheap proxy:
        // recorded count - processed count (any per-controller skew
        // is rare in the demo flow).
        setCounts({
          recorded: recordedLogs.length,
          processed: processedLogs.length,
          claimed: claimedLogs.length,
          pending: Math.max(0, recordedLogs.length - processedLogs.length),
        });
        setMemoCount(memoLogs.length);

        // Build merged activity timeline (newest first), cap at 25
        const merged: { kind: ActivityKind; log: any }[] = [
          ...recordedLogs.map((l: any) => ({ kind: "recorded" as const, log: l })),
          ...processedLogs.map((l: any) => ({ kind: "processed" as const, log: l })),
          ...claimedLogs.map((l: any) => ({ kind: "claimed" as const, log: l })),
        ];
        merged.sort((a, b) => b.log.blockNumber - a.log.blockNumber);
        const top = merged.slice(0, 25);

        const enriched: ActivityEvent[] = await Promise.all(
          top.map(async ({ kind, log }) => {
            const block = await provider.getBlock(log.blockNumber);
            return {
              kind,
              controller: String(log.args?.controller ?? ""),
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              timestamp: Number(block?.timestamp ?? 0),
            };
          }),
        );
        if (!cancelled) setEvents(enriched);

        // Role grants — read RoleGranted events for OPERATOR_ROLE and
        // MEMO_ROLE. Each event is an indexed (role, account, sender)
        // tuple. The minus side: RoleRevoked. Compute net set.
        const [opGranted, opRevoked, memoGranted, memoRevoked] = await Promise.all([
          vault.queryFilter(vault.filters.RoleGranted(OPERATOR_ROLE), fromBlock, head),
          vault.queryFilter(vault.filters.RoleRevoked(OPERATOR_ROLE), fromBlock, head),
          housingRegistry.queryFilter(
            housingRegistry.filters.RoleGranted(MEMO_ROLE),
            fromBlock,
            head,
          ),
          housingRegistry.queryFilter(
            housingRegistry.filters.RoleRevoked(MEMO_ROLE),
            fromBlock,
            head,
          ),
        ]);
        if (cancelled) return;

        const opSet = new Set<string>();
        for (const e of opGranted as any[]) opSet.add(String(e.args?.account ?? "").toLowerCase());
        for (const e of opRevoked as any[]) opSet.delete(String(e.args?.account ?? "").toLowerCase());
        const memoSet = new Set<string>();
        for (const e of memoGranted as any[]) memoSet.add(String(e.args?.account ?? "").toLowerCase());
        for (const e of memoRevoked as any[]) memoSet.delete(String(e.args?.account ?? "").toLowerCase());

        if (!cancelled) {
          setOperators([...opSet]);
          setMemoHolders([...memoSet]);
        }
      } catch (err: any) {
        console.error("Operator dashboard read failed:", err);
        if (!cancelled) {
          setError(err?.shortMessage ?? err?.message ?? String(err));
          setEvents([]);
          setCounts({ recorded: 0, processed: 0, claimed: 0, pending: 0 });
          setMemoCount(0);
          setOperators([]);
          setMemoHolders([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vault, housingRegistry]);

  return (
    <div className="container py-12 space-y-8">
      <header className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-4xl text-forest leading-tight">Operator dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Aggregate read-only view of GroundVault activity. Counts are vault events emitted in the last ~34 hours of Arbitrum Sepolia chain history.
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          read-only · no admin actions exposed
        </span>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3">
          <div className="text-sm font-semibold text-destructive">Operator read failed</div>
          <div className="text-xs text-destructive/80 font-mono break-all mt-1">{error}</div>
        </div>
      )}

      {/* Aggregate counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Counter label="Pending" value={counts?.pending} icon={<Activity className="h-4 w-4 text-warning" />} />
        <Counter label="Recorded" value={counts?.recorded} icon={<Send className="h-4 w-4 text-forest" />} />
        <Counter label="Processed" value={counts?.processed} icon={<PackageCheck className="h-4 w-4 text-forest" />} />
        <Counter label="Claimed" value={counts?.claimed} icon={<CheckCircle2 className="h-4 w-4 text-sage" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        {/* Activity timeline */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-1">
            <History className="h-4 w-4 text-forest" />
            <h3 className="font-display text-lg text-forest">Recent global activity</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Most recent 25 deposit events across all controllers.
          </p>
          {events === null ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-xs text-muted-foreground">No events in this window.</div>
          ) : (
            <ol className="relative border-l-2 border-border ml-1.5 space-y-3">
              {events.map((ev) => {
                const meta = KIND_META[ev.kind];
                const Icon = meta.icon;
                return (
                  <li key={ev.txHash + ev.kind} className="relative pl-5">
                    <span className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-card ${meta.dot}`} />
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 text-xs">
                        <Icon className="h-3.5 w-3.5 text-forest/70" />
                        <span className="font-medium text-foreground">{meta.label}</span>
                        <span className="text-muted-foreground">·</span>
                        <a
                          href={`${ARBISCAN_ADDR}${ev.controller}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground font-mono hover:text-forest transition-colors"
                        >
                          {shortAddr(ev.controller)}
                        </a>
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
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Roles + memo regenerations */}
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-4 w-4 text-forest" />
              <h3 className="font-display text-lg text-forest">Role grants</h3>
            </div>
            <RoleList
              title="OPERATOR_ROLE (vault)"
              members={operators}
              description="Wallets that can advance pending → claimable via processDeposit."
            />
            <div className="h-3" />
            <RoleList
              title="MEMO_ROLE (registry)"
              members={memoHolders}
              description="Wallets that can publish keccak256(memo) on chain via setMemo."
            />
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-forest" />
              <h3 className="font-display text-lg text-forest">Memo activity</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Total `MemoUpdated` events emitted by GroundVaultRegistry across all opportunities in the lookback window.
            </p>
            <div className="font-display text-3xl text-forest">
              {memoCount === null ? <Skeleton className="h-9 w-16" /> : memoCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              regenerations anchored on chain
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Counter({ label, value, icon }: { label: string; value?: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="font-display text-3xl text-forest mt-2">
        {value === undefined ? <Skeleton className="h-9 w-16" /> : value}
      </div>
    </div>
  );
}

function RoleList({ title, members, description }: { title: string; members: string[] | null; description: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="text-[11px] text-muted-foreground mt-1 mb-2">{description}</div>
      {members === null ? (
        <Skeleton className="h-5 w-full" />
      ) : members.length === 0 ? (
        <div className="text-xs text-muted-foreground">No grants in this window. Grants from contract-construction time are not surfaced here (they predate the lookback).</div>
      ) : (
        <ul className="space-y-1">
          {members.map((addr) => (
            <li key={addr} className="font-mono text-xs">
              <a
                href={`${ARBISCAN_ADDR}${addr}`}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-forest transition-colors inline-flex items-center gap-1"
              >
                {shortAddr(addr)} <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
