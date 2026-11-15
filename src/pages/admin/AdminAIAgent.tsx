import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Bot,
  Send,
  Sparkles,
  Key,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Cpu,
  Layers,
  ShieldCheck,
  Eye,
  EyeOff,
  Terminal,
  Save,
  MessageSquare,
  Zap,
  BrainCircuit,
} from "lucide-react";
import { invokeApiFunction, supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  provider?: string;
  modelUsed?: string;
  timestamp: string;
}

export default function AdminAIAgent() {
  const [activeTab, setActiveTab] = useState<"keys" | "chat">("keys");

  // AI Provider Keys and Models State
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [geminiKey, setGeminiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("gemini-3.8-flash");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiTestStatus, setGeminiTestStatus] = useState<{ success: boolean; message: string } | null>(null);

  const [grokKey, setGrokKey] = useState("");
  const [grokModel, setGrokModel] = useState("llama-3.3-70b-versatile");
  const [showGrokKey, setShowGrokKey] = useState(false);
  const [testingGrok, setTestingGrok] = useState(false);
  const [grokTestStatus, setGrokTestStatus] = useState<{ success: boolean; message: string } | null>(null);

  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [testingOpenai, setTestingOpenai] = useState(false);
  const [openaiTestStatus, setOpenaiTestStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Live Test Playground Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-admin-sim",
      sender: "ai",
      text: "Hello Bossu! 👋 I am your automated Customer Care AI simulator for Data One.\n\nYou can test how I answer real customer queries about bundle prices, instant delivery time, or tracking an order. I strictly follow your custom training instructions and rotate between Gemini, Groq, and OpenAI!",
      provider: "System",
      modelUsed: "Primary Dispatcher",
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    },
  ]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatListContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAISettings();
  }, []);

  useEffect(() => {
    if (chatListContainerRef.current) {
      chatListContainerRef.current.scrollTop = chatListContainerRef.current.scrollHeight;
    }
  }, [messages, chatLoading]);

  const fetchAISettings = async () => {
    setLoadingSettings(true);
    setError("");

    try {
      // 1. Try invokeApiFunction
      const res = await invokeApiFunction("admin-ai-settings", {
        method: "GET",
      });

      if (res?.data?.settings) {
        const s = res.data.settings;
        if (s.gemini_api_key_masked) setGeminiKey(s.gemini_api_key_masked);
        else if (s.gemini_api_key) setGeminiKey(s.gemini_api_key);
        if (s.gemini_model) setGeminiModel(s.gemini_model);

        const gKey = s.groq_api_key_masked || s.grok_api_key_masked || s.groq_api_key || s.grok_api_key || "";
        if (gKey) setGrokKey(gKey);
        if (s.groq_model || s.grok_model) setGrokModel(s.groq_model || s.grok_model);

        if (s.openai_api_key_masked) setOpenaiKey(s.openai_api_key_masked);
        else if (s.openai_api_key) setOpenaiKey(s.openai_api_key);
        if (s.openai_model) setOpenaiModel(s.openai_model);

        setLoadingSettings(false);
        return;
      }
    } catch (_) {}

    // 2. Direct database query fallback
    try {
      const { data: rows } = await supabase
        .from("settings")
        .select("key,value")
        .in("key", ["gemini_api_key", "gemini_model", "groq_api_key", "grok_api_key", "groq_model", "grok_model", "openai_api_key", "openai_model", "primary_ai_provider"]);
      const sMap: Record<string, string> = {};
      for (const r of rows || []) {
        if (r.key) sMap[r.key] = r.value ?? "";
      }

      const maskKey = (k?: string) => {
        if (!k || k.length < 8) return k ? "••••••••" : "";
        return k.slice(0, 4) + "••••••••" + k.slice(-4);
      };

      if (sMap.gemini_api_key) setGeminiKey(maskKey(sMap.gemini_api_key));
      if (sMap.gemini_model) setGeminiModel(sMap.gemini_model);

      const groq = sMap.groq_api_key || sMap.grok_api_key || "";
      if (groq) setGrokKey(maskKey(groq));
      if (sMap.groq_model || sMap.grok_model) setGrokModel(sMap.groq_model || sMap.grok_model);

      if (sMap.openai_api_key) setOpenaiKey(maskKey(sMap.openai_api_key));
      if (sMap.openai_model) setOpenaiModel(sMap.openai_model);
    } catch (e: any) {
      setError("Failed to load AI settings: " + (e?.message || "Unknown error"));
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleTestProvider = async (provider: "gemini" | "groq" | "grok" | "openai") => {
    let keyToTest = "";
    let modelToTest = "";

    if (provider === "gemini") {
      keyToTest = geminiKey;
      modelToTest = geminiModel;
      setTestingGemini(true);
      setGeminiTestStatus(null);
    } else if (provider === "groq" || provider === "grok") {
      keyToTest = grokKey;
      modelToTest = grokModel;
      setTestingGrok(true);
      setGrokTestStatus(null);
    } else if (provider === "openai") {
      keyToTest = openaiKey;
      modelToTest = openaiModel;
      setTestingOpenai(true);
      setOpenaiTestStatus(null);
    }

    try {
      const res = await invokeApiFunction("admin-ai-settings", {
        body: {
          action: "testAiProvider",
          provider,
          api_key: keyToTest,
          model: modelToTest,
        },
      });

      if (res?.error) {
        throw res.error;
      }

      const data = res?.data || {};
      const statusObj = {
        success: Boolean(data.success),
        message: data.message || (data.success ? "Connection successful!" : data.error || "Connection failed"),
      };

      if (provider === "gemini") setGeminiTestStatus(statusObj);
      else if (provider === "groq" || provider === "grok") setGrokTestStatus(statusObj);
      else if (provider === "openai") setOpenaiTestStatus(statusObj);

      if (statusObj.success) {
        toast.success(statusObj.message);
      } else {
        toast.error(statusObj.message);
      }
    } catch (err: any) {
      const errObj = { success: false, message: err?.message || "Network error" };
      if (provider === "gemini") setGeminiTestStatus(errObj);
      else if (provider === "groq" || provider === "grok") setGrokTestStatus(errObj);
      else if (provider === "openai") setOpenaiTestStatus(errObj);
      toast.error(errObj.message);
    } finally {
      if (provider === "gemini") setTestingGemini(false);
      else if (provider === "groq" || provider === "grok") setTestingGrok(false);
      else if (provider === "openai") setTestingOpenai(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setNotice("");
    setError("");

    const payload: any = {
      action: "saveAiSettings",
      gemini_model: geminiModel.trim(),
      groq_model: grokModel.trim(),
      openai_model: openaiModel.trim(),
    };

    if (geminiKey && !geminiKey.includes("••••")) payload.gemini_api_key = geminiKey.trim();
    if (grokKey && !grokKey.includes("••••")) {
      payload.groq_api_key = grokKey.trim();
      payload.grok_api_key = grokKey.trim();
    }
    if (openaiKey && !openaiKey.includes("••••")) payload.openai_api_key = openaiKey.trim();

    try {
      const res = await invokeApiFunction("admin-ai-settings", {
        body: payload,
      });

      if (res?.data?.success) {
        setNotice("AI configuration saved successfully!");
        toast.success("AI configuration saved successfully!");
        await fetchAISettings();
        return;
      }
    } catch (_) {}

    // Fallback direct upsert
    try {
      const rows: Array<{ key: string; value: string }> = [
        { key: "gemini_model", value: geminiModel.trim() },
        { key: "groq_model", value: grokModel.trim() },
        { key: "grok_model", value: grokModel.trim() },
        { key: "openai_model", value: openaiModel.trim() },
      ];

      if (payload.gemini_api_key) rows.push({ key: "gemini_api_key", value: payload.gemini_api_key });
      if (payload.groq_api_key) {
        rows.push({ key: "groq_api_key", value: payload.groq_api_key });
        rows.push({ key: "grok_api_key", value: payload.groq_api_key });
      }
      if (payload.openai_api_key) rows.push({ key: "openai_api_key", value: payload.openai_api_key });

      const { error: dbErr } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
      if (dbErr) throw dbErr;

      setNotice("AI configuration saved successfully!");
      toast.success("AI configuration saved successfully!");
      await fetchAISettings();
    } catch (err: any) {
      setError(err?.message || "Failed to save AI configuration");
      toast.error(err?.message || "Failed to save AI configuration");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendChat = async (promptToSend?: string) => {
    const text = (promptToSend || input).trim();
    if (!text || chatLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!promptToSend) setInput("");
    setChatLoading(true);

    try {
      const chatHistory = messages.map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text,
      }));

      const res = await invokeApiFunction("ai-chat", {
        body: {
          message: text,
          history: chatHistory,
        },
      });

      const data = res?.data || {};
      const aiReply = data.reply || "I received your message bossu!";

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: aiReply,
        provider: data.provider || "gemini",
        modelUsed: data.modelUsed || geminiModel,
        timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: "ai",
          text: `⚠️ Test error: ${err?.message || "Could not reach AI endpoint"}`,
          provider: "Local Simulator",
          modelUsed: "Error Fallback",
          timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-16">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
              <Bot className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              AI Models &amp; API Keys
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Configure multi-tier AI models (Google Gemini, Groq / xAI Grok, OpenAI), select active models, and test connections.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/admin/ai-instructions"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground font-black text-xs sm:text-sm shadow-md hover:opacity-90 transition-all"
          >
            <BrainCircuit className="w-4 h-4" />
            <span>AI Training &amp; Prompts</span>
          </Link>
        </div>
      </div>

      {/* NOTICES */}
      {notice && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-semibold flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs sm:text-sm font-semibold flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TAB SELECTOR */}
      <div className="flex items-center gap-2 p-1.5 bg-card border border-border rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("keys")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === "keys"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Key className="w-4 h-4" />
          <span>AI Provider Keys &amp; Models</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("chat")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === "chat"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Customer Care Live Simulator</span>
        </button>
      </div>

      {/* TAB 1: KEYS & MODELS CONFIGURATION */}
      {activeTab === "keys" && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* PRIORITY ROUTING BANNER */}
          <div className="p-4 rounded-2xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-foreground block">Active Multi-Tier Failover Engine</span>
                <span className="text-[11px] text-muted-foreground">
                  1. Google Gemini ➔ 2. Groq Cloud / xAI ➔ 3. OpenAI ➔ 4. Free Open LLM ➔ 5. Local Engine
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={fetchAISettings}
              disabled={loadingSettings}
              className="px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer w-fit"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSettings ? "animate-spin" : ""}`} />
              <span>Reload</span>
            </button>
          </div>

          {/* 1. GOOGLE GEMINI CARD */}
          <div className="rounded-3xl bg-card border border-blue-500/30 p-5 sm:p-6 space-y-4 shadow-sm relative overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 absolute top-0 left-0" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 font-black text-xs">
                  PRIORITY 1
                </div>
                <div>
                  <h3 className="font-extrabold text-foreground text-base">Google Gemini (Recommended)</h3>
                  <p className="text-xs text-muted-foreground">
                    Superfast 4G/5G mobile response speed with generous free quotas on Google AI Studio.
                  </p>
                </div>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 shrink-0"
              >
                <span>Get Free Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Gemini API Key</span>
                  <span className="text-[10px] text-muted-foreground">Starts with AIzaSy...</span>
                </label>
                <div className="relative">
                  <input
                    type={showGeminiKey ? "text" : "password"}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Active Gemini Model</label>
                <select
                  value={
                    [
                      "gemini-3.8-flash",
                      "gemini-3.7-flash",
                      "gemini-3.6-flash",
                      "gemini-3.1-pro-preview",
                      "gemini-3.1-flash-lite",
                      "gemini-flash-latest",
                    ].includes(geminiModel)
                      ? geminiModel
                      : "custom"
                  }
                  onChange={(e) => {
                    if (e.target.value !== "custom") setGeminiModel(e.target.value);
                  }}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="gemini-3.8-flash">⚡ gemini-3.8-flash (Recommended · Latest 2026 Flash)</option>
                  <option value="gemini-3.7-flash">🧠 gemini-3.7-flash (Next-Gen Reasoning Flash)</option>
                  <option value="gemini-3.6-flash">🚀 gemini-3.6-flash (Workhorse Multimodal)</option>
                  <option value="gemini-3.1-pro-preview">🔬 gemini-3.1-pro-preview (Deep Reasoning Pro)</option>
                  <option value="gemini-3.1-flash-lite">🪶 gemini-3.1-flash-lite (Fast & Lightweight)</option>
                  <option value="gemini-flash-latest">✨ gemini-flash-latest (Auto-updating Stable)</option>
                  <option value="custom">✏️ Enter Custom Model Name...</option>
                </select>

                <input
                  type="text"
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  placeholder="e.g. gemini-3.8-flash"
                  className="mt-1.5 w-full px-3 py-1.5 bg-background border border-border rounded-lg text-blue-400 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  title="Active model string sent to Gemini API"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleTestProvider("gemini")}
                disabled={testingGemini || !geminiKey.trim()}
                className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold border border-border transition-colors flex items-center gap-2 disabled:opacity-40 cursor-pointer w-fit"
              >
                {testingGemini ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-blue-400" />}
                <span>Test Google Gemini Connection</span>
              </button>

              {geminiTestStatus && (
                <span
                  className={`text-xs font-semibold ${
                    geminiTestStatus.success ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {geminiTestStatus.message}
                </span>
              )}
            </div>
          </div>

          {/* 2. GROQ CLOUD LPU / xAI GROK CARD */}
          <div className="rounded-3xl bg-card border border-amber-500/30 p-5 sm:p-6 space-y-4 shadow-sm relative overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-500 absolute top-0 left-0" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 font-black text-xs">
                  PRIORITY 2
                </div>
                <div>
                  <h3 className="font-extrabold text-foreground text-base">Groq Cloud LPU / xAI Grok</h3>
                  <p className="text-xs text-muted-foreground">
                    Blazing-fast inference on Llama 3.3 70B &amp; Grok.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 shrink-0"
                >
                  <span>Groq Keys</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href="https://console.x.ai"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 shrink-0"
                >
                  <span>xAI Keys</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Groq / xAI API Key</span>
                  <span className="text-[10px] text-muted-foreground">gsk_... or xai-...</span>
                </label>
                <div className="relative">
                  <input
                    type={showGrokKey ? "text" : "password"}
                    value={grokKey}
                    onChange={(e) => setGrokKey(e.target.value)}
                    placeholder="gsk_... or xai-..."
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGrokKey(!showGrokKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showGrokKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Active Groq / xAI Model</label>
                <select
                  value={
                    [
                      "llama-3.3-70b-versatile",
                      "llama-3.1-8b-instant",
                      "mixtral-8x7b-32768",
                      "grok-2-latest",
                    ].includes(grokModel)
                      ? grokModel
                      : "custom"
                  }
                  onChange={(e) => {
                    if (e.target.value !== "custom") setGrokModel(e.target.value);
                  }}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                >
                  <option value="llama-3.3-70b-versatile">⚡ llama-3.3-70b-versatile (Recommended · 70B Fast LPU)</option>
                  <option value="llama-3.1-8b-instant">🚀 llama-3.1-8b-instant (Sub-second Instant)</option>
                  <option value="mixtral-8x7b-32768">🔮 mixtral-8x7b-32768 (Mixture of Experts)</option>
                  <option value="grok-2-latest">🤖 grok-2-latest (xAI Grok 2)</option>
                  <option value="custom">✏️ Enter Custom Model Name...</option>
                </select>

                <input
                  type="text"
                  value={grokModel}
                  onChange={(e) => setGrokModel(e.target.value)}
                  placeholder="e.g. llama-3.3-70b-versatile"
                  className="mt-1.5 w-full px-3 py-1.5 bg-background border border-border rounded-lg text-amber-400 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  title="Active model string sent to Groq or xAI"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleTestProvider("groq")}
                disabled={testingGrok || !grokKey.trim()}
                className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold border border-border transition-colors flex items-center gap-2 disabled:opacity-40 cursor-pointer w-fit"
              >
                {testingGrok ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
                <span>Test Groq / Grok Connection</span>
              </button>

              {grokTestStatus && (
                <span
                  className={`text-xs font-semibold ${
                    grokTestStatus.success ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {grokTestStatus.message}
                </span>
              )}
            </div>
          </div>

          {/* 3. OPENAI CARD */}
          <div className="rounded-3xl bg-card border border-emerald-500/30 p-5 sm:p-6 space-y-4 shadow-sm relative overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-green-500 absolute top-0 left-0" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 font-black text-xs">
                  PRIORITY 3
                </div>
                <div>
                  <h3 className="font-extrabold text-foreground text-base">OpenAI (ChatGPT Models)</h3>
                  <p className="text-xs text-muted-foreground">
                    Reliable industry benchmark for customer care dialogue.
                  </p>
                </div>
              </div>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 shrink-0"
              >
                <span>OpenAI Keys</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>OpenAI API Key</span>
                  <span className="text-[10px] text-muted-foreground">Starts with sk-...</span>
                </label>
                <div className="relative">
                  <input
                    type={showOpenaiKey ? "text" : "password"}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Active OpenAI Model</label>
                <select
                  value={
                    ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"].includes(openaiModel)
                      ? openaiModel
                      : "custom"
                  }
                  onChange={(e) => {
                    if (e.target.value !== "custom") setOpenaiModel(e.target.value);
                  }}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                >
                  <option value="gpt-4o-mini">⚡ gpt-4o-mini (Recommended · High Intelligence &amp; Low Cost)</option>
                  <option value="gpt-4o">🌟 gpt-4o (Flagship Omnimodel)</option>
                  <option value="gpt-3.5-turbo">📦 gpt-3.5-turbo (Legacy)</option>
                  <option value="custom">✏️ Enter Custom Model Name...</option>
                </select>

                <input
                  type="text"
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  placeholder="e.g. gpt-4o-mini"
                  className="mt-1.5 w-full px-3 py-1.5 bg-background border border-border rounded-lg text-emerald-400 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  title="Active model string sent to OpenAI"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleTestProvider("openai")}
                disabled={testingOpenai || !openaiKey.trim()}
                className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold border border-border transition-colors flex items-center gap-2 disabled:opacity-40 cursor-pointer w-fit"
              >
                {testingOpenai ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-emerald-400" />}
                <span>Test OpenAI Connection</span>
              </button>

              {openaiTestStatus && (
                <span
                  className={`text-xs font-semibold ${
                    openaiTestStatus.success ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {openaiTestStatus.message}
                </span>
              )}
            </div>
          </div>

          {/* SAVE BUTTON */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="py-3 px-8 rounded-2xl bg-primary text-primary-foreground font-black text-sm shadow-lg flex items-center gap-2 transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save AI Configuration</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: LIVE TEST PLAYGROUND */}
      {activeTab === "chat" && (
        <div className="bg-card border border-border rounded-3xl shadow-lg flex flex-col h-[650px] overflow-hidden">
          {/* HEADER */}
          <div className="p-4 bg-muted/40 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Bot className="w-5 h-5 text-primary" />
              <span className="font-bold text-foreground text-sm">Customer Care AI Live Simulator</span>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              Priority: Gemini ➔ Groq ➔ OpenAI
            </span>
          </div>

          {/* MESSAGES LIST */}
          <div ref={chatListContainerRef} className="flex-1 p-5 overflow-y-auto space-y-4 text-xs sm:text-sm font-sans">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-4 leading-relaxed whitespace-pre-wrap shadow-sm ${
                    m.sender === "user"
                      ? "bg-primary text-primary-foreground font-semibold rounded-br-none"
                      : "bg-muted/60 border border-border text-foreground rounded-bl-none"
                  }`}
                >
                  {m.text}
                </div>
                <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-muted-foreground font-mono">
                  <span>{m.timestamp}</span>
                  {m.provider && (
                    <span className="text-primary font-bold uppercase">
                      • Answered by: {m.provider} ({m.modelUsed})
                    </span>
                  )}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs py-2 px-3 bg-muted rounded-xl w-fit border border-border animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span>AI is thinking &amp; formatting reply...</span>
              </div>
            )}
          </div>

          {/* QUICK PROMPT CHIPS */}
          <div className="px-4 py-2 bg-muted/20 border-t border-border flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => handleSendChat("What are your MTN data bundle rates?")}
              className="px-3 py-1.5 rounded-xl bg-card hover:bg-muted border border-border text-[11px] text-foreground whitespace-nowrap cursor-pointer transition-colors"
            >
              📱 MTN Rates
            </button>
            <button
              onClick={() => handleSendChat("How long does delivery take?")}
              className="px-3 py-1.5 rounded-xl bg-card hover:bg-muted border border-border text-[11px] text-foreground whitespace-nowrap cursor-pointer transition-colors"
            >
              ⚡ Delivery Time
            </button>
            <button
              onClick={() => handleSendChat("Track order ORD-123456")}
              className="px-3 py-1.5 rounded-xl bg-card hover:bg-muted border border-border text-[11px] text-foreground whitespace-nowrap cursor-pointer transition-colors"
            >
              🔍 Track ORD-123456
            </button>
            <button
              onClick={() => handleSendChat("How do I check my MTN or Telecel balance?")}
              className="px-3 py-1.5 rounded-xl bg-card hover:bg-muted border border-border text-[11px] text-foreground whitespace-nowrap cursor-pointer transition-colors"
            >
              📶 Balance Codes
            </button>
            <button
              onClick={() => handleSendChat("Can I get a refund if I entered a wrong number?")}
              className="px-3 py-1.5 rounded-xl bg-card hover:bg-muted border border-border text-[11px] text-foreground whitespace-nowrap cursor-pointer transition-colors"
            >
              ⚠️ Wrong Number Policy
            </button>
          </div>

          {/* INPUT FORM */}
          <div className="p-4 bg-muted/40 border-t border-border">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question or enter customer test prompt..."
                className="flex-1 bg-background border border-border rounded-2xl px-4 py-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={!input.trim() || chatLoading}
                className="py-3 px-5 rounded-2xl bg-primary hover:opacity-90 text-primary-foreground font-bold text-xs sm:text-sm shadow-sm transition-all disabled:opacity-40 flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
