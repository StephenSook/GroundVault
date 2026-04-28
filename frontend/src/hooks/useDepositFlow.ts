import { useCallback, useEffect, useState } from "react";

import { useContracts } from "@/hooks/useContracts";
import { useHandleClient } from "@/hooks/useHandleClient";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "@/hooks/use-toast";
import { bumpedGasOverrides } from "@/lib/gasOverrides";
import type { DepositStep } from "@/types";

const ORDER: DepositStep[] = ["wrap", "request", "pending", "claim"];

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "shortMessage" in err) return String((err as any).shortMessage);
  return String(err);
}

/**
 * Drives the four-state deposit lifecycle against the live Arbitrum
 * Sepolia contracts.
 *
 * Hackathon scope: the deployer wallet is also the demo investor AND the
 * operator. processDeposit is exposed as part of submitDeposit's tail
 * (after recordDeposit) when the connected wallet has OPERATOR_ROLE on
 * GroundVaultCore — i.e. the demo wallet — so the demo flow can advance
 * pending -> claimable without a separate admin UI.
 */
export function useDepositFlow() {
  const { address } = useWallet();
  const contracts = useContracts();
  const { sdk, sdkError, encryptUint256, decryptUint256 } = useHandleClient();

  const [step, setStep] = useState<DepositStep>("wrap");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [amount, setAmount] = useState<number>(50);
  const [error, setError] = useState<string | null>(null);
  // Local "you just claimed in this session" flag. Set inside the
  // claim handler after tx.wait() resolves; consumed by the stepIndex
  // compute as a balance-decrypt-independent path to lighting all
  // four stepper ticks. Survives the Nox decrypt outage that would
  // otherwise leave shareBalance === null and prevent the
  // balance-based post-claim sticky check from firing.
  const [justClaimed, setJustClaimed] = useState(false);

  const [cusdcBalance, setCusdcBalance] = useState<bigint | null>(null);
  const [pendingDeposit, setPendingDeposit] = useState<bigint | null>(null);
  const [claimableDeposit, setClaimableDeposit] = useState<bigint | null>(null);
  const [shareBalance, setShareBalance] = useState<bigint | null>(null);

  // Per-read error map for the four encrypted balance lookups. Lets the
  // UI distinguish "Nox decrypt rejected" or "RPC reverted" from "value
  // is genuinely zero" so a failed read does not silently advance the
  // stepper based on stale state.
  const [readErrors, setReadErrors] = useState<{
    cusdc?: string;
    pending?: string;
    claimable?: string;
    shares?: string;
  }>({});

  // Real tx hash + block of the most recent confidentialTransfer. Surfaced
  // to the PrivacyProofDrawer so the public/private side-by-side panel
  // shows a hash a viewer can actually copy into Arbiscan.
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [lastBlockNumber, setLastBlockNumber] = useState<number | null>(null);

  const refresh = useCallback(async (opts: { skipAutoAdvance?: boolean } = {}) => {
    if (!address) return;

    // SDK build failed — populate per-row errors instead of silently
    // returning. The Deposit screen's PrivateRow then renders the SDK
    // error inline next to each balance label, giving the user a
    // second visible signal beyond the global sdkError banner.
    if (!sdk) {
      if (sdkError) {
        setReadErrors({
          cusdc: sdkError,
          pending: sdkError,
          claimable: sdkError,
          shares: sdkError,
        });
      }
      return;
    }

    setRefreshing(true);

    try {
      // Read all four encrypted balances independently so that one failed
      // chain call or one ACL-rejected handle does not poison the others.
      // The previous Promise.all was an all-or-nothing barrier — any single
      // reject left the entire balance state stale, the catch logged to
      // console only, and the stepper sat on whatever step it was on with
      // no signal to the user that the read had failed.
      const handles = await Promise.allSettled([
        contracts.cusdc.confidentialBalanceOf(address) as Promise<string>,
        contracts.vault.pendingDepositOf(address) as Promise<string>,
        contracts.vault.claimableDepositOf(address) as Promise<string>,
        contracts.shareToken.confidentialBalanceOf(address) as Promise<string>,
      ]);

      const decryptIfOk = async (h: PromiseSettledResult<string>) => {
        if (h.status === "rejected") return { ok: false as const, err: errMsg(h.reason) };
        try {
          const v = await decryptUint256(h.value);
          return { ok: true as const, value: v };
        } catch (e) {
          return { ok: false as const, err: errMsg(e) };
        }
      };

      const [cusdcRes, pendingRes, claimableRes, sharesRes] = await Promise.all(
        handles.map(decryptIfOk),
      );

      const errs: typeof readErrors = {};
      if (!cusdcRes.ok) errs.cusdc = cusdcRes.err;
      if (!pendingRes.ok) errs.pending = pendingRes.err;
      if (!claimableRes.ok) errs.claimable = claimableRes.err;
      if (!sharesRes.ok) errs.shares = sharesRes.err;
      setReadErrors(errs);

      if (cusdcRes.ok) setCusdcBalance(cusdcRes.value);
      if (pendingRes.ok) setPendingDeposit(pendingRes.value);
      if (claimableRes.ok) setClaimableDeposit(claimableRes.value);
      if (sharesRes.ok) setShareBalance(sharesRes.value);

      // Only auto-advance the stepper when every read succeeded. Advancing
      // on partial state would push users to a screen that does not match
      // their actual chain position (e.g. landing on "claim" because the
      // claimable handle returned 0 while the pending read silently
      // rejected and is therefore unknown).
      if (!cusdcRes.ok || !pendingRes.ok || !claimableRes.ok || !sharesRes.ok) return;

      // Skip the auto-advance ladder when the caller is an action handler
      // (wrap/submitDeposit/claim) — those handlers explicitly setStep
      // after the refresh, and letting auto-advance run first creates a
      // visual flash where the stepper jumps to a stale state (e.g. a
      // leftover claimable balance from a prior unfinished run pulling
      // the user to "claim" right after they clicked Wrap). Initial mount
      // and the manual Refresh button still call refresh() with no
      // options, so the ladder fires there.
      if (opts.skipAutoAdvance) return;

      if (claimableRes.value > 0n) {
        setStep("claim");
      } else if (pendingRes.value > 0n) {
        setStep("pending");
      } else if (cusdcRes.value > 0n) {
        setStep("request");
      } else if (sharesRes.value > 0n) {
        // Post-claim sticky: the user has minted shares but no active
        // deposit in flight. Without this branch the auto-advance falls
        // to "wrap" and the screen visually regresses to step 1 right
        // after a successful claim — exactly the moment the demo wants
        // to land triumphantly. Keeping them on "claim" preserves the
        // post-deposit impact summary card. The reset button on
        // StepClaim still moves them forward to "wrap" manually when
        // they want to start a new deposit.
        setStep("claim");
      } else {
        setStep("wrap");
      }
    } catch (err) {
      // Top-level catch — the inner per-handle handlers already wrap
      // the contract reads + decrypts, so reaching here means an
      // unexpected crash (e.g. ABI mismatch from a stale deployment.json,
      // a TypeError in our own glue code). Mark every row as failed so
      // the user sees something instead of the previous unhandled
      // promise rejection that left the sidebar stuck on stale values.
      console.error("deposit-flow refresh crashed:", err);
      const msg = errMsg(err);
      setReadErrors({
        cusdc: msg,
        pending: msg,
        claimable: msg,
        shares: msg,
      });
    } finally {
      setRefreshing(false);
    }
  }, [address, sdk, sdkError, contracts, decryptUint256]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const wrap = useCallback(async () => {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const cusdcAddr = await contracts.cusdc.getAddress();
      const sixDecimalsAmount = BigInt(Math.floor(amount * 1_000_000));
      const overrides = await bumpedGasOverrides();

      // Mint mUSDC to self (deployer-only on the deployed MockUSDC; demo
      // wallet is the deployer so this works in scope).
      const mintTx = await contracts.mockUsdc.mint(address, sixDecimalsAmount, overrides);
      await mintTx.wait();

      const approveTx = await contracts.mockUsdc.approve(cusdcAddr, sixDecimalsAmount, overrides);
      await approveTx.wait();

      const wrapTx = await contracts.cusdc.wrap(sixDecimalsAmount, overrides);
      await wrapTx.wait();

      toast({ title: "Wrapped", description: `${amount} mUSDC → encrypted cUSDC` });
      await refresh({ skipAutoAdvance: true });
      setStep("request");
    } catch (err: any) {
      console.error(err);
      setError(err?.shortMessage ?? err?.message ?? String(err));
      toast({ title: "Wrap failed", description: err?.shortMessage ?? err?.message });
    } finally {
      setBusy(false);
    }
  }, [address, amount, contracts, refresh]);

  const submitDeposit = useCallback(async () => {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const cusdcAddr = (await contracts.cusdc.getAddress()) as `0x${string}`;
      const vaultAddr = (await contracts.vault.getAddress()) as `0x${string}`;
      const sixDecimalsAmount = BigInt(Math.floor(amount * 1_000_000));
      const overrides = await bumpedGasOverrides();

      // (1) Encrypted transfer cUSDC -> vault
      const transferEnc = await encryptUint256(sixDecimalsAmount, cusdcAddr);
      const transferTx = await contracts.cusdc.confidentialTransfer(
        vaultAddr,
        transferEnc.handle,
        transferEnc.handleProof,
        overrides,
      );
      const transferReceipt = await transferTx.wait();
      setLastTxHash(transferTx.hash);
      if (transferReceipt?.blockNumber !== undefined) {
        setLastBlockNumber(Number(transferReceipt.blockNumber));
      }

      // (2) Encrypted recordDeposit on the vault
      const recordEnc = await encryptUint256(sixDecimalsAmount, vaultAddr);
      const recordTx = await contracts.vault.recordDeposit(
        recordEnc.handle,
        recordEnc.handleProof,
        overrides,
      );
      await recordTx.wait();

      toast({ title: "Deposit submitted", description: "Pending operator processing" });
      await refresh({ skipAutoAdvance: true });
      setStep("pending");

      // Hackathon demo: deployer wallet holds OPERATOR_ROLE, advance
      // pending -> claimable inline so the stepper doesn't sit waiting.
      try {
        const processTx = await contracts.vault.processDeposit(address, overrides);
        await processTx.wait();
        toast({ title: "Processed", description: "Operator advanced your deposit to claimable" });
        await refresh({ skipAutoAdvance: true });
        setStep("claim");
      } catch (err: any) {
        // Distinguish "this wallet is not the operator" from any other
        // failure mode. Suppressing every error here meant a chain
        // re-org, signer rotation, gas estimation failure, or vault
        // pause all produced an identical "leave it pending" with no
        // visible feedback — the screen sat quietly while something
        // had actually broken. Only soft-suppress access-control
        // reverts; anything else re-throws to the outer catch which
        // surfaces "Deposit failed" toast.
        const msg = String(err?.shortMessage ?? err?.message ?? err).toLowerCase();
        const isRoleError =
          msg.includes("accesscontrol") ||
          msg.includes("operator_role") ||
          msg.includes("missing role") ||
          msg.includes("unauthorized") ||
          msg.includes("0xe2517d3f"); // AccessControlUnauthorizedAccount selector
        if (isRoleError) {
          toast({
            title: "Awaiting operator",
            description: "Your wallet is not the vault operator. An admin needs to run processDeposit to advance the queue.",
          });
          return;
        }
        throw err;
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.shortMessage ?? err?.message ?? String(err));
      toast({ title: "Deposit failed", description: err?.shortMessage ?? err?.message });
    } finally {
      setBusy(false);
    }
  }, [address, amount, contracts, encryptUint256, refresh]);

  const claim = useCallback(async () => {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const overrides = await bumpedGasOverrides();
      const tx = await contracts.vault.claimDeposit(overrides);
      await tx.wait();
      toast({ title: "Shares claimed", description: "Encrypted vault shares minted" });
      setJustClaimed(true);
      // Skip auto-advance — step stays on "claim" (it was already
      // "claim" before this handler ran); the stepIndex compute uses
      // either justClaimed (works immediately) or the balance-based
      // post-claim check (works on refresh-after-claim) to light up
      // all four stepper ticks.
      await refresh({ skipAutoAdvance: true });
    } catch (err: any) {
      console.error(err);
      setError(err?.shortMessage ?? err?.message ?? String(err));
      toast({ title: "Claim failed", description: err?.shortMessage ?? err?.message });
    } finally {
      setBusy(false);
    }
  }, [address, contracts, refresh]);

  const reset = useCallback(() => {
    setStep("wrap");
    setError(null);
    setJustClaimed(false);
  }, []);

  // After a successful claim, every balance returns to zero except
  // shareBalance (which carries the just-minted GVT). The auto-advance
  // ladder keeps `step` sticky on "claim" so the impact summary stays
  // visible — but the Stepper renders index === currentIndex as
  // "current ●" not "done ✓". To get the fourth tick to fill in we
  // bump stepIndex one past the last visible step in this terminal
  // post-claim state, which makes Stepper's `i < currentIndex` true
  // for every step. Detection: shareBalance > 0 AND every active-flow
  // balance is zero — distinguishes "just claimed" from "claim is the
  // active step because there's a claimable handle on chain."
  // Post-claim sticky has two paths to "all four ticks lit":
  //  (a) justClaimed — local flag set by the claim handler after
  //      tx.wait(). Works the moment the claim succeeds, no balance
  //      decrypt needed. Survives a Nox decrypt outage that would
  //      otherwise leave (b) stuck on null balances.
  //  (b) Balance-based detection — shares > 0 AND every active-flow
  //      balance at 0. Used on refresh-after-claim (page reload, new
  //      session) when balance reads succeed.
  const isPostClaimComplete =
    step === "claim" &&
    (justClaimed ||
      (shareBalance !== null &&
        shareBalance > 0n &&
        cusdcBalance === 0n &&
        pendingDeposit === 0n &&
        claimableDeposit === 0n));
  const stepIndex = isPostClaimComplete ? ORDER.length : ORDER.indexOf(step);

  return {
    step,
    stepIndex,
    order: ORDER,
    busy,
    amount,
    setAmount,
    error,
    cusdcBalance,
    pendingDeposit,
    claimableDeposit,
    shareBalance,
    readErrors,
    refreshing,
    lastTxHash,
    lastBlockNumber,
    wrap,
    submitDeposit,
    finalize: submitDeposit, // alias for the original API
    claim,
    reset,
    refresh,
  };
}
