import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

const DISMISSED_KEY = "groundvault-demo-banner-dismissed";

// Sticky one-line banner above the TopNav. Honest framing for any
// visitor — particularly hackathon judges — so the institutional copy
// elsewhere ("vault", "investor", "deposit") is never read as a
// real-money product. Dismissable; the dismissal is remembered in
// localStorage so it doesn't reappear on every page navigation.
export function DemoBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  const onDismiss = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // localStorage unavailable; banner just hides for this session.
    }
    setDismissed(true);
  };

  return (
    <div className="bg-warning/10 border-b border-warning/30 text-warning">
      <div className="container flex items-center gap-3 py-1.5 text-[11px] tracking-wide">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 truncate">
          <strong className="font-semibold">Testnet demo</strong> · Reg D 506(c) prototype on Arbitrum Sepolia · No real funds at risk · Production launch requires securities counsel.
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss banner"
          className="text-warning/80 hover:text-warning transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
