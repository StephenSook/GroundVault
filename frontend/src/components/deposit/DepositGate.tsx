import { Link } from "react-router-dom";
import { ShieldAlert, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shortAddress } from "@/hooks/useWallet";
import type { IdentityStatus } from "@/types";

interface DepositGateProps {
  isConnected: boolean;
  address?: string;
  status: IdentityStatus;
  onConnect: () => void;
}

const COPY: Record<"unconnected" | "pending" | "unverified" | "unknown", { title: string; body: string }> = {
  unconnected: {
    title: "Connect a verified wallet to deposit",
    body: "GroundVault is gated by ERC-3643 KYC. Connect a wallet that holds an Identity contract with the required claim attestations to enter the deposit flow.",
  },
  pending: {
    title: "Identity registered — awaiting verification",
    body: "The connected wallet has an on-chain Identity, but it has not yet received every required claim. Visit the Verify screen to publish the missing claims.",
  },
  unverified: {
    title: "Wallet not yet whitelisted",
    body: "The connected wallet is not registered in the IdentityRegistry. Visit the Verify screen to mint an Identity and request claim attestations from a trusted issuer.",
  },
  unknown: {
    title: "Could not verify identity status",
    body: "The IdentityRegistry read failed — likely a transient Arbitrum Sepolia RPC error. Your wallet may already be verified. Refresh the page to retry, or continue to the Verify screen to manually re-check.",
  },
};

export function DepositGate({ isConnected, address, status, onConnect }: DepositGateProps) {
  const branch: keyof typeof COPY = !isConnected
    ? "unconnected"
    : status === "pending"
      ? "pending"
      : status === "unknown"
        ? "unknown"
        : "unverified";
  const copy = COPY[branch];

  return (
    <div className="container py-16">
      <div className="max-w-xl mx-auto rounded-lg border border-border bg-card p-10 text-center space-y-5">
        <div className="mx-auto h-12 w-12 rounded-full bg-warning/15 flex items-center justify-center">
          <ShieldAlert className="h-6 w-6 text-warning" />
        </div>
        <h1 className="font-display text-2xl text-forest">{copy.title}</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{copy.body}</p>

        {isConnected && address && (
          <div className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-xs font-mono text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" />
            {shortAddress(address)} · status: {status}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-2">
          {!isConnected && (
            <Button onClick={onConnect} className="bg-forest hover:bg-forest/90">
              <Wallet className="h-4 w-4" />
              Connect wallet
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/verify">Go to Verify</Link>
          </Button>
        </div>

        <p className="pt-4 text-[11px] text-muted-foreground/70">
          Demo testers without a verified wallet can append <code className="font-mono">?status=verified</code> to bypass the gate.
        </p>
      </div>
    </div>
  );
}
