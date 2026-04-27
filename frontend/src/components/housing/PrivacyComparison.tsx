import { useState } from "react";
import { Bot, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";

// Side-by-side comparison panel illustrating the predator-bot read
// surface on Ethereum mainnet (no ERC-7984) vs iExec Nox + ERC-7984
// on Arbitrum Sepolia. The left column shows the same chain state as
// publicly readable values; the right column shows the same state as
// bytes32 encrypted handles. Both columns use the SAME hypothetical
// numbers — the comparison is "what would a watcher see" not "what
// changes between two systems".

interface Row {
  label: string;
  publicValue: string;
  encryptedHandle: string;
}

const ROWS: Row[] = [
  {
    label: "Vault aggregate supply",
    publicValue: "$4,250,000.00 USDC",
    encryptedHandle: "0x0000066eee23018f…",
  },
  {
    label: "Investor 0xAaaa…0001 position (illustrative)",
    publicValue: "$84,200.00 cUSDC",
    encryptedHandle: "0x0000066eee2301cc…",
  },
  {
    label: "Pending 960 Lawton acquisition",
    publicValue: "$50,000.00 / $250,000.00",
    encryptedHandle: "0x0000066eee2300989f…",
  },
  {
    label: "GVT shares held (investor)",
    publicValue: "84,200 gvSHARE",
    encryptedHandle: "0x0000066eee2301264b…",
  },
];

const PUBLIC_PREDATOR_LINES = [
  "Vault holds $4.25M — competing buyers know exactly how much capital is in the queue.",
  "Maria's CLT has $84,200 ready to deploy — outbid by $84,201 to win 960 Lawton.",
  "$50k of $250k in pending — the acquisition is half-funded, time to front-run.",
  "Investor's share count maps 1:1 to dollar position — capacity is fully readable.",
];

const PRIVATE_PREDATOR_LINES = [
  "Bytes32 handle. No decryption ACL. Cannot infer pool size.",
  "Bytes32 handle. ACL granted only to the holder + Nox TEE. Cannot infer position.",
  "Bytes32 handle. Pending state opaque to non-operator addresses.",
  "Bytes32 handle. Share-count is an ERC-7984 confidential balance — not readable.",
];

export function PrivacyComparison() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-secondary/30 transition-colors"
      >
        <div>
          <div className="font-display text-xl text-forest">
            Why confidentiality? Same chain, two predator surfaces.
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Compare what an unprotected mainnet treasury exposes vs. the GroundVault stack.
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Mainnet without ERC-7984 — destructive tone */}
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5 space-y-4">
              <div className="flex items-center gap-2 text-destructive">
                <Eye className="h-4 w-4" />
                <h4 className="font-display text-base">
                  Ethereum mainnet · no ERC-7984
                </h4>
              </div>
              <div className="text-[11px] uppercase tracking-widest text-destructive/70">
                Public chain view
              </div>
              <ul className="space-y-2.5 text-sm">
                {ROWS.map((r) => (
                  <li key={r.label} className="space-y-0.5">
                    <div className="text-xs text-muted-foreground">{r.label}</div>
                    <div className="font-mono font-medium text-destructive">
                      {r.publicValue}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 mt-2">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-destructive font-semibold mb-2">
                  <Bot className="h-3 w-3" />
                  Predator bot reads
                </div>
                <ul className="space-y-1 text-[11px] text-destructive/80 list-disc pl-4">
                  {PUBLIC_PREDATOR_LINES.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* GroundVault on iExec Nox — sage tone */}
            <div className="rounded-lg border border-sage/40 bg-sage/5 p-5 space-y-4">
              <div className="flex items-center gap-2 text-forest">
                <EyeOff className="h-4 w-4" />
                <h4 className="font-display text-base">
                  GroundVault · iExec Nox + ERC-7984
                </h4>
              </div>
              <div className="text-[11px] uppercase tracking-widest text-forest/70">
                Public chain view
              </div>
              <ul className="space-y-2.5 text-sm">
                {ROWS.map((r) => (
                  <li key={r.label} className="space-y-0.5">
                    <div className="text-xs text-muted-foreground">{r.label}</div>
                    <div className="font-mono font-medium text-forest break-all">
                      {r.encryptedHandle}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="rounded-md bg-sage/15 border border-sage/30 p-3 mt-2">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-forest font-semibold mb-2">
                  <Bot className="h-3 w-3" />
                  Predator bot reads
                </div>
                <ul className="space-y-1 text-[11px] text-forest/80 list-disc pl-4">
                  {PRIVATE_PREDATOR_LINES.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-4 max-w-3xl leading-relaxed">
            <span className="font-semibold text-foreground">Same numbers, two different surfaces.</span>{" "}
            ERC-7984 stores balances as bytes32 handles. Nox grants decryption only to ACL-permitted addresses (the holder, the share token, the operator). What a public chain reader cannot decrypt, a predator bot cannot front-run.
          </p>
        </div>
      )}
    </div>
  );
}
