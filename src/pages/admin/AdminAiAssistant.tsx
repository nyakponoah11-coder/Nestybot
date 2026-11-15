import { useEffect, useState, useRef } from "react";
import { invokeApiFunction } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Sparkles,
  Bot,
  Send,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Clock,
  ShieldCheck,
  CreditCard,
  MessageSquare,
  Package,
  ArrowRight,
  Loader2,
  XCircle,
  HelpCircle,
  Smartphone,
  Mic,
  Phone,
  Headphones,
  ShoppingBag,
  Trash2,
  Cpu,
  Settings,
  BrainCircuit,
  Plus,
  Sliders,
  Zap,
  Copy,
  BookOpen,
  Edit3,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { AudioPlayer } from "@/components/AudioPlayer";
import { PhoneLink } from "@/components/PhoneLink";

const VERIFIED_GROQ_MODELS = [
  { value: "llama-3.3-70b-versatile", label: "🚀 Llama 3.3 70B Versatile", badge: "Recommended • Smartest • ~200ms" },
  { value: "llama-3.1-8b-instant", label: "⚡ Llama 3.1 8B Instant", badge: "Ultra Fast • ~50ms latency" },
  { value: "deepseek-r1-distill-llama-70b", label: "🔮 DeepSeek R1 Distill 70B", badge: "Reasoning • Groq LPUs" },
  { value: "llama3-70b-8192", label: "🦙 Llama 3 70B (8K)", badge: "High Intelligence" },
  { value: "llama3-8b-8192", label: "🦙 Llama 3 8B (8K)", badge: "Fast & Stable" },
  { value: "mixtral-8x7b-32768", label: "🧠 Mixtral 8x7B (32K)", badge: "High Context" },
  { value: "gemma2-9b-it", label: "💎 Gemma 2 9B Instruct", badge: "Google Gemma on Groq" },
  { value: "qwen-2.5-32b", label: "🌐 Qwen 2.5 32B", badge: "Multilingual & Coding" },
];

const VERIFIED_GEMINI_MODELS = [
  { value: "gemini-3.8-flash", label: "⚡ Gemini 3.8 Flash", badge: "Recommended • Newest 2026 Flash" },
  { value: "gemini-3.7-flash", label: "🧠 Gemini 3.7 Flash", badge: "Next-Gen Reasoning Flash" },
  { value: "gemini-3.6-flash", label: "🚀 Gemini 3.6 Flash", badge: "Workhorse Multimodal" },
  { value: "gemini-3.1-pro-preview", label: "🔬 Gemini 3.1 Pro", badge: "Deep Reasoning Pro" },
  { value: "gemini-3.1-flash-lite", label: "🪶 Gemini 3.1 Flash Lite", badge: "Fast & Lightweight" },
  { value: "gemini-flash-latest", label: "✨ Gemini Flash Latest", badge: "Auto-updating Stable Alias" },
];

interface SuggestedAction {
  action_type: string;
  action_label: string;
  payload: Record<string, any>;
  preview: string;
  requires_confirmation: boolean;
  confirmation_prompt?: string;
}

interface SystemIssue {
  id: string;
  category: "orders" | "services" | "inventory" | "support" | "wallet";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  entity_type?: string;
  reference?: string;
  customer_phone?: string;
  created_at?: string;
  suggested_actions?: SuggestedAction[];
}

interface ChatMessage {
  id: string;
  sender: "user" | "stony";
  text: string;
  staged_action?: SuggestedAction | null;
  executed_action?: boolean;
  action_result?: string;
  timestamp: string;
}

const QUICK_PROMPTS = [
  "Scan all orders for stuck deliveries",
  "Check DataMart wallet & SMS balance",
  "Show out-of-stock data packages",
  "Check open customer support chats",
  "Review system health and suggestions",
];

