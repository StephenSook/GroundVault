import { useState } from "react";
import { ChevronDown, ChevronUp, Key } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrivacyProofDrawerProps {
  amount: number;
  encryptedHandle: string;
  txHash?: string;
  blockNumber?: number;
}

export function PrivacyProofDrawer({
  amount,
  encryptedHandle,
  txHash = "0x4e1d2c3b9a8f7e6d5c4b3a2918f7e6d5c4b3a291",
  blockNumber = 53_812_604,
}: PrivacyProofDrawerProps) {
  const [open, setOpen] = useState(true);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-secondary/70 backdrop-blur-md transition-transform duration-300",
        open ? "translate-y-0" : "translate-y-[calc(100%-44px)]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-center justify-between px-6 h-11 text-xs uppercase tracking-wider text-muted-foreground hover:text-forest"
      >
        <span className="font-medium">Privacy Proof · same chain, same block, two views</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 px-6 pb-6 pt-1">
        <div className="rounded-md border border-border bg-background p-4">
          <div className="text-[10px] font-semibold tracking-widest text-muted-foreground mb-3">
            PUBLIC CHAIN VIEW
          </div>
          <div className="space-y-2 font-mono text-xs">
            <div>
              <span className="text-muted-foreground">Function: </span>
              <span className="text-forest">confidentialTransfer(address,bytes)</span>
            </div>
            <div className="text-muted-foreground break-all">Data: {encryptedHandle}</div>
            <div className="text-muted-foreground">[Encrypted Payload]</div>
            <div className="pt-2 border-t border-border/60 text-[10px] text-muted-foreground">
              tx {txHash.slice(0, 18)}… · block #{blockNumber.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background border border-border">
            <Key className="h-4 w-4 text-forest" />
          </div>
        </div>

        <div className="rounded-md border border-sage/40 bg-background p-4">
          <div className="text-[10px] font-semibold tracking-widest text-sage mb-3 flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sage" />
            YOUR VIEW (Nox ACL)
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Decrypted Value:</div>
            <div className="font-display text-2xl text-forest">
              {amount.toLocaleString("en-US")} cUSDC
            </div>
            <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/60 font-mono">
              tx {txHash.slice(0, 18)}… · block #{blockNumber.toLocaleString()} · Authorized via Nox handle ACL
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
