import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Home, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="container py-20 flex items-center justify-center">
      <div className="max-w-xl w-full rounded-xl border border-border bg-card p-10 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-sage/15 border border-sage/40 flex items-center justify-center mb-5">
          <KeyRound className="h-6 w-6 text-forest" />
        </div>

        <div className="font-display text-6xl text-forest leading-none">404</div>
        <h1 className="font-display text-2xl text-forest mt-4">No handle for this route</h1>
        <p className="text-sm text-muted-foreground mt-3 max-w-md mx-auto">
          The path{" "}
          <code className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">
            {location.pathname}
          </code>{" "}
          isn't part of GroundVault. The four screens that are: Verify, Deposit, Housing, and the Impact Memo for any registered opportunity.
        </p>

        <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
          <Button asChild className="bg-forest hover:bg-forest/90">
            <Link to="/housing">
              <Home className="h-4 w-4" /> Housing dashboard
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/verify">
              <ArrowLeft className="h-4 w-4" /> Verify identity
            </Link>
          </Button>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-[11px] text-muted-foreground">
          <span className="font-mono">testnet · Arbitrum Sepolia · Reg D 506(c) prototype</span>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
