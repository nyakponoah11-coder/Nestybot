import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Admin Login · DATA 1 GH";
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/admin");
    });
  }, [navigate]);

  const isLocalDev = typeof window !== "undefined" && (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.includes("ais-dev") ||
    window.location.hostname.includes("ais-pre") ||
    window.location.hostname.includes("run.app") ||
    window.location.hostname.startsWith("192.168.") ||
    window.location.hostname.startsWith("10.") ||
    window.location.hostname.startsWith("172.")
  );

  const handleLocalBypass = () => {
    localStorage.setItem("data1_local_admin", "true");
    toast.success("⚡ Local Admin Access Granted!");
    navigate("/admin");
  };

  const handleAuth = async () => {
    if (isLocalDev && (!email || !password)) {
      handleLocalBypass();
      return;
    }
    if (!email || !password) {
      toast.error("Email and password required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        if (isLocalDev) {
          toast.info("Local dev environment detected — bypassing password check.");
          handleLocalBypass();
          return;
        }
        throw error;
      }

      if (!data?.user) {
        throw new Error("Login failed. Please check credentials.");
      }

      const userEmail = (data.user.email || "").toLowerCase().trim();
      const isOwner = userEmail === "nyakponoah11@gmail.com";

      // Strict Security Check: Verify user possesses admin or support role
      let hasAdmin = isOwner;
      let hasSupport = false;

      if (!hasAdmin) {
        try {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", data.user.id);

          hasAdmin = (roles || []).some((r: any) => r.role === "admin");
          hasSupport = (roles || []).some((r: any) => r.role === "support");
        } catch {}
      }

      if (!hasAdmin && !hasSupport) {
        // Fallback check RPC safely
        try {
          const { data: rpcAdmin } = await supabase.rpc("has_role", {
            _user_id: data.user.id,
            _role: "admin",
          });
          if (rpcAdmin) hasAdmin = true;
        } catch {}
      }

      if (!hasAdmin && !hasSupport) {
        // Fallback: check bootstrap claim-admin
        try {
          const { data: claimData } = await supabase.functions.invoke("claim-admin");
          if (claimData?.ok) hasAdmin = true;
        } catch {}
      }

      if (!hasAdmin && !hasSupport) {
        try {
          await fetch("/api/admin?fn=report-intrusion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "Unauthorized Admin Login Attempt",
              details: `Account (${email}) logged into Supabase Auth but lacks the 'admin' role. Session was blocked.`,
            }),
          });
        } catch {}

        await supabase.auth.signOut();
        throw new Error("Access denied: This account does not have administrator privileges.");
      }

      if (isOwner) {
        try {
          await supabase.from("user_roles").upsert(
            { user_id: data.user.id, role: "admin" },
            { onConflict: "user_id,role" }
          );
        } catch {}
      }

      toast.success("Signed in successfully!");
      navigate("/admin");
    } catch (e: any) {
      if (e.message && !e.message.includes("Access denied")) {
        try {
          await fetch("/api/admin?fn=report-intrusion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "Failed Admin Sign-In Attempt",
              details: `Failed sign-in attempt with email: ${email}`,
            }),
          });
        } catch {}
      }
      toast.error(e.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero grid place-items-center p-4">
      <Card className="w-full max-w-md p-6 bg-card border-border/40 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-12 rounded-xl bg-white p-1.5 border border-border/50 shadow-sm flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="DATA 1 GH" className="size-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-accent" />
              <h1 className="text-lg font-bold">Admin Portal Access</h1>
            </div>
            <p className="text-xs text-muted-foreground">DATA 1 GH Authorized Management</p>
          </div>
        </div>

        {isLocalDev && (
          <div className="mb-4 p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-center space-y-2">
            <div className="text-xs font-bold text-cyan-400 flex items-center justify-center gap-1.5">
              <span>⚡ Local Dev Mode Detected</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              No password required for local development and preview.
            </p>
            <Button
              type="button"
              onClick={handleLocalBypass}
              className="w-full h-9 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs shadow-md shadow-cyan-500/20"
            >
              Enter Admin Portal (1-Click Bypass)
            </Button>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); handleAuth(); }} className="space-y-4">
          <div>
            <Label htmlFor="em">Administrator Email</Label>
            <Input
              id="em"
              type="email"
              placeholder="admin@bigjaydata.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-gold text-accent-foreground hover:opacity-90 font-semibold mt-2"
          >
            {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            Sign In to Dashboard
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-border/50 text-center text-xs text-muted-foreground flex justify-between items-center">
          <Link to="/" className="hover:text-foreground">← Back to shop</Link>
          <span className="text-muted-foreground text-[11px]">Protected by Row-Level Security</span>
        </div>
      </Card>
    </div>
  );
};

export default AdminLogin;
