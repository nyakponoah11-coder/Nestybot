import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState, Component, type ReactNode } from "react";
import { trackSiteVisit } from "@/lib/useVisitorTracker";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import Shop from "./pages/Shop";
import AICustomerChatModal from "./components/AICustomerChatModal";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full p-6 rounded-3xl border border-border bg-card shadow-2xl flex flex-col items-center gap-4">
            <div className="size-14 rounded-2xl bg-amber-500/20 text-amber-500 grid place-items-center text-2xl font-black">
              ⚡
            </div>
            <h1 className="text-xl font-black">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message || "An unexpected issue occurred while displaying the page."}
            </p>
            <div className="flex gap-3 w-full mt-2">
              <Button
                className="flex-1 font-bold rounded-xl"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
              >
                <RotateCcw className="size-4 mr-2" /> Reload page
              </Button>
              <Button
                variant="outline"
                className="font-bold rounded-xl"
                onClick={() => {
                  window.location.href = "/";
                }}
              >
                Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import NetworkBundles from "./pages/NetworkBundles";
import Services from "./pages/Services";
import Track from "./pages/Track";
import Game from "./pages/Game";
import Race from "./pages/Race";
import FlappyBird from "./pages/FlappyBird";
import DataFusion2048 from "./pages/DataFusion2048";
import EightBallPool from "./pages/EightBallPool";
import LudoGame from "./pages/LudoGame";
import TempleRun from "./pages/TempleRun";
import MarbleShoot from "./pages/MarbleShoot";
import Football from "./pages/Football";
import ArcadeHub from "./pages/ArcadeHub";
import PaymentCallback from "./pages/PaymentCallback";
import NetflixCode from "./pages/NetflixCode";
import DownloadApp from "./pages/DownloadApp";
import AdminLogin from "./pages/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminFlashSale from "./pages/admin/AdminFlashSale";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminSupport from "./pages/admin/AdminSupport";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminVisitors from "./pages/admin/AdminVisitors";
import AdminServices from "./pages/admin/AdminServices";
import AdminReferrals from "./pages/admin/AdminReferrals";
import AdminCheckers from "./pages/admin/AdminCheckers";
import AdminWhatsAppOrders from "./pages/admin/AdminWhatsAppOrders";
import AdminBulkSms from "./pages/admin/AdminBulkSms";
import AdminSmsLogs from "./pages/admin/AdminSmsLogs";
import AdminSpinReport from "./pages/admin/AdminSpinReport";
import AdminFreeData from "./pages/admin/AdminFreeData";
import AdminAiAssistant from "./pages/admin/AdminAiAssistant";
import AdminVoiceNotes from "./pages/admin/AdminVoiceNotes";
import AdminAIAgent from "./pages/admin/AdminAIAgent";
import AdminAIInstructions from "./pages/admin/AdminAIInstructions";
import AgentAuth from "./pages/agent/AgentAuth";
import AgentDashboard from "./pages/agent/AgentDashboard";
import AgentStorefront from "./pages/agent/AgentStorefront";
import AgentDomainGate from "./pages/agent/AgentDomainGate";
import AdminAgents from "./pages/admin/AdminAgents";
import AdminDatabaseStudio from "./pages/admin/AdminDatabaseStudio";
import SocialBoost from "./pages/SocialBoost";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Automatically tracks link opens and visitors in the background
function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    trackSiteVisit(location.pathname + location.search);
    try {
      const params = new URLSearchParams(location.search);
      const ref = params.get("ref");
      if (ref && ref.trim()) {
        localStorage.setItem("incoming_ref", ref.trim().toUpperCase());
      }
    } catch (_) {}
  }, [location.pathname, location.search]);
  return null;
}

function GlobalSupportChatModal() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("open-support-chat", handleOpen);
    window.addEventListener("open-ai-chat", handleOpen);
    return () => {
      window.removeEventListener("open-support-chat", handleOpen);
      window.removeEventListener("open-ai-chat", handleOpen);
    };
  }, []);

  if (location.pathname.startsWith("/admin")) return null;
  if (typeof window !== "undefined" && window.location.hostname.toLowerCase().includes("gooddata")) return null;

  return (
    <AICustomerChatModal
      isOpen={open}
      onClose={() => setOpen(false)}
      storeName="DATA 1 GH"
    />
  );
}

