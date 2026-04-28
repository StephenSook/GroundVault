import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, FileCode, ShieldCheck } from "lucide-react";

import { AUDITS, severityTotals, type AuditSummary, type Severity } from "@/lib/auditsManifest";
import { githubAuditUrl, githubSourceUrl } from "@/lib/contractLinks";

const README_URL = "https://github.com/StephenSook/GroundVault/blob/main/audits/README.md";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "informational"];

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  informational: "Informational",
};

const SEVERITY_TONE: Record<Severity, { dot: string; chipBg: string; chipText: string }> = {
  critical: { dot: "bg-destructive", chipBg: "bg-destructive/10", chipText: "text-destructive" },
  high: { dot: "bg-warning", chipBg: "bg-warning/10", chipText: "text-warning" },
  medium: { dot: "bg-amber-500", chipBg: "bg-amber-500/10", chipText: "text-amber-700" },
  low: { dot: "bg-sage", chipBg: "bg-sage/10", chipText: "text-forest" },
  informational: { dot: "bg-muted-foreground", chipBg: "bg-secondary", chipText: "text-muted-foreground" },
};

export default function Audits() {
  const totals = severityTotals();
  const auditedCount = AUDITS.length;

  return (
    <div className="container py-12 space-y-10">
      <header className="space-y-3 max-w-3xl">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> ChainGPT Smart Contract Auditor
        </div>
        <h1 className="font-display text-5xl text-forest leading-tight">Audit reports</h1>
        <p className="text-muted-foreground leading-relaxed">
          Every deployed GroundVault contract was submitted to the ChainGPT Smart
          Contract Auditor (model <code className="text-xs">smart_contract_auditor</code>).
          Findings are surfaced inline below; the full markdown reports live in
          the <a href={README_URL} target="_blank" rel="noreferrer" className="text-forest underline-offset-2 hover:underline">audits/</a> directory of the repo.
        </p>
        <p className="text-xs text-muted-foreground/80">
          {auditedCount}/11 contracts audited. GroundVaultRouter was deferred —
          the 11th call hit the ChainGPT free-tier credit cap. Router is the
          simplest contract in the suite (read-only pass-through over
          GroundVaultToken + GroundVaultCore) so the gap is acceptable for the
          initial batch and will be re-run once additional credits land.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
          Aggregate findings rollup
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {SEVERITY_ORDER.map((s) => {
            const tone = SEVERITY_TONE[s];
            return (
              <div key={s} className={`rounded-md ${tone.chipBg} px-4 py-3`}>
                <div className={`text-2xl font-display ${tone.chipText}`}>{totals[s]}</div>
                <div className={`text-[11px] uppercase tracking-widest ${tone.chipText}`}>
                  {SEVERITY_LABEL[s]}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed max-w-3xl">
          Critical findings flagged by ChainGPT include the recordDeposit
          transfer-verification gap on GroundVaultCore (accepted hackathon
          scope — the Phase 2.6 trust-hardening path is documented in the
          contract NatSpec). The remainder are addressed in the per-contract
          report or marked as false positives where an existing mitigation
          was not surfaced clearly to the auditor. See the README rollup
          for the full per-finding response.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl text-forest heading-accent">Per-contract reports</h2>
          <a
            href={README_URL}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-forest underline-offset-2 hover:underline inline-flex items-center gap-1"
          >
            README rollup <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AUDITS.map((a) => (
            <AuditCard key={a.name} audit={a} />
          ))}
        </div>
      </section>
    </div>
  );
}

function AuditCard({ audit }: { audit: AuditSummary }) {
  const [open, setOpen] = useState(false);
  const total = SEVERITY_ORDER.reduce((s, k) => s + audit.counts[k], 0);

  return (
    <article className="rounded-lg border border-border bg-card overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-lg text-forest">{audit.name}</h3>
          <span className="text-[10px] text-muted-foreground font-mono">
            {total} {total === 1 ? "finding" : "findings"}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SEVERITY_ORDER.map((s) =>
            audit.counts[s] > 0 ? (
              <span
                key={s}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${SEVERITY_TONE[s].chipBg} ${SEVERITY_TONE[s].chipText}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_TONE[s].dot}`} />
                {audit.counts[s]} {SEVERITY_LABEL[s]}
              </span>
            ) : null,
          )}
          {total === 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sage/10 text-forest px-2 py-0.5 text-[10px] font-medium">
              Clean — no findings
            </span>
          )}
        </div>

        {audit.topCritical && (
          <div className="text-xs text-destructive/80 leading-snug">
            <span className="font-semibold">Top critical:</span> {audit.topCritical}
          </div>
        )}

        <div className="flex items-center gap-3 text-[11px]">
          <a
            href={githubAuditUrl(audit.name)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-forest underline-offset-2 hover:underline"
          >
            Full report <ExternalLink className="h-3 w-3" />
          </a>
          {audit.contractName && (
            <a
              href={githubSourceUrl(audit.contractName)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-forest"
            >
              <FileCode className="h-3 w-3" /> Source
            </a>
          )}
          <button
            type="button"
            onClick={() => setOpen((s) => !s)}
            className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-forest"
          >
            {open ? (
              <>
                Hide markdown <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                Inline markdown <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        </div>
      </div>

      {open && (
        <pre className="border-t border-border bg-secondary/40 px-5 py-4 text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words text-foreground/90 max-h-96 overflow-auto">
          {audit.body}
        </pre>
      )}
    </article>
  );
}
