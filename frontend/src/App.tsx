import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { WagmiProvider } from "wagmi";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { wagmiConfig } from "@/lib/wagmi";
import { HandleClientProvider } from "@/hooks/useHandleClient";
import { TopNav } from "@/components/nav/TopNav";
import { Footer } from "@/components/nav/Footer";
import { DemoBanner } from "@/components/nav/DemoBanner";
import { useWallet } from "@/hooks/useWallet";
import { useIdentityStatus } from "@/hooks/useIdentityStatus";
import Verify from "@/routes/Verify";
import Deposit from "@/routes/Deposit";
import Housing from "@/routes/Housing";
import Memo from "@/routes/Memo";
import Operator from "@/routes/Operator";
import NotFound from "./pages/NotFound";
import { DepositGate } from "@/components/deposit/DepositGate";

const queryClient = new QueryClient();

function HomeRedirect() {
  const { address } = useWallet();
  const { status } = useIdentityStatus(address);
  // If the chain read came back "unknown" (RPC failure, ABI drift) we
  // route to /housing rather than /verify — booting a verified user
  // into the verify flow on a transient read error gives them no way
  // to recover, while /housing is browsable for everyone.
  if (status === "verified" || status === "unknown") {
    return <Navigate to="/housing" replace />;
  }
  return <Navigate to="/verify" replace />;
}

function DepositGuard() {
  const { address, isConnected, connect } = useWallet();
  const { status } = useIdentityStatus(address);
  if (status !== "verified") {
    return (
      <DepositGate
        isConnected={isConnected}
        address={address}
        status={status}
        onConnect={connect}
      />
    );
  }
  return <Deposit />;
}

function Shell() {
  return (
    <div className="min-h-screen flex flex-col">
      <DemoBanner />
      <TopNav />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/deposit" element={<DepositGuard />} />
          <Route path="/housing" element={<Housing />} />
          <Route path="/housing/:id/memo" element={<Memo />} />
          <Route path="/operator" element={<Operator />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

const App = () => (
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <HandleClientProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Shell />
          </BrowserRouter>
        </TooltipProvider>
      </HandleClientProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

export default App;
