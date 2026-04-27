import { Link } from "react-router-dom";
import { ArrowRight, Fingerprint, Loader2, ShieldCheck, FileSignature, Wallet } from "lucide-react";
import { useIdentityStatus } from "@/hooks/useIdentityStatus";
import { useVerifyFlow } from "@/hooks/useVerifyFlow";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Verify() {
  const { address, isConnected, connect } = useWallet();
  const { status, identity } = useIdentityStatus(address);
  const verify = useVerifyFlow();
  const effectiveStatus = verify.stage === "done" ? "verified" : status;
  const isInFlight = verify.isBusy;

  return (
    <div className="container py-12 space-y-16">
      {/* Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-5">
          <h1 className="font-display text-5xl text-forest leading-tight">
            Confidential capital for the people doing the housing work.
          </h1>
          <p className="text-base text-muted-foreground max-w-md">
            Verified accredited investors only. Reg D 506(c) testnet prototype.
          </p>
        </div>
        <div className="aspect-[4/3] rounded-xl overflow-hidden bg-cream/40 relative border border-border">
          <VerifyHeroIllustration />
        </div>
      </section>

      {/* Identity Card */}
      <section className="max-w-2xl mx-auto">
        <div className="relative rounded-xl bg-forest text-primary-foreground p-10 shadow-xl overflow-hidden">
          <ShieldCheck className="absolute right-8 top-8 h-12 w-12 text-primary-foreground/15" />

          <div className="flex flex-col items-center gap-4">
            <StatusPill status={effectiveStatus} />
            <h2 className="font-display text-3xl">
              {effectiveStatus === "verified" && "Identity Confirmed"}
              {effectiveStatus === "pending" && "Awaiting Issuer Signature"}
              {effectiveStatus === "unverified" && "Verify Your Identity"}
            </h2>

            {effectiveStatus === "verified" && identity && (
              <div className="w-full bg-forest/40 border border-primary-foreground/10 rounded-lg divide-y divide-primary-foreground/10 mt-4">
                <Row label="Contract" value={identity.contract} />
                <Row label="Jurisdiction" value={identity.jurisdiction} />
                <Row label="Claims" value={identity.claims.join(", ")} />
              </div>
            )}

            {effectiveStatus === "pending" && (
              <div className="flex items-center gap-3 text-primary-foreground/80 text-sm py-6">
                <Loader2 className="h-5 w-5 animate-spin" />
                Waiting for the issuer to countersign your claim…
              </div>
            )}

            {effectiveStatus === "unverified" && !isInFlight && (
              <p className="text-primary-foreground/70 text-sm text-center max-w-sm py-2">
                Deploy your on-chain identity contract. The issuer will then countersign a KYC claim against it.
              </p>
            )}

            {isInFlight && (
              <div className="flex flex-col items-center gap-2 text-primary-foreground/80 text-sm py-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                {verify.stage === "deploying" && "Deploying your Identity contract…"}
                {verify.stage === "claiming" && "Signing your KYC claim…"}
                {verify.stage === "registering" && "Registering your wallet with IdentityRegistry…"}
              </div>
            )}

            {verify.stage === "error" && verify.error && (
              <p className="text-warning text-xs text-center max-w-sm">
                {verify.error}
              </p>
            )}

            <div className="pt-4">
              {!isConnected && (
                <Button onClick={connect} className="bg-background text-forest hover:bg-background/90">
                  Connect wallet <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              {isConnected && effectiveStatus === "verified" && (
                <Button asChild className="bg-background text-forest hover:bg-background/90">
                  <Link to="/deposit">Continue to deposit <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              )}
              {isConnected && effectiveStatus === "unverified" && !isInFlight && (
                <Button
                  onClick={verify.start}
                  className="bg-background text-forest hover:bg-background/90"
                >
                  Deploy on-chain identity <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="max-w-2xl mx-auto">
        <ol className="grid grid-cols-3 gap-4">
          <Step
            icon={<Fingerprint />}
            label="Deploy Identity"
            active={verify.stage === "deploying"}
            done={verify.stage === "claiming" || verify.stage === "registering" || verify.stage === "done" || effectiveStatus !== "unverified"}
          />
          <Step
            icon={<FileSignature />}
            label="Issuer Signs"
            active={verify.stage === "claiming"}
            done={verify.stage === "registering" || verify.stage === "done" || effectiveStatus === "verified"}
          />
          <Step
            icon={<Wallet />}
            label="Register Wallet"
            active={verify.stage === "registering"}
            done={verify.stage === "done" || effectiveStatus === "verified"}
          />
        </ol>
      </section>

      {/* Testimonial */}
      <section className="max-w-3xl mx-auto border-l-2 border-forest pl-6 py-2">
        <p className="font-display italic text-lg text-foreground/90">
          “We needed a system that respected the privacy of our capital partners while proving to the community
          that the funds were aligned with local stewardship goals. GroundVault provides that exact balance.”
        </p>
        <div className="flex items-center gap-3 mt-4">
          <MariaAvatar />
          <div className="text-sm">
            <div className="text-foreground/90 font-medium">Maria, Community Capital Lead</div>
            <div className="text-[11px] text-muted-foreground">
              Composite persona based on documented Atlanta Land Trust acquisition history.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: ReturnType<typeof useIdentityStatus>["status"] }) {
  const map = {
    verified: { label: "VERIFIED", cls: "bg-verified text-verified-foreground" },
    pending: { label: "PENDING", cls: "bg-warning/20 text-warning" },
    unverified: { label: "NOT VERIFIED", cls: "bg-primary-foreground/15 text-primary-foreground" },
  } as const;
  const m = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold tracking-wider", m.cls)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" /> {m.label}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 text-sm">
      <span className="text-primary-foreground/70">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}

function VerifyHeroIllustration() {
  // Editorial line-art illustration matching the OG image aesthetic.
  // Forest-green stroke on cream background. Three Atlanta-craftsman
  // homes stepping in scale, a porch silhouette suggesting stewardship
  // (no facial features — avoids the AI-portrait look the previous
  // Unsplash photo had), a tree, and a subtle BeltLine wave bottom-
  // anchored for Atlanta-specific identity. No raster image; the SVG
  // scales cleanly with the 4:3 container.
  return (
    <svg
      viewBox="0 0 800 600"
      className="w-full h-full"
      role="img"
      aria-label="Three Atlanta Craftsman homes with a steward on the front porch — illustration of a Community Land Trust block"
    >
      {/* Background grid texture, very subtle */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1f3a2a" strokeWidth="0.5" opacity="0.06" />
        </pattern>
        <pattern id="dotgrid" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#1f3a2a" opacity="0.09" />
        </pattern>
      </defs>
      <rect width="800" height="600" fill="url(#grid)" />

      {/* Sun / sky disk behind the houses */}
      <circle cx="650" cy="160" r="54" fill="#7d9b7e" opacity="0.18" />

      {/* Tree on the left */}
      <g stroke="#1f3a2a" strokeWidth="2.5" fill="none" strokeLinecap="round">
        <line x1="100" y1="500" x2="100" y2="380" />
        <circle cx="100" cy="350" r="48" fill="#7d9b7e" opacity="0.25" stroke="#1f3a2a" strokeWidth="2" />
        <path d="M88 360 q12 -18 24 0" />
      </g>

      {/* House 1 — small craftsman on left */}
      <g stroke="#1f3a2a" strokeWidth="2.5" fill="#f5efde" strokeLinejoin="round">
        <path d="M170 500 L170 380 L235 330 L300 380 L300 500 Z" />
        {/* Porch */}
        <path d="M170 500 L170 460 L300 460 L300 500" fill="#ebe2c8" />
        {/* Door */}
        <rect x="220" y="430" width="30" height="70" />
        {/* Window */}
        <rect x="180" y="395" width="22" height="22" />
        <rect x="265" y="395" width="22" height="22" />
        {/* Roof line */}
        <line x1="170" y1="380" x2="300" y2="380" />
      </g>

      {/* House 2 — central, larger */}
      <g stroke="#1f3a2a" strokeWidth="2.5" fill="#f5efde" strokeLinejoin="round">
        <path d="M310 500 L310 350 L405 280 L500 350 L500 500 Z" />
        {/* Porch */}
        <path d="M310 500 L310 450 L500 450 L500 500" fill="#ebe2c8" />
        {/* Two posts */}
        <line x1="345" y1="450" x2="345" y2="500" />
        <line x1="465" y1="450" x2="465" y2="500" />
        {/* Door */}
        <rect x="385" y="410" width="40" height="80" />
        {/* Round handle */}
        <circle cx="418" cy="450" r="2" fill="#1f3a2a" />
        {/* Two windows */}
        <rect x="325" y="370" width="28" height="32" />
        <rect x="457" y="370" width="28" height="32" />
        {/* Cross detail in windows */}
        <line x1="325" y1="386" x2="353" y2="386" />
        <line x1="339" y1="370" x2="339" y2="402" />
        <line x1="457" y1="386" x2="485" y2="386" />
        <line x1="471" y1="370" x2="471" y2="402" />
        {/* Roof eaves */}
        <line x1="310" y1="350" x2="500" y2="350" />
        {/* Gable accent */}
        <line x1="380" y1="312" x2="430" y2="312" />
        {/* Chimney */}
        <rect x="445" y="300" width="14" height="38" />
      </g>

      {/* Steward silhouette on the porch — head + shoulders */}
      <g fill="#1f3a2a" opacity="0.85">
        <circle cx="365" cy="425" r="9" />
        <path d="M353 440 q12 -10 24 0 L378 462 L353 462 Z" />
      </g>

      {/* House 3 — right side */}
      <g stroke="#1f3a2a" strokeWidth="2.5" fill="#f5efde" strokeLinejoin="round">
        <path d="M510 500 L510 380 L580 330 L650 380 L650 500 Z" />
        {/* Porch */}
        <path d="M510 500 L510 465 L650 465 L650 500" fill="#ebe2c8" />
        {/* Door */}
        <rect x="565" y="425" width="32" height="75" />
        {/* Window */}
        <rect x="520" y="395" width="22" height="22" />
        <rect x="615" y="395" width="22" height="22" />
        <line x1="510" y1="380" x2="650" y2="380" />
      </g>

      {/* Small picket fence between houses (suggests neighborhood) */}
      <g stroke="#1f3a2a" strokeWidth="1.5" opacity="0.5" fill="none">
        <line x1="305" y1="495" x2="305" y2="510" />
        <line x1="307" y1="500" x2="500" y2="500" />
        <line x1="500" y1="495" x2="500" y2="510" />
        <line x1="320" y1="495" x2="320" y2="510" />
        <line x1="335" y1="495" x2="335" y2="510" />
        <line x1="350" y1="495" x2="350" y2="510" />
        <line x1="365" y1="495" x2="365" y2="510" />
        <line x1="380" y1="495" x2="380" y2="510" />
        <line x1="395" y1="495" x2="395" y2="510" />
        <line x1="410" y1="495" x2="410" y2="510" />
        <line x1="425" y1="495" x2="425" y2="510" />
        <line x1="440" y1="495" x2="440" y2="510" />
        <line x1="455" y1="495" x2="455" y2="510" />
        <line x1="470" y1="495" x2="470" y2="510" />
        <line x1="485" y1="495" x2="485" y2="510" />
      </g>

      {/* Atlanta BeltLine wave at bottom */}
      <path
        d="M0,540 C200,510 280,550 400,520 C520,490 600,545 800,510 L800,600 L0,600 Z"
        fill="#7d9b7e"
        opacity="0.25"
      />
      <path
        d="M0,540 C200,510 280,550 400,520 C520,490 600,545 800,510"
        stroke="#1f3a2a"
        strokeWidth="1.5"
        fill="none"
        opacity="0.4"
      />

      {/* Subtle dotted ground texture */}
      <rect x="0" y="555" width="800" height="45" fill="url(#dotgrid)" opacity="0.6" />

      {/* Anchor caption: small Atlanta CLT cue */}
      <g fontFamily="ui-monospace, Menlo, monospace" fill="#1f3a2a">
        <text x="40" y="56" fontSize="14" letterSpacing="0.18em" opacity="0.55">
          ATL · OAKLAND CITY · CLT
        </text>
      </g>
    </svg>
  );
}

function MariaAvatar() {
  // Small steward silhouette avatar matching the hero illustration's
  // visual language. No photo, no AI face, no risk of looking
  // generated — just a clean editorial ring + figure.
  return (
    <div className="h-10 w-10 rounded-full bg-cream/60 border border-forest/30 flex items-center justify-center overflow-hidden">
      <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden>
        <circle cx="20" cy="16" r="6" fill="#1f3a2a" opacity="0.85" />
        <path d="M10 36 Q20 24 30 36 L30 40 L10 40 Z" fill="#1f3a2a" opacity="0.85" />
      </svg>
    </div>
  );
}

function Step({ icon, label, active, done }: { icon: React.ReactNode; label: string; active: boolean; done: boolean }) {
  return (
    <li className="flex flex-col items-center gap-2 text-center">
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-lg border",
          done && "bg-sage/30 border-sage text-forest",
          active && "bg-background border-forest text-forest",
          !done && !active && "bg-background border-border text-muted-foreground",
        )}
      >
        <span className="[&_svg]:h-5 [&_svg]:w-5">{icon}</span>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </li>
  );
}
