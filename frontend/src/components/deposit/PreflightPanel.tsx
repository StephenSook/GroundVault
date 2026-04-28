import { useEffect, useRef, useState } from "react";
import { useBalance } from "wagmi";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { useWallet } from "@/hooks/useWallet";
import { useIdentityStatus } from "@/hooks/useIdentityStatus";
import { useHandleClient } from "@/hooks/useHandleClient";
import { ARB_SEPOLIA_ID } from "@/lib/wagmi";

// Minimum native gas balance considered "enough for a deposit run". Wrap
// is 3 txs (mint + approve + wrap), submitDeposit is 2 (transfer +
// recordDeposit) plus an optional processDeposit, claim is 1 — call it
// ~7 tx worst case. At Arbitrum Sepolia gas prices ~0.001 ETH covers all
// of them with headroom; below that the user will hit "insufficient
// funds" mid-flow which is a far worse failure mode than blocking
// upfront.
const MIN_NATIVE_GAS_WEI = 1_000_000_000_000_000n; // 0.001 ETH

type CheckState = "ok" | "fail" | "loading" | "warn";

interface CheckRow {
  label: string;
  state: CheckState;
  detail: string;
  hint?: string;
}

export function PreflightPanel() {
  const { address, isConnected, isOnArbSepolia } = useWallet();
  const { status: idStatus, isLoading: idLoading } = useIdentityStatus(address);
  const { sdk, sdkError } = useHandleClient();
  const { data: balance, isLoading: balanceLoading } = useBalance({
    address,
    chainId: ARB_SEPOLIA_ID,
  });

  const checks: CheckRow[] = [
    walletCheck(isConnected, isOnArbSepolia),
    identityCheck(idStatus, idLoading, isConnected),
    gasCheck(balance?.value, balanceLoading, isConnected),
    sdkCheck(sdk, sdkError, isConnected),
  ];

  const allOk = checks.every((c) => c.state === "ok");
  const anyFail = checks.some((c) => c.state === "fail");
  const [open, setOpen] = useState(true);
  const autoCollapsedRef = useRef(false);

  // One-shot auto-collapse: the very first time `allOk` becomes true,
  // collapse the panel so the deposit form gets primary focus. After
  // that the user's clicks own the open/closed state — which fixes
  // the prior bug where the user toggle was always overridden by the
  // derived open logic and clicking a green panel did
  // nothing.
  useEffect(() => {
    if (allOk && !autoCollapsedRef.current) {
      setOpen(false);
      autoCollapsedRef.current = true;
    }
  }, [allOk]);

  return (
    <div
      className={`rounded-lg border ${
        anyFail ? "border-warning/40 bg-warning/5" : allOk ? "border-sage/40 bg-sage/5" : "border-border bg-card"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center justify-between px-5 py-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          <ShieldCheck
            className={`h-4 w-4 ${allOk ? "text-sage" : anyFail ? "text-warning" : "text-muted-foreground"}`}
          />
          <span className="font-display text-sm text-forest">
            {allOk ? "Pre-flight ready" : anyFail ? "Pre-flight blockers" : "Running pre-flight checks…"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {checks.filter((c) => c.state === "ok").length}/{checks.length} ready
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <ul className="border-t border-border/60 px-5 py-3 space-y-2.5">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2.5 text-sm">
              <StateIcon state={c.state} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-foreground">{c.label}</span>
                  <span className="text-[11px] text-muted-foreground">{c.detail}</span>
                </div>
                {c.hint && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{c.hint}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StateIcon({ state }: { state: CheckState }) {
  if (state === "ok") return <CheckCircle2 className="h-4 w-4 text-sage mt-0.5 shrink-0" />;
  if (state === "fail") return <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />;
  if (state === "warn") return <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />;
  return <Loader2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0 animate-spin" />;
}

function walletCheck(connected: boolean, onArbSepolia: boolean): CheckRow {
  if (!connected) {
    return {
      label: "Wallet connected",
      state: "fail",
      detail: "Disconnected",
      hint: "Click Connect Wallet in the top-right to bind a signer to GroundVault.",
    };
  }
  if (!onArbSepolia) {
    return {
      label: "Wallet connected",
      state: "fail",
      detail: "Wrong network",
      hint: "Switch your wallet to Arbitrum Sepolia (chain 421614). Mainnet has no GroundVault deployment.",
    };
  }
  return { label: "Wallet connected", state: "ok", detail: "Arbitrum Sepolia" };
}

function identityCheck(
  status: ReturnType<typeof useIdentityStatus>["status"],
  loading: boolean,
  connected: boolean,
): CheckRow {
  if (!connected) {
    return { label: "ERC-3643 verified identity", state: "warn", detail: "—", hint: "Connect a wallet first." };
  }
  if (loading) return { label: "ERC-3643 verified identity", state: "loading", detail: "Reading IdentityRegistry…" };
  if (status === "verified") {
    return { label: "ERC-3643 verified identity", state: "ok", detail: "isVerified() returned true" };
  }
  if (status === "pending") {
    return {
      label: "ERC-3643 verified identity",
      state: "fail",
      detail: "Identity registered but missing claim",
      hint: "Visit /verify to publish the KYC claim. recordDeposit reverts on un-claimed identities.",
    };
  }
  if (status === "unknown") {
    return {
      label: "ERC-3643 verified identity",
      state: "warn",
      detail: "Identity read failed (RPC error)",
      hint: "Reload the page or retry — a transient RPC failure can mask a verified identity.",
    };
  }
  return {
    label: "ERC-3643 verified identity",
    state: "fail",
    detail: "Unverified",
    hint: "Visit /verify to deploy your Identity contract and register with IdentityRegistry.",
  };
}

function gasCheck(
  weiValue: bigint | undefined,
  loading: boolean,
  connected: boolean,
): CheckRow {
  if (!connected) {
    return { label: "Sepolia ETH for gas", state: "warn", detail: "—", hint: "Connect a wallet first." };
  }
  if (loading || weiValue === undefined) {
    return { label: "Sepolia ETH for gas", state: "loading", detail: "Reading native balance…" };
  }
  const eth = Number(weiValue) / 1e18;
  if (weiValue >= MIN_NATIVE_GAS_WEI) {
    return {
      label: "Sepolia ETH for gas",
      state: "ok",
      detail: `${eth.toFixed(4)} ETH`,
    };
  }
  return {
    label: "Sepolia ETH for gas",
    state: "fail",
    detail: `${eth.toFixed(4)} ETH (<0.001)`,
    hint: "Top up at faucet.quicknode.com/arbitrum/sepolia or sepoliafaucet.com — wrap + submit + claim needs ~7 transactions of headroom.",
  };
}

function sdkCheck(
  sdk: ReturnType<typeof useHandleClient>["sdk"],
  sdkError: string | null,
  connected: boolean,
): CheckRow {
  if (!connected) {
    return { label: "Nox handle SDK", state: "warn", detail: "—", hint: "SDK builds once a wallet is connected." };
  }
  if (sdkError) {
    return {
      label: "Nox handle SDK",
      state: "fail",
      detail: "Initialisation failed",
      hint: sdkError.length > 140 ? `${sdkError.slice(0, 140)}…` : sdkError,
    };
  }
  if (!sdk) {
    return { label: "Nox handle SDK", state: "loading", detail: "Building handle client…" };
  }
  return { label: "Nox handle SDK", state: "ok", detail: "ACL handshake ready" };
}
