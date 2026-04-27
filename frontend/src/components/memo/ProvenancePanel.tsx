import { AlertTriangle, Clock, ExternalLink, HelpCircle, ShieldCheck } from "lucide-react";
import type { MemoProvenance } from "@/types";
import { Button } from "@/components/ui/button";
import { useContracts } from "@/hooks/useContracts";

const ZERO_HASH = "0x" + "0".repeat(64);
const HASH_SHAPE = /^0x[0-9a-f]{64}$/;

type IntegrityState = "pending" | "verified" | "tamper" | "unknown";

function computeState(provenance: MemoProvenance): IntegrityState {
  const hash = provenance.onChainHash?.toLowerCase() ?? "";
  // Reject anything that does not look like a real keccak256 result —
  // upstream type drift or a malformed contract response would otherwise
  // pass the simple non-zero check below and render as a "tamper alert"
  // when the right state is "we cannot reason about integrity".
  if (!HASH_SHAPE.test(hash)) {
    return hash.length === 0 ? "pending" : "unknown";
  }
  const isAnchored = hash !== ZERO_HASH;
  if (!isAnchored) return "pending";
  return provenance.verified ? "verified" : "tamper";
}

const BADGE = {
  pending: {
    icon: Clock,
    title: "Awaiting on-chain anchor",
    body: "No impact memo hash has been anchored to GroundVaultRegistry yet. A wallet holding MEMO_ROLE can publish one via the regenerate bar at the bottom of this screen.",
    container: "bg-warning/10 border-warning/40",
    iconClass: "text-warning",
    titleClass: "text-warning",
    bodyClass: "text-warning/80",
  },
  verified: {
    icon: ShieldCheck,
    title: "Green Integrity Verified",
    body: "The on-chain hash matches the keccak256 of the rendered memo body exactly. No tampering detected.",
    container: "bg-verified/40 border-sage/40",
    iconClass: "text-verified-foreground",
    titleClass: "text-verified-foreground",
    bodyClass: "text-verified-foreground/80",
  },
  tamper: {
    icon: AlertTriangle,
    title: "Tamper alert",
    body: "The on-chain hash does not match the keccak256 of the rendered memo body. Treat this document as unverified until the chain anchor is reconciled.",
    container: "bg-destructive/10 border-destructive/40",
    iconClass: "text-destructive",
    titleClass: "text-destructive",
    bodyClass: "text-destructive/80",
  },
  unknown: {
    icon: HelpCircle,
    title: "Unknown integrity state",
    body: "The on-chain hash field came back in an unexpected shape (not a 0x-prefixed 64-hex keccak256). The integrity check cannot run until the chain read succeeds with a well-formed hash. Reload the page or retry the chain read.",
    container: "bg-muted border-border",
    iconClass: "text-muted-foreground",
    titleClass: "text-foreground",
    bodyClass: "text-muted-foreground",
  },
};

export function ProvenancePanel({ provenance }: { provenance: MemoProvenance }) {
  const { housingRegistry } = useContracts();
  const registryAddr = housingRegistry.target as string;
  const arbiscanUrl = `https://sepolia.arbiscan.io/address/${registryAddr}#readContract`;

  const state = computeState(provenance);
  const badge = BADGE[state];
  const Icon = badge.icon;

  return (
    <aside className="rounded-lg border border-border bg-card p-6 space-y-5 sticky top-20">
      <div className="flex items-center gap-2 pb-4 border-b border-border">
        <ShieldCheck className="h-5 w-5 text-sage" />
        <h3 className="font-display text-lg text-forest">Provenance</h3>
      </div>

      <Field label="Generator" value={provenance.generator} indicator />
      <Field label="Timestamp (UTC)" value={provenance.timestampUtc} mono />
      <Field label="On-chain hash (keccak256)" value={provenance.onChainHash} mono chip />
      <Field label="Storage URI" value={provenance.storageUri || "—"} mono />
      <Field label="Registry contract" value={registryAddr} mono chip />

      <div className={`rounded-md ${badge.container} border p-3 flex items-start gap-2`}>
        <Icon className={`h-4 w-4 ${badge.iconClass} mt-0.5`} />
        <div>
          <div className={`text-xs font-semibold ${badge.titleClass}`}>{badge.title}</div>
          <p className={`text-[11px] ${badge.bodyClass} mt-0.5`}>{badge.body}</p>
        </div>
      </div>

      <Button asChild variant="outline" className="w-full">
        <a href={arbiscanUrl} target="_blank" rel="noopener noreferrer">
          View on Arbiscan <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </Button>
    </aside>
  );
}

function Field({
  label,
  value,
  mono,
  link,
  chip,
  indicator,
}: {
  label: string;
  value: string;
  mono?: boolean;
  link?: boolean;
  chip?: boolean;
  indicator?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
        {label}
      </div>
      {chip ? (
        <div className="rounded-md bg-secondary px-2.5 py-1.5 font-mono text-xs break-all">{value}</div>
      ) : (
        <div className={`text-sm ${mono ? "font-mono text-xs" : ""} ${link ? "text-forest underline-offset-4 hover:underline" : ""}`}>
          {indicator && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sage mr-1.5 align-middle" />
          )}
          {value}
        </div>
      )}
    </div>
  );
}
