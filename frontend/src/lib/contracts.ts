// Loads the GroundVault deployment manifest (network, chainId, contract
// addresses) and the ABI bundle for every production contract on Arbitrum
// Sepolia. The manifest is committed at /deployments/arbitrumSepolia.json
// and copied to src/lib/deployment.json by the sync-deployment.sh script
// (run after every redeploy).

import deployment from "./deployment.json";

import ClaimTopicsRegistryAbi from "../abis/ClaimTopicsRegistry.json";
import TrustedIssuersRegistryAbi from "../abis/TrustedIssuersRegistry.json";
import IdentityAbi from "../abis/Identity.json";
import IdentityRegistryAbi from "../abis/IdentityRegistry.json";
import ModularComplianceAbi from "../abis/ModularCompliance.json";
import JurisdictionModuleAbi from "../abis/JurisdictionModule.json";
import MockUSDCAbi from "../abis/MockUSDC.json";
import CUSDCAbi from "../abis/cUSDC.json";
import GroundVaultTokenAbi from "../abis/GroundVaultToken.json";
import GroundVaultCoreAbi from "../abis/GroundVaultCore.json";
import GroundVaultRegistryAbi from "../abis/GroundVaultRegistry.json";
import GroundVaultRouterAbi from "../abis/GroundVaultRouter.json";

export type ContractName =
  | "ClaimTopicsRegistry"
  | "TrustedIssuersRegistry"
  | "IdentityRegistry"
  | "ModularCompliance"
  | "JurisdictionModule"
  | "MockUSDC"
  | "cUSDC"
  | "GroundVaultToken"
  | "GroundVaultCore"
  | "GroundVaultRegistry"
  | "GroundVaultRouter";

export interface DeploymentManifest {
  network: string;
  chainId: number;
  deployer: `0x${string}`;
  deployedAt: string;
  contracts: Record<
    ContractName,
    {
      address: `0x${string}`;
      txHash: string;
      blockNumber: number;
      constructorArgs: string[];
    }
  >;
}

export const DEPLOYMENT = deployment as unknown as DeploymentManifest;

export const ABIS: Record<ContractName, ReadonlyArray<unknown>> = {
  ClaimTopicsRegistry: ClaimTopicsRegistryAbi.abi,
  TrustedIssuersRegistry: TrustedIssuersRegistryAbi.abi,
  IdentityRegistry: IdentityRegistryAbi.abi,
  ModularCompliance: ModularComplianceAbi.abi,
  JurisdictionModule: JurisdictionModuleAbi.abi,
  MockUSDC: MockUSDCAbi.abi,
  cUSDC: CUSDCAbi.abi,
  GroundVaultToken: GroundVaultTokenAbi.abi,
  GroundVaultCore: GroundVaultCoreAbi.abi,
  GroundVaultRegistry: GroundVaultRegistryAbi.abi,
  GroundVaultRouter: GroundVaultRouterAbi.abi,
};

// Identity is deployed per-investor at onboarding time, not as part of the
// manifest. The Identity ABI is exported separately so the verify flow can
// deploy and interact with a fresh Identity for the connected wallet.
export const IDENTITY_ABI = IdentityAbi.abi;
export { IdentityAbi };

export function addressOf(name: ContractName): `0x${string}` {
  return DEPLOYMENT.contracts[name].address;
}

export function abiOf(name: ContractName) {
  return ABIS[name];
}
