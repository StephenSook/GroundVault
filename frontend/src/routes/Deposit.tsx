import { EyeOff } from "lucide-react";

import { useDepositFlow } from "@/hooks/useDepositFlow";
import { useWallet } from "@/hooks/useWallet";
import { useContracts } from "@/hooks/useContracts";
import { useOpportunity } from "@/hooks/useOpportunity";

import { Stepper } from "@/components/deposit/Stepper";
import { StepWrap } from "@/components/deposit/StepWrap";
import { StepRequest } from "@/components/deposit/StepRequest";
import { StepPending } from "@/components/deposit/StepPending";
import { StepClaim } from "@/components/deposit/StepClaim";
import { PrivacyProofDrawer } from "@/components/deposit/PrivacyProofDrawer";
import { EncryptedValue } from "@/components/shared/EncryptedValue";

const SIX_DECIMALS = 1_000_000n;
const EIGHTEEN_DECIMALS = 1_000_000_000_000_000_000n;

function formatUnits6(v: bigint | null | undefined, suffix: string) {
  if (v === null || v === undefined) return "—";
  const whole = v / SIX_DECIMALS;
  const frac = v % SIX_DECIMALS;
  const fracStr = frac.toString().padStart(6, "0").slice(0, 2);
  return `${whole.toString()}.${fracStr} ${suffix}`;
}

function formatGvt18(v: bigint | null | undefined) {
  if (v === null || v === undefined) return "—";
  // GroundVaultToken is a standard-shape ERC20 with 18 decimals (the
  // OpenZeppelin default). claimDeposit mints shares as the 18-decimal
  // representation of the cUSDC contribution, so 50 cUSDC → 50e18 raw
  // shares. Render 4 fractional places so the investor sees a clean
  // "50.0000 gvSHARE" instead of an exponent.
  const whole = v / EIGHTEEN_DECIMALS;
  const frac = v % EIGHTEEN_DECIMALS;
  const fracStr = frac.toString().padStart(18, "0").slice(0, 4);
  return `${whole.toString()}.${fracStr} gvSHARE`;
}

export default function Deposit() {
  const flow = useDepositFlow();
  const { isConnected } = useWallet();
  const contracts = useContracts();
  const { data: opp } = useOpportunity("1");

  const cusdcAddr = contracts.cusdc.target as string;
  const vaultAddr = contracts.vault.target as string;
  const shareAddr = contracts.shareToken.target as string;

  // Synthesize handle-shaped strings for the live encrypted state. We
  // could fetch the actual handle bytes from the contract reads as well
  // (cusdc.confidentialBalanceOf returns bytes32), but for the privacy
  // proof + per-row UX it's enough to show the contract address tied to
  // the handle plus the decrypted value the user sees.
  const cusdcHandleLabel = `${cusdcAddr.slice(0, 10)}…${cusdcAddr.slice(-4)} (encrypted)`;
  const vaultHandleLabel = `${vaultAddr.slice(0, 10)}…${vaultAddr.slice(-4)} (encrypted)`;
  const shareHandleLabel = `${shareAddr.slice(0, 10)}…${shareAddr.slice(-4)} (encrypted)`;

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
            <StepRequest
              amount={flow.amount}
              setAmount={flow.setAmount}
              busy={flow.busy}
              onSubmit={flow.submitDeposit}
            />
          )}
          {flow.step === "pending" && (
            <StepPending busy={flow.busy} onFinalize={flow.refresh} />
          )}
          {flow.step === "claim" && (
            <StepClaim
              amount={flow.amount}
              rwaId={opp?.rwaId}
              address={opp?.address}
              onClaim={flow.claim}
              onReset={flow.reset}
            />
          )}

          {flow.error && (
            <div className="mt-4 rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-xs text-warning">
              {flow.error}
            </div>
          )}
        </div>

        <aside className="rounded-lg border border-border bg-card p-6 h-fit">
          <div className="flex items-center gap-2 pb-4 border-b border-border">
            <EyeOff className="h-5 w-5 text-forest" />
            <h2 className="font-display text-xl text-forest">Your private state</h2>
          </div>
          <div className="space-y-5 pt-4">
            <PrivateRow
              label="cUSDC balance"
              handle={cusdcHandleLabel}
              decrypted={formatUnits6(flow.cusdcBalance, "cUSDC")}
              authorized={isConnected}
            />
            <PrivateRow
              label="Pending deposit"
              handle={vaultHandleLabel}
              decrypted={formatUnits6(flow.pendingDeposit, "cUSDC")}
              authorized={isConnected}
            />
            <PrivateRow
              label="Claimable shares"
              handle={vaultHandleLabel}
              decrypted={formatUnits6(flow.claimableDeposit, "cUSDC")}
              authorized={isConnected}
            />
            <PrivateRow
              label="GVT shares held"
              handle={shareHandleLabel}
              decrypted={formatGvt18(flow.shareBalance)}
              authorized={isConnected}
            />
          </div>
          <button
            onClick={flow.refresh}
            className="mt-5 text-xs text-muted-foreground hover:text-forest"
          >
            Refresh ↻
          </button>
        </aside>
      </div>

      <PrivacyProofDrawer
        amount={flow.amount}
        encryptedHandle={cusdcHandleLabel}
        txHash={flow.lastTxHash}
        blockNumber={flow.lastBlockNumber}
      />
    </div>
  );
}

function PrivateRow({
  label,
  handle,
  decrypted,
  authorized,
}: {
  label: string;
  handle: string;
  decrypted: string;
  authorized: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <EncryptedValue
        handle={handle}
        decrypted={decrypted}
        authorized={authorized}
        variant="inline"
      />
    </div>
  );
}
