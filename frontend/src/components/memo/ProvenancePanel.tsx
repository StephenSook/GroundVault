import { ExternalLink, ShieldCheck } from "lucide-react";
import type { MemoProvenance } from "@/types";
import { Button } from "@/components/ui/button";

export function ProvenancePanel({ provenance }: { provenance: MemoProvenance }) {
  return (
    <aside className="rounded-lg border border-border bg-card p-6 space-y-5 sticky top-20">
      <div className="flex items-center gap-2 pb-4 border-b border-border">
        <ShieldCheck className="h-5 w-5 text-sage" />
        <h3 className="font-display text-lg text-forest">Provenance</h3>
      </div>

      <Field label="Generator" value={provenance.generator} indicator />
      <Field label="Timestamp (UTC)" value={provenance.timestampUtc} mono />
      <Field label="On-chain hash (keccak256)" value={provenance.onChainHash} mono chip />
      <Field label="Storage URI" value={provenance.storageUri} link />

      <div className="rounded-md bg-verified/40 border border-sage/40 p-3 flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 text-verified-foreground mt-0.5" />
        <div>
          <div className="text-xs font-semibold text-verified-foreground">Green Integrity Verified</div>
          <p className="text-[11px] text-verified-foreground/80 mt-0.5">
            On-chain hash matches the local document buffer exactly. No tampering detected.
          </p>
        </div>
      </div>

      <Button variant="outline" className="w-full">
        View on Arbiscan <ExternalLink className="h-3.5 w-3.5" />
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
