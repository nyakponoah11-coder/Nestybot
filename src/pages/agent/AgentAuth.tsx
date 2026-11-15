import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { invokeApiFunction } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Store,
  Sparkles,
  ArrowRight,
  Loader2,
  Lock,
  Mail,
  User,
  Phone,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  ChevronLeft,
  KeyRound
} from "lucide-react";
import { toast } from "sonner";

export const AgentAuth: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine initial mode from path or search
  const isRegisterInitial = location.pathname.includes("register") || location.search.includes("register");
  const [isRegister, setIsRegister] = useState(isRegisterInitial);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Forgot Password State
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<"request" | "reset">("request");
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [forgotAgentId, setForgotAgentId] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotCountdown, setForgotCountdown] = useState(0);

  useEffect(() => {
    if (forgotCountdown <= 0) return;
    const interval = setInterval(() => {
      setForgotCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [forgotCountdown]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const ident = forgotIdentifier.trim();
    if (!ident) {
      toast.error("Please enter your registered email or phone.");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await invokeApiFunction("agent", {
        body: {
          action: "forgotPassword",
          identifier: ident,
        },
      });
      if (res?.data?.ok) {
        toast.success(res.data.message || "Reset code sent to your email & SMS!");
        setForgotAgentId(res.data.agent_id || "");
        setForgotStep("reset");
        setForgotCountdown(60);
      } else {
        toast.error(res?.data?.error || "Account not found.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to send reset code.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotCode.trim() || !forgotNewPassword.trim()) {
      toast.error("Please enter the verification code and your new password.");
      return;
    }
    if (forgotNewPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await invokeApiFunction("agent", {
        body: {
          action: "resetPassword",
          agent_id: forgotAgentId || undefined,
          identifier: forgotIdentifier.trim(),
          code: forgotCode.trim(),
          new_password: forgotNewPassword.trim(),
        },
      });
      if (res?.data?.ok) {
        toast.success(res.data.message || "Password reset successfully! Please sign in.");
        setForgotOpen(false);
        setForgotStep("request");
        setForgotCode("");
        setPassword(forgotNewPassword.trim());
      } else {
        toast.error(res?.data?.error || "Password reset failed.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to reset password.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Check if already logged in
  useEffect(() => {
    document.title = isRegister ? "Register as Agent · Data1gh" : "Agent Login · Data1gh";
    const existing = localStorage.getItem("data1_agent_profile");
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (parsed?.id) {
          navigate("/agent/dashboard", { replace: true });
        }
      } catch {}
    }
  }, [navigate, isRegister]);

  // Auto-slugify store name as user types
  const handleStoreNameChange = (val: string) => {
    setStoreName(val);
    if (!storeSlug || storeSlug === slugify(storeName)) {
      setStoreSlug(slugify(val));
    }
  };

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      if (isRegister) {
        if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) {
          setErrorMsg("Please complete all required fields.");
          setLoading(false);
          return;
        }

        const res = await invokeApiFunction("agent", {
          body: {
            action: "register",
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            password: password.trim(),
            store_name: (storeName.trim() || `${name.trim()}'s Data Hub`),
            store_slug: (storeSlug.trim() || slugify(name)),
          },
          timeoutMs: 35000,
        });

        if (res?.data?.ok && res.data.agent) {
          localStorage.setItem("data1_agent_token", res.data.agent.id);
          localStorage.setItem("data1_agent_profile", JSON.stringify(res.data.agent));
          toast.success("Welcome to Data1gh Reseller Program!");
          navigate("/agent/dashboard", { replace: true });
        } else {
          // If the network request timed out or was aborted, OR the account was already created
          // right before the timeout, immediately auto-login so the user is never stranded with an error!
          const isTimeoutOrExists =
            res?.error?.message?.toLowerCase().includes("timed out") ||
            res?.error?.message?.toLowerCase().includes("aborted") ||
            res?.data?.error?.toLowerCase().includes("already exists");

          if (isTimeoutOrExists) {
            try {
              const verifyRes = await invokeApiFunction("agent", {
                body: {
                  action: "login",
                  identifier: email.trim(),
                  password: password.trim(),
                },
                timeoutMs: 20000,
              });
              if (verifyRes?.data?.ok && verifyRes.data.agent) {
                localStorage.setItem("data1_agent_token", verifyRes.data.agent.id);
                localStorage.setItem("data1_agent_profile", JSON.stringify(verifyRes.data.agent));
                toast.success("Welcome to Data1gh Reseller Program!");
                navigate("/agent/dashboard", { replace: true });
                return;
              }
            } catch (_) {}
          }

          const err = res?.data?.error || res?.error?.message || "Registration failed. Please try again.";
          setErrorMsg(err);
          toast.error(err);
        }
      } else {
        // Login
        if (!email.trim() || !password.trim()) {
          setErrorMsg("Please enter your email/phone and password.");
          setLoading(false);
          return;
        }

        const res = await invokeApiFunction("agent", {
          body: {
            action: "login",
            identifier: email.trim(),
            password: password.trim(),
          },
          timeoutMs: 30000,
        });

        if (res?.data?.ok && res.data.agent) {
          localStorage.setItem("data1_agent_token", res.data.agent.id);
          localStorage.setItem("data1_agent_profile", JSON.stringify(res.data.agent));
          toast.success(`Welcome back, ${res.data.agent.name}!`);
          navigate("/agent/dashboard", { replace: true });
        } else {
          const err = res?.data?.error || res?.error?.message || "Invalid login credentials.";
          setErrorMsg(err);
          toast.error(err);
        }
      }
    } catch (err: any) {
      const msg = err?.message || "An unexpected error occurred.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-y-auto flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-cyan-500 selection:text-black">
      {/* Ambient background glows */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 size-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 size-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

      {/* Top Bar Back Link */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
        >
          <ChevronLeft className="size-4" />
          <span>Back to Main Shop</span>
        </Link>
        <span className="text-[11px] font-mono text-cyan-400/80 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
          Data1gh Agents
        </span>
      </div>

      <Card className="w-full max-w-md overflow-hidden rounded-3xl border border-cyan-500/30 bg-zinc-950 text-white shadow-[0_8px_40px_rgba(6,182,212,0.15)]">
        {/* Glow Header Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400" />

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="size-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(6,182,212,0.3)]">
              <Store className="size-6" />
            </div>

            <h1 className="text-2xl font-black tracking-tight text-white">
              {isRegister ? "Become an Official Agent" : "Agent Portal Sign In"}
            </h1>

            <p className="text-xs text-zinc-400">
              {isRegister
                ? "Start reselling MTN, Telecel & AT bundles at your own chosen prices."
                : "Manage your custom prices, track today's profit, and withdraw earnings."}
            </p>
          </div>

          {/* Toggle Switch between Register and Login */}
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-white/[0.05] border border-white/10 text-xs font-bold">
            <button
              type="button"
              onClick={() => { setIsRegister(true); setErrorMsg(""); }}
              className={`py-2 rounded-xl transition-all ${
                isRegister
                  ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-black shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Register New Agent
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(false); setErrorMsg(""); }}
              className={`py-2 rounded-xl transition-all ${
                !isRegister
                  ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-black shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="agent_name" className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <User className="size-3.5 text-cyan-400" />
                    Full Name
                  </Label>
                  <Input
                    id="agent_name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Kwame Mensah"
                    className="bg-white/[0.04] border-white/15 focus-visible:ring-cyan-500 text-white placeholder:text-zinc-600 rounded-xl text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="agent_store_name" className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Store className="size-3.5 text-emerald-400" />
                    Store / Brand Name
                  </Label>
                  <Input
                    id="agent_store_name"
                    required
                    value={storeName}
                    onChange={(e) => handleStoreNameChange(e.target.value)}
                    placeholder="e.g. KM Express Data"
                    className="bg-white/[0.04] border-white/15 focus-visible:ring-cyan-500 text-white placeholder:text-zinc-600 rounded-xl text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="agent_slug" className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                    <span>Store Link Handle</span>
                    <span className="text-[10px] text-cyan-400 font-mono">{(typeof window !== "undefined" && window.location.host.includes("gooddata") ? window.location.host : "gooddata1.vercel.app")}/s/{storeSlug || "yourname"}</span>
                  </Label>
                  <Input
                    id="agent_slug"
                    required
                    value={storeSlug}
                    onChange={(e) => setStoreSlug(slugify(e.target.value))}
                    placeholder="e.g. km-express"
                    className="bg-white/[0.04] border-white/15 focus-visible:ring-cyan-500 font-mono text-cyan-300 placeholder:text-zinc-600 rounded-xl text-xs"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="agent_email" className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Mail className="size-3.5 text-cyan-400" />
                {isRegister ? "Email Address" : "Email or Phone Number"}
              </Label>
              <Input
                id="agent_email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isRegister ? "e.g. agent@gmail.com" : "054xxxxxxx or your@email.com"}
                className="bg-white/[0.04] border-white/15 focus-visible:ring-cyan-500 text-white placeholder:text-zinc-600 rounded-xl text-sm"
              />
            </div>

            {isRegister && (
              <div className="space-y-1.5">
                <Label htmlFor="agent_phone" className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Phone className="size-3.5 text-emerald-400" />
                  Ghana MoMo / Phone Number
                </Label>
                <Input
                  id="agent_phone"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0541234567"
                  className="bg-white/[0.04] border-white/15 focus-visible:ring-cyan-500 text-white placeholder:text-zinc-600 rounded-xl text-sm"
                />
                <p className="text-[11px] text-zinc-500">Used for your profit payouts and instant order notifications.</p>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="agent_password" className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Lock className="size-3.5 text-cyan-400" />
                  Password
                </Label>
                {!isRegister && (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotIdentifier(email);
                      setForgotOpen(true);
                      setForgotStep("request");
                    }}
                    className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline font-semibold"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  id="agent_password"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-white/[0.04] border-white/15 focus-visible:ring-cyan-500 text-white placeholder:text-zinc-600 rounded-xl text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:opacity-95 text-black font-black text-sm tracking-wide shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  {isRegister ? "Creating Account..." : "Signing In..."}
                </>
              ) : (
                <>
                  <span>{isRegister ? "Complete Free Registration" : "Sign In to Dashboard"}</span>
                  <ArrowRight className="size-4 ml-1.5" />
                </>
              )}
            </Button>
          </form>

          {/* Perks footer */}
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5 text-[11px] text-zinc-400">
            <div className="flex items-center gap-1.5 text-zinc-300 font-semibold">
              <ShieldCheck className="size-3.5 text-emerald-400" />
              <span>Reseller Guarantees</span>
            </div>
            <ul className="space-y-1 text-zinc-400 pl-4 list-disc">
              <li>100% automated delivery directly to your clients</li>
              <li>Withdraw your profits anytime to MTN, Telecel, or AT MoMo</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Forgot Password Modal */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-md bg-zinc-950 border border-white/15 text-white rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <div className="size-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-2">
              <KeyRound className="size-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-white">
              {forgotStep === "request" ? "Reset Your Agent Password" : "Enter Verification Code"}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              {forgotStep === "request"
                ? "Enter your registered email address or phone number. We'll send a 6-digit verification code via email & SMS to reset your password."
                : "Enter the 6-digit verification code sent to your email and phone (SMS), along with your new password."}
            </DialogDescription>
          </DialogHeader>

          {forgotStep === "request" ? (
            <form onSubmit={handleRequestReset} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="forgot_id" className="text-xs font-semibold text-zinc-300">
                  Registered Email or Phone Number
                </Label>
                <Input
                  id="forgot_id"
                  required
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  placeholder="e.g. agent@gmail.com or 0541234567"
                  className="bg-white/[0.04] border-white/15 focus-visible:ring-cyan-500 text-white rounded-xl text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setForgotOpen(false)}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={forgotLoading}
                  className="rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs px-4 h-10 gap-1.5"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Sending Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Reset Code</span>
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCompleteReset} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="reset_code" className="text-xs font-semibold text-zinc-300">
                    6-Digit Verification Code
                  </Label>
                  <button
                    type="button"
                    disabled={forgotLoading || forgotCountdown > 0}
                    onClick={handleRequestReset}
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 disabled:opacity-50 hover:underline"
                  >
                    {forgotCountdown > 0 ? `Resend in ${forgotCountdown}s` : "Resend Code"}
                  </button>
                </div>
                <Input
                  id="reset_code"
                  required
                  maxLength={6}
                  value={forgotCode}
                  onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="bg-white/[0.04] border-white/15 focus-visible:ring-cyan-500 text-white font-mono tracking-widest text-center text-lg rounded-xl h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new_password" className="text-xs font-semibold text-zinc-300">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="new_password"
                    required
                    type={showForgotNewPassword ? "text" : "password"}
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="bg-white/[0.04] border-white/15 focus-visible:ring-cyan-500 text-white rounded-xl text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    {showForgotNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setForgotStep("request")}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={forgotLoading}
                  className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 text-black font-bold text-xs px-5 h-10 shadow-lg shadow-cyan-500/20"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1.5" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    "Save New Password"
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentAuth;
