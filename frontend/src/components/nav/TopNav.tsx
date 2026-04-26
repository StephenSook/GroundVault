import { NavLink, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useWallet, shortAddress } from "@/hooks/useWallet";
import { Wallet } from "lucide-react";

const NAV = [
  { to: "/verify", label: "Verify" },
  { to: "/deposit", label: "Deposit" },
  { to: "/housing", label: "Housing" },
  { to: "/housing/1/memo", label: "Memo", match: "/housing/" },
];

export function TopNav() {
  const { address, isConnected, isOnArbSepolia, connect } = useWallet();

  return (
    <header className="border-b border-border bg-secondary/40 backdrop-blur-sm sticky top-0 z-40">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="font-display text-xl text-forest">
          GroundVault
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "text-sm tracking-wide transition-colors",
                  isActive
                    ? "font-display text-base text-forest font-semibold"
                    : "text-muted-foreground hover:text-forest",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span
            className={cn(
              "hidden sm:inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-mono",
              isOnArbSepolia
                ? "text-muted-foreground"
                : "bg-warning/15 text-warning",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isOnArbSepolia ? "bg-sage" : "bg-warning",
              )}
            />
            Arbitrum Sepolia
          </span>

          {isConnected && address ? (
            <span className="inline-flex items-center gap-2 rounded-md bg-forest px-3 py-2 text-xs font-mono text-primary-foreground">
              <Wallet className="h-3.5 w-3.5" />
              {shortAddress(address)}
            </span>
          ) : (
            <button
              type="button"
              onClick={connect}
              className="inline-flex items-center gap-2 rounded-md bg-forest px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-forest/90 transition-colors"
            >
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