function AppRoutes() {
  const location = useLocation();
  const isAgentDomain = typeof window !== "undefined" && window.location.hostname.toLowerCase().includes("gooddata");

  // On gooddata1.vercel.app, restrict access ONLY to agent storefronts and agent portal.
  // If customers remove the /s/store-name link, they see the AgentDomainGate and cannot view the main site.
  if (isAgentDomain) {
    const isStorefrontOrAgent =
      location.pathname.startsWith("/s/") ||
      location.pathname.startsWith("/store/") ||
      location.pathname.startsWith("/payment") ||
      location.pathname.startsWith("/callback") ||
      location.pathname.startsWith("/track") ||
      location.pathname.startsWith("/boost") ||
      location.pathname.startsWith("/social-boost") ||
      location.pathname.startsWith("/agent") ||
      location.pathname.startsWith("/arcade") ||
      location.pathname.startsWith("/games") ||
      location.pathname.startsWith("/game") ||
      location.pathname.startsWith("/race") ||
      location.pathname.startsWith("/flappy") ||
      location.pathname.startsWith("/bird") ||
      location.pathname.startsWith("/2048") ||
      location.pathname.startsWith("/fusion") ||
      location.pathname.startsWith("/8ball") ||
      location.pathname.startsWith("/pool") ||
      location.pathname.startsWith("/ludo") ||
      location.pathname.startsWith("/templerun") ||
      location.pathname.startsWith("/runner") ||
      location.pathname.startsWith("/marbleshoot") ||
      location.pathname.startsWith("/zuma") ||
      location.pathname.startsWith("/football") ||
      location.pathname.startsWith("/soccer");

    if (!isStorefrontOrAgent) {
      return (
        <Routes>
          <Route path="/s/:slug" element={<AgentStorefront />} />
          <Route path="/store/:slug" element={<AgentStorefront />} />
          <Route path="/payment/callback" element={<PaymentCallback />} />
          <Route path="/callback" element={<PaymentCallback />} />
          <Route path="/payment-callback" element={<PaymentCallback />} />
          <Route path="/track" element={<Track />} />
          <Route path="/agent" element={<AgentDashboard />} />
          <Route path="/agent/login" element={<AgentAuth />} />
          <Route path="/agent/register" element={<AgentAuth />} />
          <Route path="/agent/dashboard" element={<AgentDashboard />} />
          <Route path="*" element={<AgentDomainGate />} />
        </Routes>
      );
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Shop />} />
      <Route path="/download-app" element={<DownloadApp />} />
      <Route path="/download" element={<DownloadApp />} />
      <Route path="/apk" element={<DownloadApp />} />
      <Route path="/network/:network" element={<NetworkBundles />} />
      <Route path="/services" element={<Services />} />
      <Route path="/boost" element={<SocialBoost />} />
      <Route path="/boost/:platform" element={<SocialBoost />} />
      <Route path="/social-boost" element={<SocialBoost />} />
      <Route path="/track" element={<Track />} />
      <Route path="/game" element={<Game />} />
      <Route path="/race" element={<Race />} />
      <Route path="/flappy" element={<FlappyBird />} />
      <Route path="/bird" element={<FlappyBird />} />
      <Route path="/2048" element={<DataFusion2048 />} />
      <Route path="/fusion" element={<DataFusion2048 />} />
      <Route path="/8ball" element={<EightBallPool />} />
      <Route path="/pool" element={<EightBallPool />} />
      <Route path="/ludo" element={<LudoGame />} />
      <Route path="/templerun" element={<TempleRun />} />
      <Route path="/runner" element={<TempleRun />} />
      <Route path="/marbleshoot" element={<MarbleShoot />} />
      <Route path="/zuma" element={<MarbleShoot />} />
      <Route path="/football" element={<Football />} />
      <Route path="/soccer" element={<Football />} />
      <Route path="/arcade" element={<ArcadeHub />} />
      <Route path="/games" element={<ArcadeHub />} />
      <Route path="/orders" element={<Track />} />
      <Route path="/order-history" element={<Track />} />
      <Route path="/payment/callback" element={<PaymentCallback />} />
      <Route path="/callback" element={<PaymentCallback />} />
      <Route path="/payment-callback" element={<PaymentCallback />} />
      <Route path="/netflix/:reference" element={<NetflixCode />} />
      <Route path="/agent" element={<AgentDashboard />} />
      <Route path="/agent/login" element={<AgentAuth />} />
      <Route path="/agent/register" element={<AgentAuth />} />
      <Route path="/agent/dashboard" element={<AgentDashboard />} />
      <Route path="/s/:slug" element={<AgentStorefront />} />
      <Route path="/store/:slug" element={<AgentStorefront />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="agents" element={<AdminAgents />} />
        <Route path="ai-agent" element={<AdminAIAgent />} />
        <Route path="ai-instructions" element={<AdminAIInstructions />} />
        <Route path="voice-notes" element={<AdminVoiceNotes />} />
        <Route path="ai-assistant" element={<AdminAiAssistant />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="flash-sale" element={<AdminFlashSale />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="support" element={<AdminSupport />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="visitors" element={<AdminVisitors />} />
        <Route path="services" element={<AdminServices />} />
        <Route path="referrals" element={<AdminReferrals />} />
        <Route path="checkers" element={<AdminCheckers />} />
        <Route path="whatsapp-orders" element={<AdminWhatsAppOrders />} />
        <Route path="bulk-sms" element={<AdminBulkSms />} />
        <Route path="sms-logs" element={<AdminSmsLogs />} />
        <Route path="spin-report" element={<AdminSpinReport />} />
        <Route path="free-data" element={<AdminFreeData />} />
        <Route path="database" element={<AdminDatabaseStudio />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <RouteTracker />
          <GlobalSupportChatModal />
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
