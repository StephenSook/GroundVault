import { ExternalLink } from "lucide-react";
import { useContracts } from "@/hooks/useContracts";

const REPO_URL = "https://github.com/StephenSook/GroundVault";
const ARBISCAN_BASE = "https://sepolia.arbiscan.io/address/";

export function Footer() {
  const { housingRegistry } = useContracts();
  // ethers v6 Contract.target can be `string | Addressable`. Cast to a
  // safe string and guard against the unresolved-Addressable case so
  // the .slice(0, 8) below cannot throw if a future code path returns
  // a contract whose target has not been resolved yet.
  const rawTarget = housingRegistry.target;
  const registryAddr = typeof rawTarget === "string" ? rawTarget : "";
  const hasValidRegistry = registryAddr.startsWith("0x") && registryAddr.length === 42;

  return (
    <footer className="relative mt-24 border-t border-border bg-secondary/30 overflow-hidden">
      {/* Atlanta BeltLine silhouette decoration */}
      <svg
        className="absolute inset-x-0 -top-12 w-full h-24 text-sand/60 pointer-events-none"
        viewBox="0 0 1440 100"
        preserveAspectRatio="none"
        fill="currentColor"
        aria-hidden
      >
        <path d="M0,80 C160,40 320,90 480,60 C640,30 800,70 960,55 C1120,40 1280,80 1440,50 L1440,100 L0,100 Z" />
      </svg>
      <div className="container relative grid grid-cols-1 md:grid-cols-3 gap-8 py-10 text-sm">
        <div>
          <div className="font-display text-base text-forest">GroundVault</div>
          <p className="text-muted-foreground text-xs mt-1 max-w-sm">
            Confidential RWA impact lending vault for Community Land Trusts. Reg D 506(c) testnet prototype on iExec Nox + Arbitrum Sepolia.
          </p>
          <p className="text-muted-foreground text-[10px] mt-2">
            © GroundVault. Stewardship and multi-generational security.
          </p>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            On-chain footprint
          </div>
          <ul className="space-y-1.5 font-mono text-xs">
            <li>
              <span className="text-muted-foreground">Network:</span> Arbitrum Sepolia (chain 421614)
            </li>
            <li>
              <span className="text-muted-foreground">Contracts deployed:</span> 11
            </li>
            <li>
              <span className="text-muted-foreground">Registry:</span>{" "}
              {hasValidRegistry ? (
                <a
                  href={`${ARBISCAN_BASE}${registryAddr}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-2 hover:text-forest hover:underline"
                >
                  {registryAddr.slice(0, 8)}…{registryAddr.slice(-6)}
                </a>
              ) : (
                <span className="text-muted-foreground/60">resolving…</span>
              )}
            </li>
            <li>
              <span className="text-muted-foreground">Standards:</span> ERC-7984 · ERC-3643 · ERC-7540 (adapted)
            </li>
          </ul>
        </div>

        <nav className="flex flex-col gap-2 md:items-end">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
            Source &amp; partners
          </div>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-forest transition-colors"
          >
            GitHub repo <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://atlantalandtrust.org"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-forest transition-colors"
          >
            Atlanta Land Trust <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://iex.ec"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-forest transition-colors"
          >
            iExec Nox <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://www.huduser.gov/portal/dataset/chas-api.html"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-forest transition-colors"
          >
            HUD CHAS API <ExternalLink className="h-3 w-3" />
          </a>
        </nav>
      </div>
    </footer>
  );
}
