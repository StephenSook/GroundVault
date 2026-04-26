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
        <div className="aspect-[4/3] rounded-xl overflow-hidden bg-muted">
          <img
            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=80"
            alt="Community capital lead"
            className="w-full h-full object-cover"
          />
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
          <div className="h-8 w-8 rounded-full bg-clay/40" />
          <span className="text-sm text-muted-foreground">Maria, Community Capital Lead</span>
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
