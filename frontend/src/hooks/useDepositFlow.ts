import { useCallback, useEffect, useState } from "react";

import { useContracts } from "@/hooks/useContracts";
import { useHandleClient } from "@/hooks/useHandleClient";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "@/hooks/use-toast";
import type { DepositStep } from "@/types";

const ORDER: DepositStep[] = ["wrap", "request", "pending", "claim"];

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
  const { sdk, encryptUint256, decryptUint256 } = useHandleClient();

  const [step, setStep] = useState<DepositStep>("wrap");
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState<number>(50);
  const [error, setError] = useState<string | null>(null);

  const [cusdcBalance, setCusdcBalance] = useState<bigint | null>(null);
  const [pendingDeposit, setPendingDeposit] = useState<bigint | null>(null);
  const [claimableDeposit, setClaimableDeposit] = useState<bigint | null>(null);
  const [shareBalance, setShareBalance] = useState<bigint | null>(null);

  // Real tx hash + block of the most recent confidentialTransfer. Surfaced
  // to the PrivacyProofDrawer so the public/private side-by-side panel
  // shows a hash a viewer can actually copy into Arbiscan.
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [lastBlockNumber, setLastBlockNumber] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!address || !sdk) return;
    try {
      const [cusdcHandle, pendingHandle, claimableHandle, sharesHandle] = await Promise.all([
        contracts.cusdc.confidentialBalanceOf(address) as Promise<string>,
        contracts.vault.pendingDepositOf(address) as Promise<string>,
        contracts.vault.claimableDepositOf(address) as Promise<string>,
        contracts.shareToken.confidentialBalanceOf(address) as Promise<string>,
      ]);
      const [cusdc, pending, claimable, shares] = await Promise.all([
        decryptUint256(cusdcHandle),
        decryptUint256(pendingHandle),
        decryptUint256(claimableHandle),
        decryptUint256(sharesHandle),
      ]);
      setCusdcBalance(cusdc);
      setPendingDeposit(pending);
      setClaimableDeposit(claimable);
      setShareBalance(shares);

      // Auto-advance the stepper based on chain state. Order matters —
      // claimable first so the user lands on the actionable step rather
      // than a "you have shares" terminal screen when there's still
      // unfinished work in the queue.
      if ((claimable ?? 0n) > 0n) {
        setStep("claim");
      } else if ((pending ?? 0n) > 0n) {
        setStep("pending");
      } else if ((cusdc ?? 0n) > 0n) {
        setStep("request");
      } else {
        setStep("wrap");
      }
    } catch (err) {
      console.error("deposit-flow refresh error", err);
    }
  }, [address, sdk, contracts, decryptUint256]);

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

      // Mint mUSDC to self (deployer-only on the deployed MockUSDC; demo
      // wallet is the deployer so this works in scope).
      const mintTx = await contracts.mockUsdc.mint(address, sixDecimalsAmount);
      await mintTx.wait();

      const approveTx = await contracts.mockUsdc.approve(cusdcAddr, sixDecimalsAmount);
      await approveTx.wait();

      const wrapTx = await contracts.cusdc.wrap(sixDecimalsAmount);
      await wrapTx.wait();

      toast({ title: "Wrapped", description: `${amount} mUSDC → encrypted cUSDC` });
      await refresh();
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

      // (1) Encrypted transfer cUSDC -> vault
      const transferEnc = await encryptUint256(sixDecimalsAmount, cusdcAddr);
      const transferTx = await contracts.cusdc.confidentialTransfer(
        vaultAddr,
        transferEnc.handle,
        transferEnc.handleProof,
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
      );
      await recordTx.wait();

      toast({ title: "Deposit submitted", description: "Pending operator processing" });
      await refresh();
      setStep("pending");

      // Hackathon demo: deployer wallet holds OPERATOR_ROLE, advance
      // pending -> claimable inline so the stepper doesn't sit waiting.
      try {
        const processTx = await contracts.vault.processDeposit(address);
        await processTx.wait();
        toast({ title: "Processed", description: "Operator advanced your deposit to claimable" });
        await refresh();
        setStep("claim");
      } catch (err) {
        // Non-operator wallet: leave it pending and let an admin run process.
        console.info("processDeposit not callable by this wallet — leaving pending");
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
      const tx = await contracts.vault.claimDeposit();
      await tx.wait();
      toast({ title: "Shares claimed", description: "Encrypted vault shares minted" });
      await refresh();
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
  }, []);

  const stepIndex = ORDER.indexOf(step);

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
