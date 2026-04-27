import { useEffect, useState } from "react";
import { Wallet, Layers } from "lucide-react";

import { useWallet, shortAddress } from "@/hooks/useWallet";
import { useContracts } from "@/hooks/useContracts";
import { Jargon } from "@/components/shared/Jargon";

function shortHandle(handle?: string) {
  if (!handle) return "—";
  if (handle.length < 14) return handle;
  return `${handle.slice(0, 10)}…${handle.slice(-4)}`;
}

export function VaultFundingStrip() {
  const { address, isConnected } = useWallet();
  const { router } = useContracts();
  const [supplyHandle, setSupplyHandle] = useState<string>("");
  const [holderHandle, setHolderHandle] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = (await router.aggregateVaultSupply()) as string;
        if (!cancelled) setSupplyHandle(s);
      } catch {
        if (!cancelled) setSupplyHandle("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    if (!address) {
      setHolderHandle("");
      return;
    }
    (async () => {
      try {
        const h = (await router.holderBalance(address)) as string;
        if (!cancelled) setHolderHandle(h);
      } catch {
        if (!cancelled) setHolderHandle("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, router]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-forest rounded-lg overflow-hidden">
      <div className="bg-forest p-5 flex items-center gap-4 text-primary-foreground">
        <Layers className="h-5 w-5 opacity-80" />
        <div>
          <div className="text-[10px] uppercase tracking-widest opacity-70">
            Vault aggregate supply (encrypted)
          </div>
          <div className="font-mono text-sm mt-0.5 break-all inline-flex items-center gap-2">
            <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full rounded-full bg-sage opacity-70 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sage" />
            </span>
            {shortHandle(supplyHandle) || "—"}
          </div>
          <div className="text-[10px] opacity-60 mt-1">
            Public chain view: <Jargon term="handle">handle</Jargon> is bytes32 — only{" "}
            <Jargon term="ACL">ACL</Jargon> holders can decrypt the underlying value.
          </div>
        </div>
      </div>
      <div className="bg-forest p-5 flex items-center gap-4 text-primary-foreground border-l border-primary-foreground/10">
        <Wallet className="h-5 w-5 opacity-80" />
        <div>
          <div className="text-[10px] uppercase tracking-widest opacity-70">Your position</div>
          {isConnected ? (
            <>
              <div className="font-mono text-sm mt-0.5">{shortAddress(address)}</div>
              <div className="font-mono text-xs opacity-80 mt-1 break-all">
                shares: {shortHandle(holderHandle) || "—"}
              </div>
            </>
          ) : (
            <div className="font-mono text-sm mt-0.5 opacity-80">Connect wallet to view</div>
          )}
        </div>
      </div>
    </div>
  );
}
