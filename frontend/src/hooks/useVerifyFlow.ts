import { useCallback, useState } from "react";
import {
  AbiCoder,
  ContractFactory,
  getBytes,
  keccak256,
  toUtf8Bytes,
  type Signer,
} from "ethers";

import { useContracts } from "@/hooks/useContracts";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "@/hooks/use-toast";
import { IDENTITY_ABI, IDENTITY_BYTECODE } from "@/lib/contracts";

const TOPIC_KYC = 1n;
const SCHEME_ECDSA = 1n;
const COUNTRY_US = 840;

export type VerifyStage = "idle" | "deploying" | "claiming" | "registering" | "done" | "error";

/**
 * Drives the three-step verify flow against the live identity layer:
 *   1. Deploy a fresh Identity contract owned by the connected wallet.
 *   2. Issuer signs the canonical claim digest (EIP-191) and the wallet
 *      writes the signed claim into its Identity via addClaim.
 *   3. The agent (deployer = same wallet in hackathon scope) registers
 *      the wallet -> identity binding in IdentityRegistry with country
 *      code 840 (US).
 *
 * Returns the live `stage` so the verify screen can render progress
 * across the three pills.
 */
export function useVerifyFlow() {
  const { address } = useWallet();
  const contracts = useContracts();

  const [stage, setStage] = useState<VerifyStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [identityAddress, setIdentityAddress] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStage("idle");
    setError(null);
    setIdentityAddress(null);
  }, []);

  const start = useCallback(async () => {
    if (!address) {
      setError("Connect a wallet first");
      setStage("error");
      return;
    }
    if (!contracts.signer) {
      setError("Wallet signer unavailable");
      setStage("error");
      return;
    }

    setError(null);

    try {
      // (1) Deploy Identity(initialOwner = wallet)
      setStage("deploying");
      const factory = new ContractFactory(IDENTITY_ABI as any, IDENTITY_BYTECODE, contracts.signer as Signer);
      const identity = await factory.deploy(address);
      await identity.waitForDeployment();
      const idAddr = (await identity.getAddress()) as string;
      setIdentityAddress(idAddr);
      toast({ title: "Identity deployed", description: idAddr });

      // (2) Build claim digest, sign with the issuer key, write into Identity.
      // Hackathon scope: deployer wallet is the trusted KYC issuer for
      // topic 1, registered during Phase 3 deploy. The connected wallet
      // signs its own claim because the connected wallet IS the deployer
      // in the demo. A production deployment brokers this signature
      // through a real KYC provider.
      setStage("claiming");
      const claimData = toUtf8Bytes("hackathon-kyc-claim");
      const dataHash = keccak256(
        AbiCoder.defaultAbiCoder().encode(
          ["address", "uint256", "bytes"],
          [idAddr, TOPIC_KYC, claimData],
        ),
      );
      const signature = await (contracts.signer as Signer).signMessage(getBytes(dataHash));

      const tx = await (identity as any).addClaim(
        TOPIC_KYC,
        SCHEME_ECDSA,
        address, // issuer = wallet itself, registered as trusted issuer in v2 deploy
        signature,
        claimData,
        "",
      );
      await tx.wait();
      toast({ title: "KYC claim added" });

      // (3) Register wallet -> identity binding with country code US.
      setStage("registering");
      const registerTx = await contracts.identityRegistry.registerIdentity(address, idAddr, COUNTRY_US);
      await registerTx.wait();
      toast({ title: "Identity registered", description: "Welcome — verified" });

      setStage("done");
    } catch (err: any) {
      console.error("verify flow error", err);
      setError(err?.shortMessage ?? err?.message ?? String(err));
      setStage("error");
      toast({
        title: "Verification failed",
        description: err?.shortMessage ?? err?.message ?? "Unknown error",
      });
    }
  }, [address, contracts]);

  return {
    stage,
    error,
    identityAddress,
    start,
    reset,
    isBusy: stage === "deploying" || stage === "claiming" || stage === "registering",
  };
}
