import { useDepositFlow } from "@/hooks/useDepositFlow";
import { useWallet } from "@/hooks/useWallet";
import { useHandleClient } from "@/hooks/useHandleClient";
import { Stepper } from "@/components/deposit/Stepper";
import { StepWrap } from "@/components/deposit/StepWrap";
import { StepRequest } from "@/components/deposit/StepRequest";
import { StepPending } from "@/components/deposit/StepPending";
import { StepClaim } from "@/components/deposit/StepClaim";
import { PrivacyProofDrawer } from "@/components/deposit/PrivacyProofDrawer";
import { EncryptedValue } from "@/components/shared/EncryptedValue";
import { useMemo } from "react";
import { EyeOff } from "lucide-react";

export default function Deposit() {
  const flow = useDepositFlow();
  const { address, isConnected } = useWallet();
  const handleClient = useHandleClient();

  const balances = useMemo(() => {
    const viewer = address ?? "0xviewer";
    return {
      shielded: handleClient.encrypt("$84,200 cUSDC", viewer),
      pending: handleClient.encrypt("$5,000 cUSDC", viewer),
      shares: handleClient.encrypt("12.450 GVT", viewer),
    };
  }, [address, handleClient]);

  return (
    <div className="container py-12 pb-80 space-y-10">
      <header className="space-y-3 max-w-2xl">
        <h1 className="font-display text-5xl text-forest leading-tight">Confidential Deposit</h1>
        <p className="text-muted-foreground">
          Your transaction details are shielded on-chain. Only authorized stewards can view the underlying assets.
        </p>
      </header>

      <Stepper order={flow.order} currentIndex={flow.stepIndex} />

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
        <div className="rounded-lg border border-border bg-card p-8">
          {flow.step === "wrap" && <StepWrap amount={flow.amount} busy={flow.busy} onWrap={flow.wrap} />}
          {flow.step === "request" && (
            <StepRequest amount={flow.amount} setAmount={flow.setAmount} busy={flow.busy} onSubmit={flow.submitDeposit} />
          )}
          {flow.step === "pending" && <StepPending busy={flow.busy} onFinalize={flow.finalize} />}
          {flow.step === "claim" && <StepClaim amount={flow.amount} onClaim={flow.claim} onReset={flow.reset} />}
        </div>

        <aside className="rounded-lg border border-border bg-card p-6 h-fit">
          <div className="flex items-center gap-2 pb-4 border-b border-border">
            <EyeOff className="h-5 w-5 text-forest" />
            <h2 className="font-display text-xl text-forest">Your private state</h2>
          </div>
          <div className="space-y-5 pt-4">
            <PrivateRow label="Shielded Balance" handle={balances.shielded.handle} plaintext="$84,200 cUSDC" authorized={isConnected} />
            <PrivateRow label="Pending Deposits" handle={balances.pending.handle} plaintext="$5,000 cUSDC" authorized={isConnected} />
            <PrivateRow label="GVT Shares" handle={balances.shares.handle} plaintext="12.450 GVT" authorized={isConnected} />
          </div>
        </aside>
      </div>

      <PrivacyProofDrawer amount={flow.amount} encryptedHandle={balances.shielded.handle} />
    </div>
  );
}

function PrivateRow({ label, handle, plaintext, authorized }: { label: string; handle: string; plaintext: string; authorized: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <EncryptedValue
        handle={handle}
        decrypted={plaintext}
        authorized={authorized}
        variant="inline"
      />
    </div>
  );
}
