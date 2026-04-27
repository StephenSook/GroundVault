import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

const DISMISSED_KEY = "groundvault-demo-banner-dismissed";

// Sticky one-line banner above the TopNav. Honest framing for any
// visitor — particularly hackathon judges — so the institutional copy
// elsewhere ("vault", "investor", "deposit") is never read as a
// real-money product. Dismissable; the dismissal is remembered in
// localStorage so it doesn't reappear on every page navigation.
export function DemoBanner() {
  // Initialise from localStorage synchronously via lazy initializer so
  // a fresh browser shows the banner on first paint with no flash, and
  // a returning visitor who already dismissed it never sees it pop in.
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });

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
    <div className="bg-warning/10 border-b border-warning/30 text-warning" data-print-hidden>
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
