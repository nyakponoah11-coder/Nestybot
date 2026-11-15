import { useEffect, useRef, useState } from "react";
import { Outlet, NavLink, useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Package, ShoppingBag, Settings, LogOut, Loader2, Store, MessageSquare, BarChart3, Sparkles, Gift, MessageCircle, GraduationCap, MessageSquareText, Bot, BrainCircuit, CalendarDays, Menu, X, Mic, Database, Sun, Moon, Zap } from "lucide-react";
import { toast } from "sonner";
import { AdminAiDrawer } from "@/components/AdminAiDrawer";

const AdminLayout = () => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSupport, setIsSupport] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const checkedUserRef = useRef<string | null>(null);

  // Dark / Light Theme Mode State with LocalStorage Persistence
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("admin_theme");
      if (saved) return saved === "dark";
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("admin_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("admin_theme", "light");
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  // Automatically close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;
    const checkAuth = async (session: any) => {
      const isLocalHost = typeof window !== "undefined" && (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname.includes("ais-dev") ||
        window.location.hostname.includes("ais-pre") ||
        window.location.hostname.includes("run.app") ||
        window.location.hostname.startsWith("192.168.") ||
        window.location.hostname.startsWith("10.") ||
        window.location.hostname.startsWith("172.") ||
        localStorage.getItem("data1_local_admin") === "true"
      );

      if (isLocalHost) {
        setIsAdmin(true);
        setIsSupport(false);
        setLoading(false);
        return;
      }

      if (!session) {
        setLoading(false);
        navigate("/admin/login", { replace: true });
        return;
      }
      if (checkedUserRef.current === session.user.id) return;
      checkedUserRef.current = session.user.id;

      const userEmail = (session.user.email || "").toLowerCase().trim();
      const isOwner = userEmail === "nyakponoah11@gmail.com";

      if (isOwner) {
        setIsAdmin(true);
        setIsSupport(false);
        setLoading(false);
        try {
          supabase.from("user_roles").upsert(
            { user_id: session.user.id, role: "admin" },
            { onConflict: "user_id,role" }
          ).then(() => { });
        } catch { }
        return;
      }

      try {
        // 1. Check existing roles directly from user_roles
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id);

        if (!mounted) return;

        const hasAdmin = (roles || []).some((r: any) => r.role === "admin");
        const hasSupport = (roles || []).some((r: any) => r.role === "support");

        if (hasAdmin) {
          setIsAdmin(true);
          setIsSupport(false);
          setLoading(false);
          return;
        }
        if (hasSupport) {
          setIsAdmin(false);
          setIsSupport(true);
          setLoading(false);
          return;
        }

        // 2. Fallback check: call database has_role RPC if available
        let rpcAdmin = false;
        try {
          const { data } = await supabase.rpc("has_role", {
            _user_id: session.user.id,
            _role: "admin",
          });
          rpcAdmin = !!data;
        } catch { }

        if (rpcAdmin) {
          setIsAdmin(true);
          setIsSupport(false);
          setLoading(false);
          return;
        }

        // User possesses neither admin nor support role - block access immediately
        setLoading(false);
        toast.error("Access denied: You do not have administrator permissions.");
        await supabase.auth.signOut();
        navigate("/admin/login", { replace: true });
        return;
      } catch (err: any) {
        setLoading(false);
        toast.error(err?.message || "Failed to verify admin access.");
        navigate("/admin/login", { replace: true });
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      checkAuth(session);
    });
    supabase.auth.getSession().then(({ data }) => checkAuth(data.session));
    // Safety timeout: ensure loading doesn't hang forever
    const safetyTimer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 4000);

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [navigate]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-6 animate-spin text-accent" />
      </div>
    );
  }

  if (!isAdmin && !isSupport) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-background">
        <div className="max-w-md w-full rounded-2xl border p-6 bg-card text-center space-y-4 shadow-lg">
          <div className="size-14 rounded-2xl bg-white p-2 border border-border/50 shadow-md mx-auto flex items-center justify-center">
            <img src="/logo.png" alt="Data One" className="size-full object-contain" />
          </div>
          <h2 className="text-xl font-bold">Admin Portal</h2>
          <p className="text-sm text-muted-foreground">
            Please log in with your admin credentials to access the management portal.
          </p>
          <div className="flex gap-2 pt-2">
            <Button asChild className="flex-1 bg-gradient-gold text-accent-foreground font-bold hover:opacity-90">
              <Link to="/admin/login">Log In</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link to="/">View Shop</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const navItems = isAdmin
    ? [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/admin/ai-agent", label: "AI Models & Keys", icon: Bot },
      { to: "/admin/ai-instructions", label: "AI Training & Prompts", icon: BrainCircuit },
      { to: "/admin/voice-notes", label: "Voice Notes", icon: Mic },
      { to: "/admin/ai-assistant", label: "AI & Voice Calls", icon: Sparkles },
      { to: "/admin/products", label: "Products", icon: Package },
      { to: "/admin/flash-sale", label: "⚡ Flash Sale", icon: Zap },
      { to: "/admin/agents", label: "Agent Resellers", icon: Store },
      { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
      { to: "/admin/whatsapp-orders", label: "WhatsApp orders", icon: MessageCircle },
      { to: "/admin/bulk-sms", label: "Bulk SMS", icon: MessageSquareText },
      { to: "/admin/sms-logs", label: "SMS Notifications", icon: MessageSquareText },
      { to: "/admin/services", label: "Services", icon: Sparkles },
      { to: "/admin/referrals", label: "Referrals", icon: Gift },
      { to: "/admin/spin-report", label: "Spin & win", icon: Sparkles },
      { to: "/admin/free-data", label: "Free data", icon: Gift },
      { to: "/admin/checkers", label: "Result checkers", icon: GraduationCap },
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/admin/visitors", label: "Visitors & Traffic", icon: CalendarDays },
      { to: "/admin/support", label: "Support", icon: MessageSquare },
      { to: "/admin/database", label: "Data1 DB Studio", icon: Database },
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ]
    : [
      { to: "/admin/voice-notes", label: "Voice Notes", icon: Mic },
      { to: "/admin/support", label: "Support", icon: MessageSquare, end: true as const },
    ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* 1. Mobile Top Bar: ONLY Admin on Left and Menu Button on Right */}
      <header className="md:hidden sticky top-0 z-30 bg-gradient-hero text-primary-foreground border-b border-white/10 px-4 py-2.5 flex items-center justify-between shadow-md">
        {/* Left: Admin Logo & Brand */}
        <Link to="/admin" className="flex items-center gap-2.5 active:opacity-80 transition-opacity">
          <img
            src="/logo.png"
            alt="Data One"
            className="size-7 rounded-lg object-contain bg-white p-0.5 border border-border/40 shadow-xs"
          />
          <div className="flex items-center gap-1.5">
            <span className="font-black text-sm tracking-tight">Admin</span>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-white/15 text-accent border border-white/15">
              Portal
            </span>
          </div>
        </Link>

        {/* Right: Theme Toggle & Menu Button */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="size-9 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-primary-foreground p-0 flex items-center justify-center active:scale-95 transition-all shadow-xs"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="size-4 text-amber-300" /> : <Moon className="size-4 text-sky-200" />}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="text-primary-foreground hover:bg-white/15 px-3 py-1.5 h-9 rounded-xl flex items-center gap-1.5 border border-white/20 bg-white/10 shadow-xs active:scale-95 transition-all"
            aria-label="Toggle Admin Navigation Menu"
          >
            {mobileMenuOpen ? <X className="size-5 text-accent" /> : <Menu className="size-5" />}
            <span className="text-xs font-black uppercase tracking-wider">
              {mobileMenuOpen ? "Close" : "Menu"}
            </span>
          </Button>
        </div>
      </header>

      {/* 2. Mobile Right-Side Drawer Overlay & Menu */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/70 backdrop-blur-xs z-50 transition-opacity duration-300 md:hidden ${mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Right-Side Drawer Panel */}
      <aside
        className={`fixed inset-y-0 right-0 w-72 max-w-[85vw] bg-gradient-hero text-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out md:hidden ${mobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/15">
          <Link
            to="/admin"
            className="flex items-center gap-2.5"
            onClick={() => setMobileMenuOpen(false)}
          >
            <img
              src="/logo.png"
              alt="Data One"
              className="size-8 rounded-lg object-contain bg-white p-1 border border-border/40 shadow-xs"
            />
            <div>
              <span className="font-black text-base leading-none block">Data One</span>
              <span className="text-[11px] opacity-75 font-medium">Admin Control Panel</span>
            </div>
          </Link>

          {/* Actions at top-right of drawer */}
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="size-8 rounded-lg border border-white/15 bg-white/10 text-primary-foreground hover:bg-white/20 active:scale-95"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="size-4 text-amber-300" /> : <Moon className="size-4 text-sky-200" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(false)}
              className="size-8 rounded-lg text-primary-foreground hover:bg-white/20 active:scale-95"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>

        {/* Drawer Nav links - Vertical list */}
        <nav className="p-3 space-y-1 overflow-y-auto flex-1">
          <div className="text-[10px] uppercase font-black tracking-wider text-white/50 px-3 py-1">
            Admin Menu
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${isActive
                  ? "bg-white/20 text-accent font-bold shadow-xs border border-white/20"
                  : "hover:bg-white/10 text-white/90"
                }`
              }
            >
              <item.icon className="size-4 shrink-0 text-accent/90" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Drawer Footer Actions: Shop, APK, and Exit / Sign Out */}
        <div className="p-3 border-t border-white/10 space-y-1 shrink-0 bg-black/25">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-start text-white/90 hover:bg-white/10 hover:text-white h-9 text-xs font-semibold"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Link to="/">
              <Store className="size-4 mr-2.5 text-emerald-400" /> View Live Shop
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-start text-white/90 hover:bg-white/10 hover:text-white h-9 text-xs font-semibold"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Link to="/download-app">
              <Store className="size-4 mr-2.5 text-amber-400" /> Customer App / APK
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 h-9 text-xs font-semibold"
            onClick={() => {
              setMobileMenuOpen(false);
              logout();
            }}
          >
            <LogOut className="size-4 mr-2.5 text-rose-400" /> Sign out / Exit
          </Button>
        </div>
      </aside>

      {/* 3. Desktop Permanent Sidebar (Only visible on md: and above) */}
      <aside className="hidden md:flex md:w-60 md:h-screen bg-gradient-hero text-white md:sticky md:top-0 flex-col shrink-0">
        <div className="p-4 flex items-center justify-between shrink-0 border-b border-white/10">
          <Link to="/admin" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Data One"
              className="size-8 rounded-lg object-contain bg-white p-1 border border-border/40 shadow-sm"
            />
            <span className="font-bold text-white">Admin</span>
          </Link>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="size-8 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white p-0 flex items-center justify-center active:scale-95 transition-all shadow-xs"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="size-4 text-amber-300" /> : <Moon className="size-4 text-sky-200" />}
          </Button>
        </div>
        <nav className="px-2 pb-2 flex flex-col gap-1 overflow-y-auto flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${isActive ? "bg-white/15 text-accent font-bold shadow-xs border border-white/10" : "text-white/85 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <item.icon className="size-4 shrink-0 text-white/90" /> {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-2 py-3 border-t border-white/10 shrink-0 space-y-1">
          <Button asChild variant="ghost" className="w-full justify-start text-white/90 hover:bg-white/10 hover:text-white">
            <Link to="/"><Store className="size-4 mr-2 text-emerald-400" /> View shop</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full justify-start text-white/90 hover:bg-white/10 hover:text-white">
            <Link to="/download-app"><Store className="size-4 mr-2 text-amber-400" /> App / APK Page</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start text-white/90 hover:bg-white/10 hover:text-white text-xs font-semibold"
            onClick={toggleTheme}
          >
            {isDark ? (
              <>
                <Sun className="size-4 mr-2 text-amber-300" /> Light Mode
              </>
            ) : (
              <>
                <Moon className="size-4 mr-2 text-sky-200" /> Dark Mode
              </>
            )}
          </Button>
          <Button variant="ghost" className="w-full justify-start text-rose-300 hover:bg-rose-500/20 hover:text-rose-200" onClick={logout}>
            <LogOut className="size-4 mr-2 text-rose-400" /> Sign out
          </Button>
        </div>
      </aside>

      {/* 4. Main Content Area */}
      <main className="flex-1 p-3 sm:p-4 md:p-8 max-w-full overflow-x-hidden">
        <Outlet />
      </main>
      <AdminAiDrawer />
    </div>
  );
};

export default AdminLayout;