export default function AdminAiAssistant() {
  const [activeTab, setActiveTab] = useState<"copilot" | "voice_calls" | "ai_config" | "copilot_training">("copilot");
  const [issues, setIssues] = useState<SystemIssue[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loadingIssues, setLoadingIssues] = useState(true);

  // ── CO-PILOT TRAINING & WHATSAPP TRIGGERS STATE ──
  const [copilotCustomDirectives, setCopilotCustomDirectives] = useState("");
  const [copilotTriggerRules, setCopilotTriggerRules] = useState<Array<{
    id: string;
    trigger: string;
    matchType: "contains" | "exact" | "regex";
    responseType: "reply" | "action";
    replyText: string;
    actionType: string;
    active: boolean;
  }>>([
    {
      id: "rule-delivery",
      trigger: "delivery time",
      matchType: "contains",
      responseType: "action",
      actionType: "query_delivery_times",
      replyText: "",
      active: true,
    },
    {
      id: "rule-most-orders",
      trigger: "most orders",
      matchType: "contains",
      responseType: "action",
      actionType: "query_top_customers",
      replyText: "",
      active: true,
    },
  ]);
  const [loadingCopilotTraining, setLoadingCopilotTraining] = useState(false);
  const [savingCopilotTraining, setSavingCopilotTraining] = useState(false);

  // Trigger Rule Editor Modal
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<{
    id?: string;
    trigger: string;
    matchType: "contains" | "exact" | "regex";
    responseType: "reply" | "action";
    replyText: string;
    actionType: string;
    active: boolean;
  }>({
    trigger: "",
    matchType: "contains",
    responseType: "reply",
    replyText: "",
    actionType: "query_top_customers",
    active: true,
  });

  // Co-Pilot Rule Simulator / Test Playground
  const [ruleTestQuery, setRuleTestQuery] = useState("");
  const [ruleTestLoading, setRuleTestLoading] = useState(false);
  const [ruleTestOutput, setRuleTestOutput] = useState<{
    matchedRule?: string;
    actionType?: string;
    reply: string;
    type: "rule" | "ai" | "nlp";
  } | null>(null);

  // AI Configuration State
  const [aiConfigValues, setAiConfigValues] = useState<Record<string, string>>({
    primary_ai_provider: "groq",
    groq_model: "llama-3.3-70b-versatile",
    gemini_model: "gemini-3.8-flash",
    ai_support_enabled: "true",
    groq_api_key: "",
    gemini_api_key: "",
  });
  const [loadingAiConfig, setLoadingAiConfig] = useState(false);
  const [savingAiConfig, setSavingAiConfig] = useState(false);

  const [groqTesting, setGroqTesting] = useState(false);
  const [groqTestResult, setGroqTestResult] = useState<{
    ok?: boolean;
    model?: string;
    reply?: string;
    latencyMs?: number;
    error?: string;
  } | null>(null);
  const [groqLiveModels, setGroqLiveModels] = useState<Array<{ id: string; name: string; description?: string }>>([]);
  const [fetchingGroqModels, setFetchingGroqModels] = useState(false);

  const [geminiTesting, setGeminiTesting] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{
    ok?: boolean;
    model?: string;
    reply?: string;
    latencyMs?: number;
    error?: string;
  } | null>(null);
  const [geminiLiveModels, setGeminiLiveModels] = useState<Array<{ id: string; name: string; description?: string }>>([]);
  const [fetchingGeminiModels, setFetchingGeminiModels] = useState(false);

  const loadAiConfig = async () => {
    setLoadingAiConfig(true);
    try {
      const res = await invokeApiFunction("admin-data", { body: { action: "getSettings" } });
      if (res.data?.settings && Array.isArray(res.data.settings)) {
        const m: Record<string, string> = {};
        res.data.settings.forEach((r: any) => (m[r.key] = r.value || ""));
        if (!m.primary_ai_provider) m.primary_ai_provider = "groq";
        if (!m.groq_model) m.groq_model = "llama-3.3-70b-versatile";
        if (!m.gemini_model) {
          m.gemini_model = "gemini-3.8-flash";
        }
        setAiConfigValues((prev) => ({ ...prev, ...m }));
      }
    } catch (e: any) {
      console.warn("Could not load AI configuration:", e);
    } finally {
      setLoadingAiConfig(false);
    }
  };

  const saveAiConfig = async () => {
    setSavingAiConfig(true);
    try {
      const rows = [
        { key: "groq_api_key", value: (aiConfigValues.groq_api_key ?? "").trim() },
        { key: "GROQ_API_KEY", value: (aiConfigValues.groq_api_key ?? "").trim() },
        { key: "gemini_api_key", value: (aiConfigValues.gemini_api_key ?? "").trim() },
        { key: "GEMINI_API_KEY", value: (aiConfigValues.gemini_api_key ?? "").trim() },
        { key: "primary_ai_provider", value: aiConfigValues.primary_ai_provider || "groq" },
        { key: "groq_model", value: aiConfigValues.groq_model || "llama-3.3-70b-versatile" },
        { key: "gemini_model", value: aiConfigValues.gemini_model || "gemini-3.8-flash" },
        { key: "ai_support_enabled", value: aiConfigValues.ai_support_enabled === "false" ? "false" : "true" },
      ];
      const res = await invokeApiFunction("admin-data", {
        body: { action: "saveSettings", settings: rows },
      });
      if (res.data?.ok || !res.error) {
        toast.success("AI models and configuration saved successfully!");
      } else {
        toast.error(res.data?.error || res.error?.message || "Failed to save settings");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to save AI configuration");
    } finally {
      setSavingAiConfig(false);
    }
  };

  const loadCopilotTraining = async () => {
    setLoadingCopilotTraining(true);
    try {
      const res = await invokeApiFunction("admin-data", { body: { action: "getSettings" } });
      if (res.data?.settings && Array.isArray(res.data.settings)) {
        const m: Record<string, string> = {};
        res.data.settings.forEach((r: any) => (m[r.key] = r.value || ""));
        if (m.copilot_custom_instructions) {
          setCopilotCustomDirectives(m.copilot_custom_instructions);
        }
        if (m.copilot_trigger_rules) {
          try {
            const parsed = JSON.parse(m.copilot_trigger_rules);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setCopilotTriggerRules(parsed);
            }
          } catch (_) {}
        }
      }
    } catch (e: any) {
      console.warn("Could not load copilot training:", e);
    } finally {
      setLoadingCopilotTraining(false);
    }
  };

  const saveCopilotTraining = async () => {
    setSavingCopilotTraining(true);
    try {
      const rows = [
        { key: "copilot_custom_instructions", value: copilotCustomDirectives },
        { key: "copilot_trigger_rules", value: JSON.stringify(copilotTriggerRules) },
      ];
      const res = await invokeApiFunction("admin-data", {
        body: { action: "saveSettings", settings: rows },
      });
      if (res.data?.ok || !res.error) {
        toast.success("Co-Pilot training & WhatsApp trigger rules saved live!");
      } else {
        toast.error(res.data?.error || res.error?.message || "Failed to save training");
      }
    } catch (e: any) {
      toast.error("Failed to save: " + (e?.message || "Error"));
    } finally {
      setSavingCopilotTraining(false);
    }
  };

  const handleSaveRule = () => {
    if (!editingRule.trigger.trim()) {
      toast.error("Please provide what the WhatsApp request phrase is (e.g. 'delivery time')");
      return;
    }
    if (editingRule.responseType === "reply" && !editingRule.replyText.trim()) {
      toast.error("Please write the reply Stony should send for this trigger");
      return;
    }

    if (editingRule.id) {
      setCopilotTriggerRules((prev) =>
        prev.map((r) => (r.id === editingRule.id ? { ...editingRule, id: editingRule.id } : r))
      );
      toast.success("Trigger rule updated!");
    } else {
      const newId = `rule-${Date.now()}`;
      setCopilotTriggerRules((prev) => [...prev, { ...editingRule, id: newId }]);
      toast.success("New trigger rule added!");
    }
    setRuleModalOpen(false);
  };

  const handleDeleteRule = (id: string) => {
    setCopilotTriggerRules((prev) => prev.filter((r) => r.id !== id));
    toast.success("Rule removed. Tap 'Save All Training' to apply.");
  };

  const handleToggleRule = (id: string) => {
    setCopilotTriggerRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
    );
  };

  const handleTestRuleInPlayground = async () => {
    const q = ruleTestQuery.trim();
    if (!q) {
      toast.error("Enter a test message first");
      return;
    }
    setRuleTestLoading(true);
    setRuleTestOutput(null);

    // 1. Test against local rules
    const matched = copilotTriggerRules.find((r) => {
      if (!r.active || !r.trigger) return false;
      const t = r.trigger.trim().toLowerCase();
      const text = q.toLowerCase();
      if (r.matchType === "exact") return text === t;
      if (r.matchType === "regex") {
        try { return new RegExp(t, "i").test(q); } catch (_) { return false; }
      }
      return text.includes(t);
    });

    if (matched && matched.responseType === "reply") {
      setRuleTestOutput({
        matchedRule: matched.trigger,
        reply: matched.replyText,
        type: "rule",
      });
      setRuleTestLoading(false);
      return;
    }

    // 2. Query backend to test real site Co-Pilot execution
    try {
      const res = await invokeApiFunction("admin-ai", {
        body: {
          action: "aiCoPilotChat",
          message: q,
          history: [],
          source: "playground_test",
        },
      });
      if (res.data?.ok && res.data.reply) {
        setRuleTestOutput({
          matchedRule: res.data.matched_rule || (matched ? matched.trigger : undefined),
          actionType: res.data.action_type,
          reply: res.data.reply,
          type: res.data.matched_rule ? "rule" : "ai",
        });
      } else {
        setRuleTestOutput({
          reply: res.data?.error || "No response received from Co-Pilot engine",
          type: "ai",
        });
      }
    } catch (e: any) {
      setRuleTestOutput({
        reply: "Error testing co-pilot: " + (e?.message || "Internal error"),
        type: "ai",
      });
    } finally {
      setRuleTestLoading(false);
    }
  };

  const fetchGroqModels = async () => {
    const key = (aiConfigValues.groq_api_key ?? "").trim();
    if (!key) {
      toast.error("Please enter a Groq API key first to discover available models");
      return;
    }
    setFetchingGroqModels(true);
    try {
      const res = await invokeApiFunction("chat", {
        body: { action: "listAiModels", provider: "groq", key },
      });
      if (res?.data?.ok && Array.isArray(res.data.models) && res.data.models.length > 0) {
        setGroqLiveModels(res.data.models);
        toast.success(`Discovered ${res.data.models.length} active models from Groq!`);
      } else {
        toast.error(res?.data?.error || res?.error?.message || "Could not retrieve models from Groq");
      }
    } catch (e: any) {
      toast.error("Failed to fetch Groq models: " + (e?.message || "Network error"));
    } finally {
      setFetchingGroqModels(false);
    }
  };

  const fetchGeminiModels = async () => {
    const key = (aiConfigValues.gemini_api_key ?? "").trim();
    if (!key) {
      toast.error("Please enter a Google AI Studio API key first to discover available models");
      return;
    }
    setFetchingGeminiModels(true);
    try {
      const res = await invokeApiFunction("chat", {
        body: { action: "listAiModels", provider: "gemini", key },
      });
      if (res?.data?.ok && Array.isArray(res.data.models) && res.data.models.length > 0) {
        setGeminiLiveModels(res.data.models);
        toast.success(`Discovered ${res.data.models.length} active models from Google AI Studio!`);
      } else {
        toast.error(res?.data?.error || res?.error?.message || "Could not retrieve models from Google AI Studio");
      }
    } catch (e: any) {
      toast.error("Failed to fetch Gemini models: " + (e?.message || "Network error"));
    } finally {
      setFetchingGeminiModels(false);
    }
  };

  const testGroq = async () => {
    const key = (aiConfigValues.groq_api_key ?? "").trim();
    if (!key) {
      toast.error("Please enter a Groq API key first");
      return;
    }
    setGroqTesting(true);
    setGroqTestResult(null);
    try {
      const selectedModel = aiConfigValues.groq_model || "llama-3.3-70b-versatile";
      const res = await invokeApiFunction("chat", {
        body: { action: "testAiKeys", provider: "groq", key, model: selectedModel },
      });
      if (res?.data?.ok) {
        setGroqTestResult(res.data);
        toast.success(`Groq connected! (${res.data.model} • ${res.data.latencyMs}ms)`);
      } else {
        const err = res?.data?.error || res?.error?.message || "Groq connection failed";
        setGroqTestResult({ ok: false, error: err });
        toast.error(err);
      }
    } catch (e: any) {
      setGroqTestResult({ ok: false, error: e?.message || "Test failed" });
      toast.error("Groq test error: " + (e?.message || "Unknown error"));
    } finally {
      setGroqTesting(false);
    }
  };

  const testGemini = async () => {
    const key = (aiConfigValues.gemini_api_key ?? "").trim();
    if (!key) {
      toast.error("Please enter a Gemini API key first");
      return;
    }
    setGeminiTesting(true);
    setGeminiTestResult(null);
    try {
      const selectedModel = aiConfigValues.gemini_model || "gemini-3.8-flash";
      const res = await invokeApiFunction("chat", {
        body: { action: "testAiKeys", provider: "gemini", key, model: selectedModel },
      });
      if (res?.data?.ok) {
        setGeminiTestResult(res.data);
        toast.success(`Google AI Studio connected! (${res.data.model} • ${res.data.latencyMs}ms)`);
      } else {
        const err = res?.data?.error || res?.error?.message || "Google AI Studio connection failed";
        setGeminiTestResult({ ok: false, error: err });
        toast.error(err);
      }
    } catch (e: any) {
      setGeminiTestResult({ ok: false, error: e?.message || "Test failed" });
      toast.error("Gemini test error: " + (e?.message || "Unknown error"));
    } finally {
      setGeminiTesting(false);
    }
  };

  // Voice Calls State
  const [voiceCalls, setVoiceCalls] = useState<any[]>([]);
  const [loadingVoiceCalls, setLoadingVoiceCalls] = useState(false);

  const loadVoiceCalls = async () => {
    setLoadingVoiceCalls(true);
    try {
      const res = await invokeApiFunction("chat", { body: { action: "listVoiceCalls" } });
      if (res.data?.calls && Array.isArray(res.data.calls)) {
        setVoiceCalls(res.data.calls);
      }
    } catch (e: any) {
      console.warn("Could not load voice calls:", e);
    } finally {
      setLoadingVoiceCalls(false);
    }
  };

  const [deletingCallId, setDeletingCallId] = useState<string | null>(null);

  const handleDeleteCall = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this voice note?")) return;
    setDeletingCallId(id);
    try {
      const res = await invokeApiFunction("chat", { body: { action: "deleteVoiceCall", id } });
      if (res.data?.calls) {
        setVoiceCalls(res.data.calls);
      } else {
        setVoiceCalls((prev) => prev.filter((c) => c.id !== id));
      }
      toast.success("Voice note deleted");
    } catch {
      toast.error("Failed to delete voice note");
    } finally {
      setDeletingCallId(null);
    }
  };

  const handleClearAllCalls = async () => {
    if (!window.confirm("Are you sure you want to delete ALL voice notes?")) return;
    setDeletingCallId("all");
    try {
      const res = await invokeApiFunction("chat", { body: { action: "deleteVoiceCall", id: "all" } });
      if (res.data?.calls) {
        setVoiceCalls(res.data.calls);
      } else {
        setVoiceCalls([]);
      }
      toast.success("All voice notes cleared");
    } catch {
      toast.error("Failed to clear voice notes");
    } finally {
      setDeletingCallId(null);
    }
  };

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "intro",
      sender: "stony",
      text: "Hello! 😊 I'm Stony, your autonomous AI Co-Pilot at Data One.\n\nI monitor the whole system 24/7 (orders, telecom delivery speeds, DataMart wallet, SMS, products, and support).\n\n⚡ **I can perform actions directly in the system** — updating orders, resyncing DataMart, sending customer SMS, toggling inventory stock, and resolving chats.\n\n🔒 **Human Confirmation Guarantee:** I will NEVER execute any action automatically without your explicit confirmation.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Active Action Confirmation Modal
  const [selectedAction, setSelectedAction] = useState<SuggestedAction | null>(null);
  const [executingAction, setExecutingAction] = useState(false);

  // 1. Load System Issues & Suggestions
  const loadIssues = async () => {
    setLoadingIssues(true);
    try {
      const res = await invokeApiFunction("admin-ai", {
        body: { action: "getAiIssuesAndProposals" },
      });
      if (res.data?.ok) {
        setIssues(res.data.issues || []);
        setSummary(res.data.summary || null);
      } else {
        toast.error(res.data?.error || res.error?.message || "Could not load AI issues");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to scan system");
    } finally {
      setLoadingIssues(false);
    }
  };

  useEffect(() => {
    document.title = "Admin · Stony AI Co-Pilot & Voice";
    loadIssues();
    loadVoiceCalls();
    loadAiConfig();
    loadCopilotTraining();
  }, []);

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 2. Execute a Confirmed Action
  const handleConfirmAction = async (action: SuggestedAction, messageIdToUpdate?: string) => {
    setExecutingAction(true);
    try {
      const res = await invokeApiFunction("admin-ai", {
        body: {
          action: "executeAiAction",
          action_type: action.action_type,
          payload: action.payload,
        },
      });

      if (res.data?.ok) {
        const successMsg = res.data.message || "Action executed successfully!";
        toast.success(successMsg);

        // Update chat messages if triggered from chat
        if (messageIdToUpdate) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageIdToUpdate
                ? {
                    ...m,
                    executed_action: true,
                    action_result: successMsg,
                  }
                : m
            )
          );
        } else {
          // Append confirmation turn in chat
          setMessages((prev) => [
            ...prev,
            {
              id: `executed-${Date.now()}`,
              sender: "stony",
              text: `✅ **Action Confirmed & Executed!**\n\n${successMsg}\n\nSystem state has been updated. Anything else bossu?`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        }

        // Close modal
        setSelectedAction(null);

        // Refresh issues list
        await loadIssues();
      } else {
        toast.error(res.data?.error || res.error?.message || "Execution failed");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to execute action");
    } finally {
      setExecutingAction(false);
    }
  };

  // 3. Send Natural Language Message to Stony
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || sendingChat) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputText("");
    setSendingChat(true);

    try {
      const res = await invokeApiFunction("admin-ai", {
        body: {
          action: "aiCoPilotChat",
          message: text,
          history: messages.slice(-6).map((m) => ({
            role: m.sender === "user" ? "user" : "assistant",
            text: m.text,
          })),
        },
      });

      if (res.data?.ok) {
        const botReply: ChatMessage = {
          id: `stony-${Date.now()}`,
          sender: "stony",
          text: res.data.reply || "Done!",
          staged_action: res.data.staged_action || null,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, botReply]);
      } else {
        toast.error(res.data?.error || res.error?.message || "Chat request failed");
      }
    } catch (err: any) {
      toast.error(err?.message || "Could not reach Stony AI");
    } finally {
      setSendingChat(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-hero p-6 text-primary-foreground border border-white/10 shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 p-2.5 flex items-center justify-center text-emerald-300 shadow-inner">
              <Bot className="size-8 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight">Stony AI Co-Pilot</h1>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs px-2.5 py-0.5">
                  Action Engine Active
                </Badge>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("ai_config");
                    loadAiConfig();
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-200 border border-purple-400/40 hover:bg-purple-500/30 transition cursor-pointer"
                  title="Click to configure AI models & API keys"
                >
                  <Cpu className="size-3 text-purple-300" />
                  <span>
                    {aiConfigValues.primary_ai_provider === "gemini"
                      ? `Gemini: ${aiConfigValues.gemini_model || "gemini-3.8-flash"}`
                      : `Groq: ${aiConfigValues.groq_model || "llama-3.3-70b-versatile"}`}
                  </span>
                </button>
              </div>
              <p className="text-sm text-primary-foreground/80 mt-1 max-w-xl">
                Autonomous business assistant that diagnoses system issues, stages operational tasks, and executes actions with your explicit confirmation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => {
                setActiveTab("ai_config");
                loadAiConfig();
              }}
              variant="outline"
              className="bg-purple-500/20 border-purple-400/40 text-purple-100 hover:bg-purple-500/30 text-xs font-semibold"
            >
              <Cpu className="size-3.5 mr-1.5 text-purple-300" />
              Configure AI Models
            </Button>
            <Button
              onClick={loadIssues}
              variant="outline"
              disabled={loadingIssues}
              className="bg-white/10 border-white/20 text-primary-foreground hover:bg-white/20 hover:text-white"
            >
              <RefreshCw className={`size-4 mr-2 ${loadingIssues ? "animate-spin" : ""}`} />
              Scan System
            </Button>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10 text-xs">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-primary-foreground/70 block">Active Issues</span>
            <span className="text-lg font-bold text-amber-300">
              {issues.length} {issues.length === 1 ? "issue" : "issues"}
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-primary-foreground/70 block">DataMart Wallet</span>
            <span className="text-lg font-bold text-emerald-300">
              {summary?.datamart_balance != null
                ? `GH₵ ${Number(summary.datamart_balance).toFixed(2)}`
                : "Connected"}
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-primary-foreground/70 block">Delivery Speed</span>
            <span className="text-lg font-bold text-sky-300">
              {summary?.datamart_speed || "~5-30 mins"}
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-primary-foreground/70 block">Arkesel SMS</span>
            <span className="text-lg font-bold text-violet-300">
              {summary?.arkesel_balance != null ? `${summary.arkesel_balance} units` : "Active"}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("copilot")}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
            activeTab === "copilot"
              ? "bg-primary text-primary-foreground shadow"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bot className="size-4" />
          <span>Stony AI Co-Pilot & Health</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("voice_calls");
            loadVoiceCalls();
          }}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
            activeTab === "voice_calls"
              ? "bg-emerald-600 text-white shadow"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <Mic className="size-4 text-emerald-400" />
          <span>Customer Voice Calls & Audio</span>
          {voiceCalls.length > 0 && (
            <span className="bg-emerald-400 text-black text-[10px] px-1.5 py-0.5 rounded-full font-black ml-1">
              {voiceCalls.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("ai_config");
            loadAiConfig();
          }}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
            activeTab === "ai_config"
              ? "bg-purple-600 text-white shadow"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <Cpu className="size-4 text-purple-300" />
          <span>AI Models & Connections (AIS & Groq)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("copilot_training");
            loadCopilotTraining();
          }}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
            activeTab === "copilot_training"
              ? "bg-amber-500 text-black shadow font-black"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <BrainCircuit className="size-4 text-amber-500" />
          <span>Train Co-Pilot (WhatsApp Triggers)</span>
          {copilotTriggerRules.filter((r) => r.active).length > 0 && (
            <span className="bg-black/20 text-xs px-2 py-0.5 rounded-full font-extrabold ml-1">
              {copilotTriggerRules.filter((r) => r.active).length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "voice_calls" ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card border shadow-sm">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Headphones className="size-5 text-emerald-500" /> Customer Voice Notes
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Play customer voice notes directly and delete them once attended to.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadVoiceCalls}
                disabled={loadingVoiceCalls}
                className="gap-1.5"
              >
                <RefreshCw className={`size-3.5 ${loadingVoiceCalls ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </Button>

              {voiceCalls.length > 0 && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleClearAllCalls}
                  disabled={deletingCallId === "all"}
                  className="gap-1.5 bg-rose-600 hover:bg-rose-500 text-white"
                >
                  <Trash2 className="size-3.5" />
                  <span>Clear All</span>
                </Button>
              )}
            </div>
          </div>

          {loadingVoiceCalls ? (
            <Card className="p-12 text-center border-dashed">
              <Loader2 className="size-6 animate-spin text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading customer voice notes...</p>
            </Card>
          ) : voiceCalls.length === 0 ? (
            <Card className="p-12 text-center border-dashed bg-muted/20">
              <Mic className="size-10 text-muted-foreground/60 mx-auto mb-3" />
              <h3 className="font-bold text-base">No Customer Voice Notes</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                Customer voice calls and audio recordings will appear here for you to play and delete.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {voiceCalls.map((call) => {
                const phoneDigits = (call.customer_phone || "").replace(/\D/g, "");
                const waLink = phoneDigits
                  ? `https://wa.me/${phoneDigits.startsWith("0") ? "233" + phoneDigits.slice(1) : phoneDigits}?text=${encodeURIComponent(
                      `Hello from Data One! Regarding your voice note:`
                    )}`
                  : null;

                return (
                  <Card key={call.id} className="p-4 rounded-2xl space-y-3 border-2 border-border/80 hover:border-emerald-500/40 transition-all shadow-sm">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm flex items-center gap-1.5">
                          <Phone className="size-3.5 text-emerald-500" />
                          {call.customer_phone ? (
                            <PhoneLink value={call.customer_phone} />
                          ) : (
                            <span className="text-muted-foreground">Anonymous Caller</span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span>{new Date(call.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCall(call.id)}
                        disabled={deletingCallId === call.id}
                        className="size-8 rounded-xl text-rose-500 hover:text-white hover:bg-rose-600"
                        title="Delete Voice Note"
                      >
                        {deletingCallId === call.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </div>

                    {/* Voice Note Audio Player with Play and Delete */}
                    <AudioPlayer
                      src={call.audio_url || "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="}
                      durationSeconds={call.duration_seconds || 10}
                      onDelete={() => handleDeleteCall(call.id)}
                      isDeleting={deletingCallId === call.id}
                      showTranscript={false}
                    />

                    {/* Actions */}
                    <div className="pt-1 flex items-center gap-2 border-t border-border/60">
                      {waLink && (
                        <Button asChild size="sm" variant="outline" className="h-8 text-xs font-bold gap-1 flex-1">
                          <a href={waLink} target="_blank" rel="noreferrer">
                            <MessageSquare className="size-3.5 text-emerald-500" />
                            <span>WhatsApp</span>
                          </a>
                        </Button>
                      )}
                      {call.customer_phone && (
                        <Button asChild size="sm" variant="outline" className="h-8 text-xs font-bold gap-1 flex-1">
                          <a href={`tel:${call.customer_phone}`}>
                            <Phone className="size-3.5 text-sky-500" />
                            <span>Call</span>
                          </a>
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === "ai_config" ? (
        <div className="space-y-6">
          {/* Header Card */}
          <Card className="overflow-hidden border-2 border-purple-500/40 bg-gradient-to-br from-purple-950/60 via-card to-violet-950/40 shadow-lg rounded-2xl">
            <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500" />
            <div className="p-4 md:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-500/20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.25)]">
                    <Cpu className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-lg text-foreground">AI Models & Engine Connections</h2>
                      <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full ${
                        aiConfigValues.ai_support_enabled !== "false"
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}>
                        {aiConfigValues.ai_support_enabled !== "false" ? "AI Live Chat Online" : "Paused"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Powers customer live chat and telephone voice call assistance with human-like conversation.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadAiConfig}
                    disabled={loadingAiConfig}
                    className="h-8 text-xs gap-1 border-purple-500/30"
                  >
                    <RefreshCw className={`size-3.5 ${loadingAiConfig ? "animate-spin" : ""}`} />
                    <span>Reload</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={saveAiConfig}
                    disabled={savingAiConfig}
                    className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold gap-1 shadow-sm"
                  >
                    {savingAiConfig ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin mr-1" />
                        <span>Saving…</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-3.5 mr-1" />
                        <span>Save AI Settings</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Primary Engine Strategy Banner */}
              <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs text-purple-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="font-bold text-white flex items-center gap-1.5 text-sm">
                    <Sparkles className="size-4 text-purple-400" /> Multi-Model Automated Fallback Engine
                  </span>
                  <p className="text-[11px] text-purple-300/80">
                    Primary engine answers live visitor queries. If quota or connection drops, secondary engine takes over instantly with zero downtime.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2 bg-background/50 p-1.5 rounded-lg border border-purple-500/30">
                    <div className="text-left">
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Primary Engine</div>
                      <Select
                        value={aiConfigValues.primary_ai_provider || "groq"}
                        onValueChange={(val) => setAiConfigValues(v => ({ ...v, primary_ai_provider: val }))}
                      >
                        <SelectTrigger className="h-7 w-[180px] bg-background text-xs font-semibold border-purple-500/40">
                          <SelectValue placeholder="Select Primary Engine" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="groq" className="text-xs">⚡ Groq (Llama 3.3 Primary)</SelectItem>
                          <SelectItem value="gemini" className="text-xs">✨ Google AI Studio / Gemini Primary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-background/50 p-2 rounded-lg border border-purple-500/30">
                    <Label htmlFor="ai_live_chat_switch" className="text-xs font-semibold cursor-pointer">
                      Live Chat
                    </Label>
                    <Switch
                      id="ai_live_chat_switch"
                      checked={aiConfigValues.ai_support_enabled !== "false"}
                      onCheckedChange={(c) => setAiConfigValues(v => ({ ...v, ai_support_enabled: c ? "true" : "false" }))}
                    />
                  </div>
                </div>
              </div>

              {/* Providers Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
                {/* 1. Groq Card */}
                <div className="space-y-3.5 p-4 rounded-2xl bg-purple-950/20 border border-purple-500/25 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Label className="font-semibold text-sm text-purple-100 flex items-center gap-2">
                          <span>Groq AI Connection</span>
                          <span className="text-[10px] text-emerald-300 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            Ultra-Fast (~50-200ms)
                          </span>
                        </Label>
                        {aiConfigValues.primary_ai_provider !== "gemini" && (
                          <span className="text-[10px] bg-purple-500/30 text-purple-200 font-bold px-2 py-0.5 rounded-full border border-purple-500/40">
                            Primary
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={testGroq}
                        disabled={groqTesting || !aiConfigValues.groq_api_key}
                        className="h-7 text-xs border-purple-500/40 hover:bg-purple-900/40 text-purple-200 gap-1.5"
                      >
                        {groqTesting ? (
                          <>
                            <Loader2 className="size-3 animate-spin text-purple-400" />
                            <span>Testing…</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="size-3 text-purple-400" />
                            <span>Test Groq Connection</span>
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Groq Model Selector with Live Discovery */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-xs text-purple-200 font-medium">Select Groq Model</Label>
                          <p className="text-[10px] text-muted-foreground">Pick active model for chat &amp; voice</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={fetchGroqModels}
                          disabled={fetchingGroqModels || !aiConfigValues.groq_api_key}
                          className="h-6 text-[11px] text-purple-300 hover:text-purple-100 hover:bg-purple-900/40 px-2 gap-1"
                        >
                          <RefreshCw className={`size-3 text-purple-400 ${fetchingGroqModels ? "animate-spin" : ""}`} />
                          <span>{fetchingGroqModels ? "Loading…" : "Fetch Live Models"}</span>
                        </Button>
                      </div>

                      <Select
                        value={aiConfigValues.groq_model || "llama-3.3-70b-versatile"}
                        onValueChange={(val) => setAiConfigValues(v => ({ ...v, groq_model: val }))}
                      >
                        <SelectTrigger className="h-9 bg-background/80 text-xs border-purple-500/30">
                          <SelectValue placeholder="Select Groq Model" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {groqLiveModels.length > 0 && (
                            <>
                              <div className="px-2 py-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                                Live Models From Your Groq Account ({groqLiveModels.length})
                              </div>
                              {groqLiveModels.map((m) => (
                                <SelectItem key={m.id} value={m.id} className="text-xs">
                                  <span className="font-medium text-emerald-300">● {m.name}</span>
                                  {m.description && <span className="text-[10px] text-muted-foreground ml-2">({m.description})</span>}
                                </SelectItem>
                              ))}
                              <div className="my-1 border-t border-border/60" />
                            </>
                          )}
                          <div className="px-2 py-1 text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                            Verified Models
                          </div>
                          {VERIFIED_GROQ_MODELS.map((m) => (
                            <SelectItem key={m.value} value={m.value} className="text-xs">
                              <div className="flex items-center justify-between w-full gap-2">
                                <span>{m.label}</span>
                                <span className="text-[10px] text-muted-foreground">({m.badge})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Groq API Key Input */}
                    <div className="space-y-1">
                      <Label htmlFor="groq_key_input" className="text-xs text-purple-200">Groq API Key</Label>
                      <Input
                        id="groq_key_input"
                        type="password"
                        value={aiConfigValues.groq_api_key ?? ""}
                        onChange={e => setAiConfigValues(v => ({ ...v, groq_api_key: e.target.value }))}
                        placeholder="gsk_..."
                        className="bg-background/60 border-purple-500/25 focus-visible:ring-purple-500/40 text-xs font-mono"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Free Groq key available at{" "}
                        <a
                          href="https://console.groq.com/keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 underline font-medium hover:text-purple-300"
                        >
                          console.groq.com
                        </a>
                      </p>
                    </div>
                  </div>

                  {/* Groq Test Result */}
                  {groqTestResult && (
                    <div className={`mt-2 p-3 rounded-xl border text-xs ${
                      groqTestResult.ok
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    }`}>
                      {groqTestResult.ok ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 font-bold">
                            <CheckCircle2 className="size-3.5 text-emerald-400" />
                            <span>Connected to Groq ({groqTestResult.model}) in {groqTestResult.latencyMs}ms</span>
                          </div>
                          <p className="text-xs text-zinc-300 italic pl-5">"{groqTestResult.reply}"</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="size-3.5 text-rose-400 shrink-0" />
                          <span>{groqTestResult.error}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Google AI Studio (Gemini) Card */}
                <div className="space-y-3.5 p-4 rounded-2xl bg-purple-950/20 border border-purple-500/25 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Label className="font-semibold text-sm text-purple-100 flex items-center gap-2">
                          <span>Google AI Studio / Gemini</span>
                          <span className="text-[10px] text-purple-300 font-bold bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded-full">
                            Free Tier
                          </span>
                        </Label>
                        {aiConfigValues.primary_ai_provider === "gemini" && (
                          <span className="text-[10px] bg-purple-500/30 text-purple-200 font-bold px-2 py-0.5 rounded-full border border-purple-500/40">
                            Primary
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={testGemini}
                        disabled={geminiTesting || !aiConfigValues.gemini_api_key}
                        className="h-7 text-xs border-purple-500/40 hover:bg-purple-900/40 text-purple-200 gap-1.5"
                      >
                        {geminiTesting ? (
                          <>
                            <Loader2 className="size-3 animate-spin text-purple-400" />
                            <span>Testing…</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="size-3 text-purple-400" />
                            <span>Test AIS Connection</span>
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Gemini Model Selector with Live Discovery */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-xs text-purple-200 font-medium">Select Gemini Model</Label>
                          <p className="text-[10px] text-muted-foreground">Pick active model from Google AI Studio</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={fetchGeminiModels}
                          disabled={fetchingGeminiModels || !aiConfigValues.gemini_api_key}
                          className="h-6 text-[11px] text-purple-300 hover:text-purple-100 hover:bg-purple-900/40 px-2 gap-1"
                        >
                          <RefreshCw className={`size-3 text-purple-400 ${fetchingGeminiModels ? "animate-spin" : ""}`} />
                          <span>{fetchingGeminiModels ? "Loading…" : "Fetch Live Models from AIS"}</span>
                        </Button>
                      </div>

                      <Select
                        value={aiConfigValues.gemini_model || "gemini-3.8-flash"}
                        onValueChange={(val) => setAiConfigValues(v => ({ ...v, gemini_model: val }))}
                      >
                        <SelectTrigger className="h-9 bg-background/80 text-xs border-purple-500/30">
                          <SelectValue placeholder="Select Gemini Model" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {geminiLiveModels.length > 0 && (
                            <>
                              <div className="px-2 py-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                                Live Models From Google AI Studio ({geminiLiveModels.length})
                              </div>
                              {geminiLiveModels.map((m) => (
                                <SelectItem key={m.id} value={m.id} className="text-xs">
                                  <span className="font-medium text-emerald-300">● {m.name}</span>
                                  {m.description && <span className="text-[10px] text-muted-foreground ml-2">({m.description})</span>}
                                </SelectItem>
                              ))}
                              <div className="my-1 border-t border-border/60" />
                            </>
                          )}
                          <div className="px-2 py-1 text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                            Verified AI Studio Models
                          </div>
                          {VERIFIED_GEMINI_MODELS.map((m) => (
                            <SelectItem key={m.value} value={m.value} className="text-xs">
                              <div className="flex items-center justify-between w-full gap-2">
                                <span>{m.label}</span>
                                <span className="text-[10px] text-muted-foreground">({m.badge})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Gemini API Key Input */}
                    <div className="space-y-1">
                      <Label htmlFor="gemini_key_input" className="text-xs text-purple-200">Google Gemini API Key</Label>
                      <Input
                        id="gemini_key_input"
                        type="password"
                        value={aiConfigValues.gemini_api_key ?? ""}
                        onChange={e => setAiConfigValues(v => ({ ...v, gemini_api_key: e.target.value }))}
                        placeholder="AIzaSy..."
                        className="bg-background/60 border-purple-500/25 focus-visible:ring-purple-500/40 text-xs font-mono"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Free Google AI Studio key at{" "}
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 underline font-medium hover:text-purple-300"
                        >
                          aistudio.google.com
                        </a>{" "}
                        (zero credit card needed, supports Gemini 2.0 Flash).
                      </p>
                    </div>
                  </div>

                  {/* Gemini Test Result */}
                  {geminiTestResult && (
                    <div className={`mt-2 p-3 rounded-xl border text-xs ${
                      geminiTestResult.ok
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    }`}>
                      {geminiTestResult.ok ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 font-bold">
                            <CheckCircle2 className="size-3.5 text-emerald-400" />
                            <span>Connected to Gemini ({geminiTestResult.model}) in {geminiTestResult.latencyMs}ms</span>
                          </div>
                          <p className="text-xs text-zinc-300 italic pl-5">"{geminiTestResult.reply}"</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="size-3.5 text-rose-400 shrink-0" />
                          <span>{geminiTestResult.error}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Save Bar */}
              <div className="flex items-center justify-between pt-3 border-t border-purple-500/20">
                <p className="text-[11px] text-muted-foreground">
                  Saved settings instantly apply to visitor live chat, owner co-pilot, and customer phone voice assistance.
                </p>
                <Button
                  type="button"
                  onClick={saveAiConfig}
                  disabled={savingAiConfig}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-9 px-4 gap-1.5 shadow"
                >
                  {savingAiConfig ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5 mr-1" />
                      <span>Save All Changes</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : activeTab === "copilot_training" ? (
        <div className="space-y-6">
          {/* Header Banner */}
          <Card className="overflow-hidden border-2 border-amber-500/40 bg-gradient-to-br from-amber-950/60 via-card to-yellow-950/40 shadow-lg rounded-2xl">
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500" />
            <div className="p-4 md:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-500/20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                    <BrainCircuit className="size-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold tracking-tight">Co-Pilot WhatsApp Training & Rules</h2>
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-bold">
                        Owner Directives Live
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
                      Train Stony how to talk, think, and respond to your messages on WhatsApp. Define deterministic trigger rules: if you request something on WhatsApp, Stony will give you exact answers or fetch live data.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <Button
                    type="button"
                    onClick={() => {
                      setEditingRule({
                        trigger: "",
                        matchType: "contains",
                        responseType: "action",
                        actionType: "query_delivery_times",
                        replyText: "",
                        active: true,
                      });
                      setRuleModalOpen(true);
                    }}
                    variant="outline"
                    className="border-amber-500/40 text-amber-200 hover:bg-amber-500/20 text-xs font-semibold gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    <span>Add New Rule</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={saveCopilotTraining}
                    disabled={savingCopilotTraining}
                    className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs h-9 px-4 gap-1.5 shadow"
                  >
                    {savingCopilotTraining ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin mr-1" />
                        <span>Saving…</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-3.5 mr-1" />
                        <span>Save All Training</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Status metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-muted-foreground block text-[11px]">Active WhatsApp Trigger Rules</span>
                  <span className="text-lg font-bold text-amber-300">
                    {copilotTriggerRules.filter((r) => r.active).length} of {copilotTriggerRules.length} Active
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-muted-foreground block text-[11px]">Co-Pilot AI Execution Bridge</span>
                  <span className="text-lg font-bold text-emerald-300">
                    Live Two-Way Sync Active
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-muted-foreground block text-[11px]">Primary AI Provider</span>
                  <span className="text-lg font-bold text-purple-300 uppercase">
                    {aiConfigValues.primary_ai_provider || "Groq"}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Section 1: One-Click Instant Trigger Starters */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider block">
                ⚡ One-Click Training Presets (Tap to Add to Your Rules):
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const exists = copilotTriggerRules.some((r) => r.trigger.toLowerCase() === "delivery time");
                  if (exists) {
                    toast.info("Delivery time rule is already in your rules list!");
                    return;
                  }
                  setCopilotTriggerRules((prev) => [
                    ...prev,
                    {
                      id: `rule-${Date.now()}`,
                      trigger: "delivery time",
                      matchType: "contains",
                      responseType: "action",
                      actionType: "query_delivery_times",
                      replyText: "",
                      active: true,
                    },
                  ]);
                  toast.success("Added 'Delivery Time' rule! Tap 'Save All Training' to apply.");
                }}
                className="p-3 rounded-2xl bg-card hover:bg-muted/80 border border-border text-left transition-all text-xs group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-foreground group-hover:text-amber-400">
                    ⚡ Live Delivery Speed
                  </span>
                  <Plus className="w-3.5 h-3.5 text-muted-foreground group-hover:text-amber-400" />
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  When you text "delivery time", fetches live carrier speed for MTN, Telecel &amp; AT.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  const exists = copilotTriggerRules.some((r) => r.trigger.toLowerCase() === "most orders");
                  if (exists) {
                    toast.info("Most orders rule is already in your rules list!");
                    return;
                  }
                  setCopilotTriggerRules((prev) => [
                    ...prev,
                    {
                      id: `rule-${Date.now()}`,
                      trigger: "most orders",
                      matchType: "contains",
                      responseType: "action",
                      actionType: "query_top_customers",
                      replyText: "",
                      active: true,
                    },
                  ]);
                  toast.success("Added 'Most Orders' customer rule! Tap 'Save All Training' to apply.");
                }}
                className="p-3 rounded-2xl bg-card hover:bg-muted/80 border border-border text-left transition-all text-xs group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-foreground group-hover:text-amber-400">
                    🏆 Numbers with Most Orders
                  </span>
                  <Plus className="w-3.5 h-3.5 text-muted-foreground group-hover:text-amber-400" />
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  When you ask who has the most orders, ranks top customer numbers and amounts spent.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  const exists = copilotTriggerRules.some((r) => r.trigger.toLowerCase() === "my balance");
                  if (exists) {
                    toast.info("Balance check rule is already in your rules list!");
                    return;
                  }
                  setCopilotTriggerRules((prev) => [
                    ...prev,
                    {
                      id: `rule-${Date.now()}`,
                      trigger: "my balance",
                      matchType: "contains",
                      responseType: "action",
                      actionType: "query_delivery_times",
                      replyText: "",
                      active: true,
                    },
                  ]);
                  toast.success("Added 'Balance Check' rule! Tap 'Save All Training' to apply.");
                }}
                className="p-3 rounded-2xl bg-card hover:bg-muted/80 border border-border text-left transition-all text-xs group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-foreground group-hover:text-amber-400">
                    💳 DataMart &amp; SMS Balance
                  </span>
                  <Plus className="w-3.5 h-3.5 text-muted-foreground group-hover:text-amber-400" />
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  When you text "balance" or "wallet", instantly returns live gateway credits.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCopilotTriggerRules((prev) => [
                    ...prev,
                    {
                      id: `rule-${Date.now()}`,
                      trigger: "boss secret promo",
                      matchType: "contains",
                      responseType: "reply",
                      replyText: "Bossu! Today's VIP discount code is 'DATA1VIP' for 5% off on MTN Turbo bundles!",
                      actionType: "",
                      active: true,
                    },
                  ]);
                  toast.success("Added custom text reply rule! Tap 'Save All Training' to apply.");
                }}
                className="p-3 rounded-2xl bg-card hover:bg-muted/80 border border-border text-left transition-all text-xs group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-foreground group-hover:text-amber-400">
                    💬 Custom Text Response
                  </span>
                  <Plus className="w-3.5 h-3.5 text-muted-foreground group-hover:text-amber-400" />
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  When you text a specific keyword, Stony replies with your exact custom message.
                </p>
              </button>
            </div>
          </div>

          {/* Section 2: Visual Rules List */}
          <Card className="p-5 sm:p-6 rounded-2xl border bg-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Sliders className="size-4 text-amber-500" />
                  <span>Configured If-Then WhatsApp Trigger Rules</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  If your incoming message matches the request phrase below, Stony executes the assigned action or sends your reply.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setEditingRule({
                    trigger: "",
                    matchType: "contains",
                    responseType: "reply",
                    replyText: "",
                    actionType: "query_top_customers",
                    active: true,
                  });
                  setRuleModalOpen(true);
                }}
                className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs gap-1.5"
              >
                <Plus className="size-3.5" />
                <span>Add Trigger Rule</span>
              </Button>
            </div>

            {copilotTriggerRules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs space-y-2">
                <p>No custom trigger rules configured yet.</p>
                <p className="text-[11px]">Click <strong>"Add Trigger Rule"</strong> or tap one of the presets above!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {copilotTriggerRules.map((rule, idx) => (
                  <div
                    key={rule.id || idx}
                    className={`p-4 rounded-xl border transition-all ${
                      rule.active
                        ? "bg-muted/40 border-border hover:border-amber-500/40"
                        : "bg-muted/20 border-border/50 opacity-60"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-amber-400">Rule #{idx + 1}</span>
                          <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                            Match: {rule.matchType}
                          </Badge>
                          <Badge
                            className={`text-[10px] font-bold ${
                              rule.responseType === "action"
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : "bg-sky-500/20 text-sky-300 border-sky-500/40"
                            }`}
                          >
                            {rule.responseType === "action" ? "⚡ Run Live System Query" : "💬 Custom Text Reply"}
                          </Badge>
                        </div>

                        <div className="text-xs space-y-1">
                          <p className="font-semibold text-foreground flex items-center gap-1.5">
                            <span className="text-muted-foreground font-normal">When WhatsApp requests:</span>
                            <code className="px-2 py-0.5 rounded bg-black/40 text-amber-300 font-mono text-xs border border-white/10">
                              "{rule.trigger}"
                            </code>
                          </p>

                          {rule.responseType === "reply" ? (
                            <p className="text-xs text-muted-foreground leading-relaxed pl-2 border-l-2 border-amber-500/40">
                              <span className="text-foreground font-medium">Stony Replies: </span>
                              "{rule.replyText}"
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground pl-2 border-l-2 border-emerald-500/40">
                              <span className="text-emerald-400 font-medium">Action: </span>
                              {rule.actionType === "query_top_customers" && "🏆 Calculate and list numbers with the most orders"}
                              {rule.actionType === "query_delivery_times" && "⚡ Fetch live accurate carrier delivery times & queue"}
                              {rule.actionType === "query_balances" && "💳 Fetch DataMart wallet and Arkesel SMS balance"}
                              {rule.actionType === "query_agents" && "💼 List all registered agent resellers"}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <div className="flex items-center gap-1.5 mr-2">
                          <span className="text-[11px] text-muted-foreground font-medium">
                            {rule.active ? "Active" : "Disabled"}
                          </span>
                          <Switch
                            checked={rule.active}
                            onCheckedChange={() => handleToggleRule(rule.id)}
                          />
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingRule({ ...rule });
                            setRuleModalOpen(true);
                          }}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          title="Edit rule"
                        >
                          <Edit3 className="size-4" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
                          title="Delete rule"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Section 3: General Custom Training Directives */}
          <Card className="p-5 sm:p-6 rounded-2xl border bg-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <BrainCircuit className="size-4 text-amber-500" />
                  <span>General Co-Pilot Directives &amp; Memory</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Direct instructions that Stony will remember in all conversations with you on WhatsApp.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCopilotCustomDirectives(
                      `=== CO-PILOT WHATSAPP DIRECTIVES ===\n` +
                      `1. Always keep answers factual, warm, and concise (1 to 3 sentences maximum).\n` +
                      `2. When asked for live delivery times, report accurate telecom seconds from the site.\n` +
                      `3. When asked about top customers, rank phone numbers by total order volume.\n` +
                      `4. When drafting SMS, always specify the approved Sender ID 'D_1Gh'.\n` +
                      `5. Greet warmly like a trusted Ghanaian business partner ("bossu", "chale", "sharp").`
                    );
                    toast.success("Loaded Co-Pilot directives template!");
                  }}
                  className="h-7 text-[11px] gap-1"
                >
                  <Sparkles className="size-3 text-amber-400" />
                  <span>Load Standard Template</span>
                </Button>
              </div>
            </div>

            <Textarea
              value={copilotCustomDirectives}
              onChange={(e) => setCopilotCustomDirectives(e.target.value)}
              rows={6}
              placeholder="e.g. Always keep answers under 2 sentences. When I ask for sales, give me today's paid orders vs failed. If I ask about top customers, always list their phone number and total orders..."
              className="text-xs font-mono leading-relaxed bg-background"
            />
            <p className="text-[11px] text-muted-foreground">
              These directives are injected into every Co-Pilot call, giving you direct control over Stony's advice, style, and priorities.
            </p>
          </Card>

          {/* Section 4: Live Co-Pilot Rule Simulator / Test Playground */}
          <Card className="p-5 sm:p-6 rounded-2xl border border-amber-500/30 bg-muted/20 space-y-4">
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <Sparkles className="size-4 text-amber-400" />
                <span>Test Your Co-Pilot Training (Live Simulator)</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Type what you would ask on WhatsApp to test how Stony responds with your newly trained rules and data fetchers!
              </p>
            </div>

            <div className="flex gap-2">
              <Input
                value={ruleTestQuery}
                onChange={(e) => setRuleTestQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleTestRuleInPlayground();
                  }
                }}
                placeholder="Try typing: 'who has the most orders?', 'delivery time', or your custom phrase..."
                className="bg-background text-xs sm:text-sm"
              />
              <Button
                type="button"
                onClick={handleTestRuleInPlayground}
                disabled={ruleTestLoading || !ruleTestQuery.trim()}
                className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs shrink-0 gap-1.5"
              >
                {ruleTestLoading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Testing…</span>
                  </>
                ) : (
                  <>
                    <Zap className="size-3.5" />
                    <span>Test Response</span>
                  </>
                )}
              </Button>
            </div>

            {ruleTestOutput && (
              <div className="p-4 rounded-xl bg-card border border-amber-500/40 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">Stony's WhatsApp Response:</span>
                    {ruleTestOutput.matchedRule && (
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">
                        Matched Rule: "{ruleTestOutput.matchedRule}"
                      </Badge>
                    )}
                    {ruleTestOutput.actionType && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">
                        Action: {ruleTestOutput.actionType}
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                    {ruleTestOutput.type === "rule" ? "Instant Trigger Rule" : "Live Co-Pilot Engine"}
                  </span>
                </div>
                <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap bg-muted/40 p-3 rounded-lg border font-sans">
                  {ruleTestOutput.reply}
                </div>
              </div>
            )}
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: System Issues & Action Proposals (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              <h2 className="font-bold text-lg">System Issues & Proposals</h2>
            </div>
            <Badge variant="outline" className="text-xs">
              {issues.length} detected
            </Badge>
          </div>

          {loadingIssues ? (
            <Card className="p-8 text-center border-dashed">
              <Loader2 className="size-6 animate-spin text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Scanning telecom orders, balances, and queues...</p>
            </Card>
          ) : issues.length === 0 ? (
            <Card className="p-8 text-center border border-emerald-500/30 bg-emerald-500/5">
              <ShieldCheck className="size-10 text-emerald-500 mx-auto mb-2" />
              <h3 className="font-semibold text-emerald-600 dark:text-emerald-400">All Systems Operational</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                No stuck orders, failed deliveries, or low balance anomalies detected right now. Everything is running smooth!
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {issues.map((issue) => (
                <Card
                  key={issue.id}
                  className={`p-4 border transition-all ${
                    issue.severity === "high"
                      ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant={issue.severity === "high" ? "destructive" : "secondary"}
                          className="text-[10px] uppercase font-bold"
                        >
                          {issue.severity} priority
                        </Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {issue.category}
                        </Badge>
                      </div>
                      <h4 className="font-semibold text-sm leading-tight pt-1">{issue.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{issue.description}</p>
                    </div>
                  </div>

                  {/* Action Proposals for this issue */}
                  {issue.suggested_actions && issue.suggested_actions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                      <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                        <Sparkles className="size-3 text-amber-500" />
                        Stony's Suggested Action:
                      </span>

                      <div className="flex flex-wrap gap-2">
                        {issue.suggested_actions.map((act, idx) => (
                          <Button
                            key={idx}
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-8 shadow-sm"
                            onClick={() => setSelectedAction(act)}
                          >
                            <CheckCircle2 className="size-3.5 mr-1.5" />
                            {act.action_label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Interactive Co-Pilot Chat (7 cols on lg) */}
        <div className="lg:col-span-7">
          <Card className="flex flex-col h-[650px] border shadow-md overflow-hidden bg-card">
            {/* Chat Header */}
            <div className="p-3.5 border-b bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 flex items-center justify-center font-bold text-xs">
                  AI
                </div>
                <div>
                  <div className="font-semibold text-sm flex items-center gap-1.5">
                    Stony Co-Pilot Chat
                    <span className="size-2 rounded-full bg-emerald-500 inline-block animate-ping" />
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Ask questions or instruct actions (confirmation required before execution)
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Prompts Chips */}
            <div className="px-3 py-2 border-b bg-muted/10 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
              <span className="text-muted-foreground shrink-0 flex items-center gap-1 text-[11px]">
                <Sparkles className="size-3 text-amber-500" /> Quick:
              </span>
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(prompt)}
                  disabled={sendingChat}
                  className="px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted text-foreground text-[11px] whitespace-nowrap transition-colors border border-border/50 shrink-0"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Message Stream */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {messages.map((m) => {
                const isUser = m.sender === "user";
                return (
                  <div key={m.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl p-3.5 text-sm ${
                        isUser
                          ? "bg-primary text-primary-foreground rounded-br-none"
                          : "bg-muted/70 text-foreground border border-border/60 rounded-bl-none shadow-sm whitespace-pre-wrap"
                      }`}
                    >
                      {m.text}

                      {/* Staged Action Proposal Inside Chat */}
                      {m.staged_action && !m.executed_action && (
                        <div className="mt-3 p-3 rounded-xl bg-card border border-amber-500/40 text-foreground space-y-2.5 shadow-sm">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="size-3.5" />
                            Action Confirmation Required
                          </div>

                          <div className="text-xs space-y-1">
                            <div>
                              <strong className="text-muted-foreground">Task: </strong>
                              {m.staged_action.action_label}
                            </div>
                            <div>
                              <strong className="text-muted-foreground">Preview: </strong>
                              {m.staged_action.preview}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              size="sm"
                              disabled={executingAction}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 flex-1"
                              onClick={() => handleConfirmAction(m.staged_action!, m.id)}
                            >
                              {executingAction ? (
                                <>
                                  <Loader2 className="size-3 animate-spin mr-1.5" /> Executing...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="size-3.5 mr-1.5" /> Yes, Go Ahead & Do This
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={executingAction}
                              className="text-xs h-8"
                              onClick={() => {
                                setMessages((prev) => [
                                  ...prev,
                                  {
                                    id: `cancelled-${Date.now()}`,
                                    sender: "stony",
                                    text: "Cancelled bossu. No changes made to the system.",
                                    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                                  },
                                ]);
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Executed Action Receipt Inside Chat */}
                      {m.executed_action && (
                        <div className="mt-2.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5 font-medium">
                          <CheckCircle2 className="size-4 shrink-0" />
                          <span>{m.action_result || "Action successfully executed."}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 px-1">{m.timestamp}</span>
                  </div>
                );
              })}
              {sendingChat && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                  <Loader2 className="size-4 animate-spin text-emerald-500" />
                  <span>Stony is analyzing system and staging proposal...</span>
                </div>
              )}
              <div ref={chatScrollRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 border-t bg-muted/20 flex items-center gap-2"
            >
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask Stony or instruct e.g. 'Update order ORD-xxx to delivered'..."
                className="flex-1 bg-background text-sm"
                disabled={sendingChat}
              />
              <Button
                type="submit"
                disabled={!inputText.trim() || sendingChat}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              >
                <Send className="size-4" />
              </Button>
            </form>
          </Card>
        </div>
      </div>
      )}

      {/* Confirmation Dialog for Selected Action */}
      <Dialog open={!!selectedAction} onOpenChange={(open) => !open && setSelectedAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <AlertTriangle className="size-5" />
              <DialogTitle className="text-lg">Confirm Action Execution</DialogTitle>
            </div>
            <DialogDescription className="text-sm">
              Please review the staged action before Stony executes it. The system will NOT perform this automatically without your approval.
            </DialogDescription>
          </DialogHeader>

          {selectedAction && (
            <div className="space-y-3 py-2 text-sm">
              <div className="p-3 rounded-xl bg-muted/60 border space-y-1.5">
                <div>
                  <strong className="text-muted-foreground text-xs block">ACTION:</strong>
                  <span className="font-semibold">{selectedAction.action_label}</span>
                </div>
                <div>
                  <strong className="text-muted-foreground text-xs block">PREVIEW OF SYSTEM MUTATION:</strong>
                  <p className="text-xs text-foreground mt-0.5 leading-relaxed">{selectedAction.preview}</p>
                </div>
              </div>

              {selectedAction.payload?.send_sms && selectedAction.payload?.recipient_phone && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <Smartphone className="size-4 shrink-0" />
                  <span>Customer SMS alert will be delivered to {selectedAction.payload.recipient_phone}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedAction(null)}
              disabled={executingAction}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              disabled={executingAction}
              onClick={() => selectedAction && handleConfirmAction(selectedAction)}
            >
              {executingAction ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" /> Executing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4 mr-2" /> Yes, Go Ahead and Do This
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
