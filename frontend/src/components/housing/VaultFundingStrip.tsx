import { Wallet, Layers } from "lucide-react";
import { useWallet, shortAddress } from "@/hooks/useWallet";

export function VaultFundingStrip() {
  const { address, isConnected } = useWallet();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-forest rounded-lg overflow-hidden">
      <div className="bg-forest p-5 flex items-center gap-4 text-primary-foreground">
        <Layers className="h-5 w-5 opacity-80" />
        <div>
          <div className="text-[10px] uppercase tracking-widest opacity-70">Vault Public Aggregate Supply</div>
          <div className="font-mono text-lg mt-0.5">4,250,000.00 USDC</div>
        </div>
      </div>
      <div className="bg-forest p-5 flex items-center gap-4 text-primary-foreground border-l border-primary-foreground/10">
        <Wallet className="h-5 w-5 opacity-80" />
        <div>
          <div className="text-[10px] uppercase tracking-widest opacity-70">Your Position</div>
          <div className="font-mono text-lg mt-0.5">
            {isConnected ? shortAddress(address) + " · 12.450 GVT" : "Connect wallet to view"}
          </div>
        </div>
      </div>
    </div>
  );
}
