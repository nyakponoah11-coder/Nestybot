import { useEffect, useState } from "react";
import { supabase as typedSupabase, invokeApiFunction } from "@/integrations/supabase/client";
import { invalidateShopCache } from "@/lib/storeCache";
import { getCacheMeta, setCache, invalidateCache } from "@/lib/localCache";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Megaphone, Bell, Sparkles, Bot, Wallet, RefreshCw, CheckCircle2, AlertCircle, AlertTriangle, Store, Cpu, MessageSquare, Send, Eye, EyeOff, Mail, ExternalLink, CreditCard } from "lucide-react";
import { toast } from "sonner";

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

const KEYS = [
  { key: "shop_name", label: "Shop name", placeholder: "Data One", help: "Displayed at the top of the shop and in the browser tab." },
  { key: "whatsapp_bot_url", label: "WhatsApp Bot link or phone number", placeholder: "0200598553 or https://wa.me/233200598553", help: "Enter WhatsApp bot link or phone number (e.g. 0200598553 or https://wa.me/233200598553). Controls top WhatsApp Bot button & ticker." },
  { key: "whatsapp_channel_url", label: "WhatsApp Channel / Updates link", placeholder: "https://whatsapp.com/channel/0029Vb7vwLN5kg70GeNMsB2w", help: "Your official WhatsApp channel link for store updates & promos." },
  { key: "whapi_api_token", label: "WhatsApp Channel Direct API Token (Whapi.Cloud — Optional)", placeholder: "Paste Whapi token for 100% automatic Channel posting", help: "Optional: Link a Whapi.Cloud token (from your Channel Admin number) so Stony Co-Pilot can post directly into your WhatsApp Channel without manual forwarding." },
  { key: "whatsapp_channel_jid", label: "WhatsApp Channel Newsletter JID (Auto-detected or Optional)", placeholder: "120363xxxxxxxxxx@newsletter", help: "Optional: Auto-detected when Whapi token is set, or enter your @newsletter JID manually." },
  { key: "support_phone", label: "Support Phone & SMS Alert Number (Ghana)", placeholder: "024xxxxxxx or +233...", help: "Customer support phone number. Also receives instant SMS alerts when an order fails or when low balance is detected." },
  { key: "arkesel_sender_id", label: "Arkesel SMS Sender ID", placeholder: "e.g. Data1GH or D_1Gh", help: "The approved Sender ID on your Arkesel account. Used for all automated customer & admin SMS." },
  { key: "apk_download_url", label: "Android APK Download URL (Optional)", placeholder: "https://... or leave empty for default", help: "Direct link to your Android .apk file (Google Drive, Cloud Storage, or direct download). If empty, defaults to the built-in download link." },
];

const AdminSettings = () => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [arkeselTesting, setArkeselTesting] = useState(false);
  const [datamartTesting, setDatamartTesting] = useState(false);
  const [datamartResult, setDatamartResult] = useState<{
    success?: boolean;
    balance?: number | null;
    message?: string;
  } | null>(null);
  const [arkeselResult, setArkeselResult] = useState<{
    ok?: boolean;
    sms_balance?: number | null;
    main_balance?: string | null;
    message?: string;
    error?: string;
  } | null>(null);
  const [testingAlert, setTestingAlert] = useState(false);
  const [paymentAlertResult, setPaymentAlertResult] = useState<{
    ok?: boolean;
    message?: string;
    adminSmsSent?: boolean;
    adminWhatsAppSent?: boolean;
    smsDetails?: string;
    whatsappDetails?: string;
    error?: string;
  } | null>(null);

  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [whatsAppAlertResult, setWhatsAppAlertResult] = useState<{
    ok?: boolean;
    message?: string;
    adminWhatsAppSent?: boolean;
    whatsappDetails?: string;
    error?: string;
  } | null>(null);
  const [testingWithdrawalAlert, setTestingWithdrawalAlert] = useState(false);
  const [withdrawalAlertResult, setWithdrawalAlertResult] = useState<{
    ok?: boolean;
    message?: string;
    adminWhatsAppSent?: boolean;
    adminSmsSent?: boolean;
    whatsappDetails?: string;
    smsDetails?: string;
    directWhatsAppUrl?: string;
    error?: string;
  } | null>(null);
  const [testingAgentRegAlert, setTestingAgentRegAlert] = useState(false);
  const [agentRegAlertResult, setAgentRegAlertResult] = useState<{
    ok?: boolean;
    message?: string;
    agentSmsSent?: boolean;
    adminWhatsAppSent?: boolean;
    adminSmsSent?: boolean;
    agentSmsDetails?: string;
    adminWhatsAppDetails?: string;
    adminSmsDetails?: string;
    storeUrl?: string;
    directWhatsAppUrl?: string;
    error?: string;
  } | null>(null);
  const [showWaToken, setShowWaToken] = useState(false);

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

  // Email API testing (Brevo & Resend)
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState("");
  const [emailTestResult, setEmailTestResult] = useState<{ ok?: boolean; message?: string; error?: string } | null>(null);
  const [showResendKey, setShowResendKey] = useState(false);
  const [showBrevoKey, setShowBrevoKey] = useState(false);

  // Paystack API & Transfer testing
  const [showPaystackKey, setShowPaystackKey] = useState(false);
  const [testingPaystack, setTestingPaystack] = useState(false);
  const [paystackTestResult, setPaystackTestResult] = useState<{
    ok?: boolean;
    balanceGHS?: number;
    message?: string;
    error?: string;
  } | null>(null);

  const testPaystack = async () => {
    const key = (values.paystack_secret_key ?? "").trim();
    if (!key) {
      toast.error("Please enter your Paystack Secret Key first.");
      return;
    }
    setTestingPaystack(true);
    setPaystackTestResult(null);
    try {
      await save(true);
      const res = await invokeApiFunction("agent", {
        body: { action: "testPaystack", paystack_secret_key: key },
      });
      if (res?.data?.ok) {
        setPaystackTestResult(res.data);
        toast.success(res.data.message || "Paystack connection verified!");
      } else {
        const err = res?.data?.error || "Paystack verification failed.";
        setPaystackTestResult({ ok: false, error: err });
        toast.error(err);
      }
    } catch (e: any) {
      const err = e?.message || "Failed to reach Paystack endpoint";
      setPaystackTestResult({ ok: false, error: err });
      toast.error(err);
    } finally {
      setTestingPaystack(false);
    }
  };

  const testEmailDelivery = async () => {
    const brevoKey = (values.brevo_api_key ?? "").trim();
    const resendKey = (values.resend_api_key ?? "").trim();
    if (!brevoKey && !resendKey) {
      toast.error("Please enter your Brevo API Key or Resend API Key first.");
      return;
    }
    const targetEmail = (testEmailRecipient || values.support_email || "").trim();
    if (!targetEmail || !targetEmail.includes("@")) {
      toast.error("Please enter a valid recipient email address to send the test message.");
      return;
    }
    setTestingEmail(true);
    setEmailTestResult(null);
    try {
      await save(true);
      const res = await invokeApiFunction("agent", {
        body: {
          action: "testEmail",
          email: targetEmail,
          brevo_api_key: brevoKey,
          brevo_sender_email: (values.brevo_sender_email || "stillmoving11@gmail.com").trim(),
          api_key: resendKey,
          from_email: (values.resend_from_email || "Data1gh <onboarding@resend.dev>").replace(/Good Data/gi, "Data1gh"),
        },
      });
      if (res?.data?.ok) {
        setEmailTestResult({ ok: true, message: res.data.message });
        toast.success(res.data.message || `Test email successfully sent to ${targetEmail}!`);
      } else {
        const errMsg = res?.data?.error || "Failed to deliver test email.";
        setEmailTestResult({ ok: false, error: errMsg });
        toast.error(errMsg);
      }
    } catch (e: any) {
      const errMsg = e?.message || "Failed to trigger email test.";
      setEmailTestResult({ ok: false, error: errMsg });
      toast.error(errMsg);
    } finally {
      setTestingEmail(false);
    }
  };

  const fetchGroqModels = async () => {
    const key = (values.groq_api_key ?? "").trim();
    if (!key) {
      toast.error("Please enter your Groq API key first to discover available models");
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
        const err = res?.data?.error || res?.error?.message || "Could not retrieve models from Groq";
        toast.error(err);
      }
    } catch (e: any) {
      toast.error("Failed to fetch Groq models: " + (e?.message || "Network error"));
    } finally {
      setFetchingGroqModels(false);
    }
  };

  const fetchGeminiModels = async () => {
    const key = (values.gemini_api_key ?? "").trim();
    if (!key) {
      toast.error("Please enter your Google AI Studio API key first to discover available models");
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
        const err = res?.data?.error || res?.error?.message || "Could not retrieve models from Google AI Studio";
        toast.error(err);
      }
    } catch (e: any) {
      toast.error("Failed to fetch Gemini models: " + (e?.message || "Network error"));
    } finally {
      setFetchingGeminiModels(false);
    }
  };

  const testGroq = async () => {
    const key = (values.groq_api_key ?? "").trim();
    if (!key) {
      toast.error("Please enter a Groq API key first");
      return;
    }
    setGroqTesting(true);
    setGroqTestResult(null);
    try {
      const selectedModel = values.groq_model || "llama-3.3-70b-versatile";
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
    const key = (values.gemini_api_key ?? "").trim();
    if (!key) {
      toast.error("Please enter a Gemini API key first");
      return;
    }
    setGeminiTesting(true);
    setGeminiTestResult(null);
    try {
      const selectedModel =
        values.gemini_model || "gemini-3.8-flash";
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

  const testPaymentAlert = async () => {
    const alertPhone = (values.admin_payment_alert_phone || values.support_phone || values.admin_alert_phone || "").trim();
    const waPhone = (values.admin_whatsapp_number || alertPhone).trim();
    if (!alertPhone && !waPhone) {
      toast.error("Please enter your Admin Alert Phone or WhatsApp number first");
      return;
    }
    setTestingAlert(true);
    setPaymentAlertResult(null);
    try {
      const res = await invokeApiFunction("bulk-sms", {
        body: {
          action: "testPaymentAlert",
          phone: alertPhone,
          whatsapp_phone: waPhone,
          admin_whatsapp_number: waPhone,
          whatsapp_access_token: values.whatsapp_access_token,
          whatsapp_phone_id: values.whatsapp_phone_id,
        },
      });
      if (res?.data?.ok) {
        setPaymentAlertResult(res.data);
        toast.success(res.data.message || "Test payment alert dispatched to your phone!");
      } else {
        const err = res?.error?.message || res?.data?.error || res?.data?.message || "Failed to dispatch test payment alert";
        setPaymentAlertResult({
          ok: false,
          error: err,
          adminSmsSent: res?.data?.adminSmsSent,
          adminWhatsAppSent: res?.data?.adminWhatsAppSent,
          smsDetails: res?.data?.smsDetails,
          whatsappDetails: res?.data?.whatsappDetails,
        });
        toast.error(err);
      }
    } catch (e: any) {
      setPaymentAlertResult({ ok: false, error: e?.message || "Test alert failed" });
      toast.error("Test alert error: " + (e?.message || "Unknown error"));
    } finally {
      setTestingAlert(false);
    }
  };

  const testWhatsAppAlert = async () => {
    const waPhone = (values.admin_whatsapp_number || values.admin_payment_alert_phone || values.support_phone || "0547100951").trim();
    setTestingWhatsApp(true);
    setWhatsAppAlertResult(null);
    try {
      const res = await invokeApiFunction("bulk-sms", {
        body: {
          action: "testWhatsAppAlert",
          phone: waPhone,
          whatsapp_phone: waPhone,
          admin_whatsapp_number: waPhone,
          whatsapp_access_token: values.whatsapp_access_token,
          whatsapp_phone_id: values.whatsapp_phone_id,
        },
      });
      if (res?.data?.ok) {
        setWhatsAppAlertResult(res.data);
        toast.success(res.data.message || "Test WhatsApp payment alert delivered!");
      } else {
        const err = res?.data?.error || res?.data?.message || res?.data?.whatsappDetails || res?.error?.message || "WhatsApp alert delivery failed";
        setWhatsAppAlertResult({
          ok: false,
          error: err,
          whatsappDetails: res?.data?.whatsappDetails,
        });
        toast.error(err);
      }
    } catch (e: any) {
      setWhatsAppAlertResult({ ok: false, error: e?.message || "WhatsApp test failed" });
      toast.error("WhatsApp test error: " + (e?.message || "Unknown error"));
    } finally {
      setTestingWhatsApp(false);
    }
  };

  const testWithdrawalAlert = async () => {
    const waPhone = (values.admin_whatsapp_number || values.admin_payment_alert_phone || values.support_phone || "0547100951").trim();
    setTestingWithdrawalAlert(true);
    setWithdrawalAlertResult(null);
    try {
      const res = await invokeApiFunction("bulk-sms", {
        body: {
          action: "testWithdrawalAlert",
          phone: waPhone,
          whatsapp_phone: waPhone,
          admin_whatsapp_number: waPhone,
          whatsapp_access_token: values.whatsapp_access_token,
          whatsapp_phone_id: values.whatsapp_phone_id,
          store_name: values.shop_name || "Alpha Data Hub (Demo Store)",
          agent_name: "Kwame Mensah",
          momo_name: "Kwame Mensah MoMo",
          momo_network: "MTN",
          amount: "50.00",
        },
      });
      if (res?.data?.ok) {
        setWithdrawalAlertResult(res.data);
        toast.success(res.data.message || "Test WhatsApp withdrawal alert delivered!");
      } else {
        const err = res?.data?.error || res?.data?.message || res?.data?.whatsappDetails || res?.error?.message || "Withdrawal alert delivery failed";
        setWithdrawalAlertResult({
          ok: false,
          error: err,
          whatsappDetails: res?.data?.whatsappDetails,
          smsDetails: res?.data?.smsDetails,
          directWhatsAppUrl: res?.data?.directWhatsAppUrl,
        });
        toast.error(err);
      }
    } catch (e: any) {
      setWithdrawalAlertResult({ ok: false, error: e?.message || "Withdrawal alert test failed" });
      toast.error("Withdrawal alert test error: " + (e?.message || "Unknown error"));
    } finally {
      setTestingWithdrawalAlert(false);
    }
  };

  const testAgentRegAlert = async () => {
    const waPhone = (values.admin_whatsapp_number || values.admin_payment_alert_phone || values.support_phone || "0547100951").trim();
    setTestingAgentRegAlert(true);
    setAgentRegAlertResult(null);
    try {
      const res = await invokeApiFunction("bulk-sms", {
        body: {
          action: "testAgentRegistrationAlert",
          phone: waPhone,
          whatsapp_phone: waPhone,
          admin_whatsapp_number: waPhone,
          whatsapp_access_token: values.whatsapp_access_token,
          whatsapp_phone_id: values.whatsapp_phone_id,
          store_name: "Pretty Express Data",
          store_slug: "pretty-express-data",
          agent_name: "Pretty Owner",
        },
      });
      if (res?.data?.ok) {
        setAgentRegAlertResult(res.data);
        toast.success(res.data.message || "Test agent registration alerts sent!");
      } else {
        const err = res?.data?.error || res?.data?.message || "Registration alert test failed";
        setAgentRegAlertResult({
          ok: false,
          error: err,
          adminWhatsAppDetails: res?.data?.adminWhatsAppDetails,
          agentSmsDetails: res?.data?.agentSmsDetails,
          adminSmsDetails: res?.data?.adminSmsDetails,
          directWhatsAppUrl: res?.data?.directWhatsAppUrl,
        });
        toast.error(err);
      }
    } catch (e: any) {
      setAgentRegAlertResult({ ok: false, error: e?.message || "Registration alert test failed" });
      toast.error("Registration alert test error: " + (e?.message || "Unknown error"));
    } finally {
      setTestingAgentRegAlert(false);
    }
  };

  const testDatamart = async () => {
    const key = (values.datamart_api_key ?? '').trim();
    if (!key) {
      toast.error('Please enter your DataMart API key first');
      return;
    }
    setDatamartTesting(true);
    setDatamartResult(null);
    try {
      const res = await invokeApiFunction('admin-data', {
        body: {
          action: 'testDatamart',
          apiKey: key,
          apiSecret: (values.datamart_api_secret ?? '').trim(),
        },
      });
      if (res?.error) {
        setDatamartResult({ success: false, message: res.error.message || 'Failed to reach backend test endpoint' });
        toast.error('DataMart test failed: ' + (res.error.message || 'Network error'));
      } else if (res?.data?.success) {
        setDatamartResult(res.data);
        toast.success(res.data.message || 'DataMart connected successfully!');
      } else {
        setDatamartResult({ success: false, message: res?.data?.message || 'DataMart verification failed' });
        toast.error(res?.data?.message || 'DataMart verification failed');
      }
    } catch (e: any) {
      setDatamartResult({ success: false, message: e?.message || 'Test request failed' });
      toast.error('DataMart test error: ' + (e?.message || 'Unknown error'));
    } finally {
      setDatamartTesting(false);
    }
  };

  const testArkesel = async () => {
    const key = (values.arkesel_api_key ?? "").trim();
    if (!key) {
      toast.error("Please enter your Arkesel API key first");
      return;
    }
    setArkeselTesting(true);
    setArkeselResult(null);
    try {
      let resultData: any = null;
      let resultError: any = null;

      // 1. Try primary serverless endpoint
      const res = await invokeApiFunction("test-arkesel", {
        body: { api_key: key, action: "testArkesel" },
      });
      resultData = res?.data;
      resultError = res?.error;

      // 2. Fallback to Supabase edge function if server error
      if (!resultData && (resultError || !res)) {
        try {
          const edgeRes = await supabase.functions.invoke("bulk-sms", {
            body: { action: "checkBalance", api_key: key },
          });
          if (edgeRes?.data && !edgeRes?.error) {
            resultData = edgeRes.data;
            resultError = null;
          }
        } catch (_) {}
      }

      if (resultError || !resultData) {
        setArkeselResult({ ok: false, error: resultError?.message || "Failed to reach backend test endpoint" });
        toast.error("Arkesel test failed: " + (resultError?.message || "Network error"));
      } else if (resultData.ok) {
        setArkeselResult(resultData);
        toast.success(resultData.message || "Arkesel connected successfully!");
        setValues(v => ({
          ...v,
          arkesel_last_balance: String(resultData.sms_balance ?? ""),
          arkesel_main_balance: String(resultData.main_balance ?? ""),
        }));
      } else {
        setArkeselResult(resultData);
        toast.error(resultData.error || "Arkesel verification failed");
      }
    } catch (e: any) {
      setArkeselResult({ ok: false, error: e?.message || "Test request failed" });
      toast.error("Arkesel test failed: " + (e?.message || "Unknown error"));
    } finally {
      setArkeselTesting(false);
    }
  };

  useEffect(() => {
    document.title = "Admin · Settings";
    (async () => {
      // 0. Check local device cache
      const cached = getCacheMeta<Record<string, string>>("admin_settings_cache");
      if (cached.exists && cached.data) {
        setValues(cached.data);
        setLoading(false);
        if (!cached.isStale) return;
      }

      let loaded = false;
      try {
        const { data, error } = await invokeApiFunction("admin-data", { body: { action: "getSettings" } });
        if (!error && !data?.error && data?.settings) {
          const m: Record<string, string> = {};
          (data.settings || []).forEach((r: any) => (m[r.key] = r.value || ""));
          if (!m.support_phone && m.admin_alert_phone) {
            m.support_phone = m.admin_alert_phone;
          }
          if (!m.arkesel_sender_id) { m.arkesel_sender_id = "D_1Gh"; }
          if (!m.whatsapp_bot_url || m.whatsapp_bot_url.includes("U6W5JLVZV72WO1") || m.whatsapp_bot_url.includes("SRFE5G7CWA4CL1") || m.whatsapp_bot_url.includes("594641841") || m.whatsapp_bot_url.includes("593992226")) {
            m.whatsapp_bot_url = "https://wa.me/233200598553";
          }
          if (!m.datamart_api_key && m.DATA_API_KEY) m.datamart_api_key = m.DATA_API_KEY;
          if (!m.datamart_api_secret && m.DATAMART_API_SECRET) m.datamart_api_secret = m.DATAMART_API_SECRET;
          if (!m.datamart_api_secret && m.datamart_secret) m.datamart_api_secret = m.datamart_secret;
          if (!m.arkesel_api_key && m.ARKESEL_API_KEY) m.arkesel_api_key = m.ARKESEL_API_KEY;
          if (!m.akwaaba_api_key && m.AKWAABA_API_KEY) m.akwaaba_api_key = m.AKWAABA_API_KEY;
          if (!m.groq_api_key && m.GROQ_API_KEY) m.groq_api_key = m.GROQ_API_KEY;
          if (!m.gemini_api_key && m.GEMINI_API_KEY) m.gemini_api_key = m.GEMINI_API_KEY;
          if (!m.primary_ai_provider) m.primary_ai_provider = "groq";
          if (!m.groq_model) m.groq_model = "llama-3.3-70b-versatile";
          if (!m.gemini_model) {
            m.gemini_model = "gemini-3.8-flash";
          }
          if (!m.admin_whatsapp_number) {
            m.admin_whatsapp_number = m.admin_payment_alert_phone || m.support_phone || "0547100951";
          }
          if (!m.whatsapp_access_token && m.ACCESS_TOKEN) m.whatsapp_access_token = m.ACCESS_TOKEN;
          if (!m.whatsapp_phone_id && m.PHONE_ID) m.whatsapp_phone_id = m.PHONE_ID;
          if (!m.resend_api_key && m.RESEND_API_KEY) m.resend_api_key = m.RESEND_API_KEY;
          if (!m.brevo_api_key && m.BREVO_API_KEY) m.brevo_api_key = m.BREVO_API_KEY;
          if (!m.brevo_sender_email) m.brevo_sender_email = "stillmoving11@gmail.com";
          if (!m.resend_from_email || m.resend_from_email.includes("Good Data")) {
            m.resend_from_email = (m.resend_from_email || "Data1gh <onboarding@resend.dev>").replace(/Good Data/gi, "Data1gh");
          }
          if (!m.paystack_secret_key) {
            m.paystack_secret_key = m.PAYSTACK_SECRET_KEY || m.paystack_secret || m.PAYSTACK_SECRET || m.paystack_live_secret_key || "";
          }
          if (!m.paystack_public_key) {
            m.paystack_public_key = m.PAYSTACK_PUBLIC_KEY || m.paystack_public || m.PAYSTACK_PUBLIC || m.paystack_live_public_key || "";
          }
          setValues(m);
          setCache("admin_settings_cache", m, 5 * 60 * 1000);
          loaded = true;
        }
      } catch (_) {}

      if (!loaded) {
        try {
          const { data: settingsList } = await supabase
            .from("settings")
            .select("key, value")
            .not("key", "like", "agent_branding_%")
            .not("key", "like", "visitor_log_%");
          if (settingsList) {
            const m: Record<string, string> = {};
            settingsList.forEach((r: any) => (m[r.key] = r.value || ""));
            if (!m.support_phone && m.admin_alert_phone) {
              m.support_phone = m.admin_alert_phone;
            }
            if (!m.arkesel_sender_id) { m.arkesel_sender_id = "D_1Gh"; }
            if (!m.whatsapp_bot_url || m.whatsapp_bot_url.includes("U6W5JLVZV72WO1") || m.whatsapp_bot_url.includes("SRFE5G7CWA4CL1") || m.whatsapp_bot_url.includes("594641841") || m.whatsapp_bot_url.includes("593992226")) {
              m.whatsapp_bot_url = "https://wa.me/233200598553";
            }
            if (!m.datamart_api_key && m.DATA_API_KEY) m.datamart_api_key = m.DATA_API_KEY;
            if (!m.datamart_api_secret && m.DATAMART_API_SECRET) m.datamart_api_secret = m.DATAMART_API_SECRET;
            if (!m.datamart_api_secret && m.datamart_secret) m.datamart_api_secret = m.datamart_secret;
            if (!m.arkesel_api_key && m.ARKESEL_API_KEY) m.arkesel_api_key = m.ARKESEL_API_KEY;
            if (!m.akwaaba_api_key && m.AKWAABA_API_KEY) m.akwaaba_api_key = m.AKWAABA_API_KEY;
            if (!m.groq_api_key && m.GROQ_API_KEY) m.groq_api_key = m.GROQ_API_KEY;
            if (!m.gemini_api_key && m.GEMINI_API_KEY) m.gemini_api_key = m.GEMINI_API_KEY;
            if (!m.primary_ai_provider) m.primary_ai_provider = "groq";
            if (!m.groq_model) m.groq_model = "llama-3.3-70b-versatile";
            if (!m.gemini_model) {
              m.gemini_model = "gemini-3.8-flash";
            }
            if (!m.admin_whatsapp_number) {
              m.admin_whatsapp_number = m.admin_payment_alert_phone || m.support_phone || "0547100951";
            }
            if (!m.whatsapp_access_token && m.ACCESS_TOKEN) m.whatsapp_access_token = m.ACCESS_TOKEN;
            if (!m.whatsapp_phone_id && m.PHONE_ID) m.whatsapp_phone_id = m.PHONE_ID;
            if (!m.resend_api_key && m.RESEND_API_KEY) m.resend_api_key = m.RESEND_API_KEY;
            if (!m.brevo_api_key && m.BREVO_API_KEY) m.brevo_api_key = m.BREVO_API_KEY;
            if (!m.resend_from_email || m.resend_from_email.includes("Good Data")) {
              m.resend_from_email = (m.resend_from_email || "Data1gh <onboarding@resend.dev>").replace(/Good Data/gi, "Data1gh");
            }
            if (!m.paystack_secret_key) {
              m.paystack_secret_key = m.PAYSTACK_SECRET_KEY || m.paystack_secret || m.PAYSTACK_SECRET || m.paystack_live_secret_key || "";
            }
            if (!m.paystack_public_key) {
              m.paystack_public_key = m.PAYSTACK_PUBLIC_KEY || m.paystack_public || m.PAYSTACK_PUBLIC || m.paystack_live_public_key || "";
            }
            setValues(m);
            setCache("admin_settings_cache", m, 5 * 60 * 1000);
            loaded = true;
          }
        } catch (_) {}
      }

      setLoading(false);
    })();
  }, []);

  const save = async (silent = false) => {
    setSaving(true);
    const supportPhone = (values.support_phone ?? values.admin_alert_phone ?? "").trim();
    const rawRows = [
      ...KEYS.map(k => ({ key: k.key, value: (k.key === "support_phone" ? supportPhone : (values[k.key] ?? "")).trim() })),
      { key: "admin_alert_phone", value: supportPhone },
      { key: "datamart_api_key", value: (values.datamart_api_key ?? "").trim() },
      { key: "DATA_API_KEY", value: (values.datamart_api_key ?? "").trim() },
      { key: "datamart_api_secret", value: (values.datamart_api_secret ?? "").trim() },
      { key: "DATAMART_API_SECRET", value: (values.datamart_api_secret ?? "").trim() },
      { key: "arkesel_api_key", value: (values.arkesel_api_key ?? "").trim() },
      { key: "ARKESEL_API_KEY", value: (values.arkesel_api_key ?? "").trim() },
      { key: "arkesel_sender_id", value: (values.arkesel_sender_id || "").trim() },
      { key: "ARKESEL_SENDER_ID", value: (values.arkesel_sender_id || "").trim() },
      { key: "sender_id", value: (values.arkesel_sender_id || "").trim() },
      { key: "akwaaba_api_key", value: (values.akwaaba_api_key ?? "").trim() },
      { key: "AKWAABA_API_KEY", value: (values.akwaaba_api_key ?? "").trim() },
      { key: "gemini_api_key", value: (values.gemini_api_key ?? "").trim() },
      { key: "GEMINI_API_KEY", value: (values.gemini_api_key ?? "").trim() },
      { key: "groq_api_key", value: (values.groq_api_key ?? "").trim() },
      { key: "GROQ_API_KEY", value: (values.groq_api_key ?? "").trim() },
      { key: "primary_ai_provider", value: values.primary_ai_provider || "groq" },
      { key: "groq_model", value: values.groq_model || "llama-3.3-70b-versatile" },
      { key: "gemini_model", value: values.gemini_model || "gemini-3.8-flash" },
      { key: "ai_support_enabled", value: values.ai_support_enabled === "false" ? "false" : "true" },
      { key: "announcement_enabled", value: values.announcement_enabled === "true" ? "true" : "false" },
      { key: "announcement_title", value: values.announcement_title ?? "" },
      { key: "announcement_message", value: values.announcement_message ?? "" },
      { key: "spin_game_enabled", value: values.spin_game_enabled === "true" ? "true" : "false" },
      { key: "christmas_theme_enabled", value: values.christmas_theme_enabled === "false" ? "false" : "true" },
      { key: "auto_payment_sms_enabled", value: values.auto_payment_sms_enabled === "false" ? "false" : "true" },
      { key: "admin_whatsapp_number", value: (values.admin_whatsapp_number || values.admin_payment_alert_phone || supportPhone || "").trim() },
      { key: "admin_payment_alert_phone", value: (values.admin_whatsapp_number || values.admin_payment_alert_phone || supportPhone || "").trim() },
      { key: "admin_alert_phone", value: (values.admin_whatsapp_number || values.admin_payment_alert_phone || supportPhone || "").trim() },
      { key: "whatsapp_access_token", value: (values.whatsapp_access_token ?? "").trim() },
      { key: "ACCESS_TOKEN", value: (values.whatsapp_access_token ?? "").trim() },
      { key: "whatsapp_phone_id", value: (values.whatsapp_phone_id ?? "").trim() },
      { key: "PHONE_ID", value: (values.whatsapp_phone_id ?? "").trim() },
      { key: "resend_api_key", value: (values.resend_api_key ?? "").trim() },
      { key: "RESEND_API_KEY", value: (values.resend_api_key ?? "").trim() },
      { key: "brevo_api_key", value: (values.brevo_api_key ?? "").trim() },
      { key: "BREVO_API_KEY", value: (values.brevo_api_key ?? "").trim() },
      { key: "brevo_sender_email", value: (values.brevo_sender_email ?? "stillmoving11@gmail.com").trim() },
      { key: "resend_from_email", value: (values.resend_from_email ?? "Data1gh <onboarding@resend.dev>").replace(/Good Data/gi, "Data1gh").trim() },
      { key: "paystack_secret_key", value: (values.paystack_secret_key ?? "").trim() },
      { key: "PAYSTACK_SECRET_KEY", value: (values.paystack_secret_key ?? "").trim() },
      { key: "paystack_public_key", value: (values.paystack_public_key ?? "").trim() },
      { key: "PAYSTACK_PUBLIC_KEY", value: (values.paystack_public_key ?? "").trim() },
      { key: "customer_payment_sms_enabled", value: values.customer_payment_sms_enabled === "false" ? "false" : "true" },
    ];

    const m = new Map<string, { key: string; value: string }>();
    for (const r of rawRows) {
      if (r.key) m.set(r.key, r);
    }
    const rows = Array.from(m.values());

    let saved = false;
    let lastErrorMsg = "";
    try {
      const { data, error } = await invokeApiFunction("admin-data", { body: { action: "saveSettings", settings: rows } });
      if (!error && !data?.error) {
        saved = true;
      } else {
        lastErrorMsg = error?.message || data?.error || "";
      }
    } catch (err: any) {
      lastErrorMsg = err?.message || "";
    }

    if (!saved) {
      try {
        const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
        if (!error) {
          saved = true;
        } else {
          lastErrorMsg = error.message;
          if (!silent) toast.error("Could not save settings: " + error.message);
        }
      } catch (err: any) {
        lastErrorMsg = err.message || "";
        if (!silent) toast.error(err.message || "Failed to save settings");
      }
    }

    setSaving(false);
    if (saved) {
      invalidateCache("admin_settings_cache");
      invalidateShopCache();
      if (!silent) toast.success("Settings saved successfully");
    }
    return saved;
  };



  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin" /></div>;

  const announcementOn = values.announcement_enabled === "true";

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-black">Settings</h1>

      {/* Card 1: Store Branding & General (Indigo / Royal Blue) */}
      <Card className="overflow-hidden border-2 border-indigo-500/50 bg-gradient-to-br from-indigo-950/60 via-card to-blue-950/40 shadow-[0_8px_32px_rgba(99,102,241,0.2)] rounded-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
        <div className="p-4 md:p-6 space-y-4">
          <div className="flex items-start gap-3 pb-3 border-b border-indigo-500/20">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.25)] shrink-0">
              <Store className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-foreground">Store Branding &amp; Contacts</h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/35">
                  Store Identity
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                General shop profile, WhatsApp bot links, customer care contact, and Android APK distribution URL.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-1">
            {KEYS.map(k => (
              <div key={k.key} className="space-y-1.5">
                <Label htmlFor={k.key} className="font-semibold text-sm text-indigo-100">{k.label}</Label>
                <Input
                  id={k.key}
                  value={values[k.key] ?? ""}
                  onChange={e => setValues(v => ({ ...v, [k.key]: e.target.value }))}
                  placeholder={k.placeholder}
                  className="bg-background/70 border-indigo-500/30 focus-visible:ring-indigo-500/50"
                />
                <p className="text-xs text-muted-foreground">{k.help}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Card 2: Supplier & SMS API Gateways (Emerald / Teal) */}
      <Card className="overflow-hidden border-2 border-emerald-500/50 bg-gradient-to-br from-emerald-950/60 via-card to-teal-950/40 shadow-[0_8px_32px_rgba(16,185,129,0.2)] rounded-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />
        <div className="p-4 md:p-6 space-y-4">
          <div className="flex items-start gap-3 pb-3 border-b border-emerald-500/20">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)] shrink-0">
              <Wallet className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-foreground">Supplier &amp; SMS API Gateways</h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/35">
                  Gateways
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure Arkesel SMS for receipts &amp; alerts, DataMart for bundle delivery, and Akwaaba Sale.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-1">
            <div className="space-y-2 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/30">
              <div className="flex items-center justify-between">
                <Label htmlFor="arkesel_api_key" className="font-semibold text-sm text-emerald-300">Arkesel SMS API Key</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={arkeselTesting || !values.arkesel_api_key}
                  onClick={testArkesel}
                  className="h-7 text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200"
                >
                  {arkeselTesting ? (
                    <>
                      <Loader2 className="size-3 mr-1 animate-spin" /> Verifying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-3 mr-1" /> Test &amp; Fetch Balance
                    </>
                  )}
                </Button>
              </div>
              <Input
                id="arkesel_api_key"
                type="password"
                value={values.arkesel_api_key ?? ""}
                onChange={e => {
                  setValues(v => ({ ...v, arkesel_api_key: e.target.value }));
                  if (arkeselResult) setArkeselResult(null);
                }}
                placeholder="e.g. dnh4NG5..."
                className="bg-background/70 border-emerald-500/30 focus-visible:ring-emerald-500/40"
              />
              <p className="text-xs text-muted-foreground">
                Required for live Arkesel Balance, SMS Credits, and Bulk SMS dispatch. Sender ID: <strong>D_1Gh</strong>.
              </p>

              {arkeselResult && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-start gap-2 border ${
                    arkeselResult.ok
                      ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/40"
                      : "bg-rose-500/15 text-rose-200 border-rose-500/40"
                  }`}
                >
                  {arkeselResult.ok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0 text-rose-400 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <div className="font-bold">
                      {arkeselResult.ok ? "Arkesel Live Connection Verified" : "Arkesel Connection Failed"}
                    </div>
                    <div>
                      {arkeselResult.ok ? arkeselResult.message : arkeselResult.error}
                    </div>
                  </div>
                </div>
              )}

              {!arkeselResult && (values.arkesel_main_balance || values.arkesel_last_balance) && (
                <div className="text-[11px] text-emerald-200/90 bg-emerald-950/50 p-2 rounded-lg border border-emerald-500/30 flex items-center justify-between">
                  <span>
                    Last Synced: <strong>GH₵ {values.arkesel_main_balance || "0.00"}</strong> ({values.arkesel_last_balance || "0"} SMS credits)
                  </span>
                  <span className="text-[10px] opacity-75">Click &apos;Test &amp; Fetch Balance&apos; to refresh</span>
                </div>
              )}
            </div>

            <div className="space-y-2 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/30">
              <div className="flex items-center justify-between">
                <Label htmlFor="datamart_api_key" className="font-semibold text-sm text-emerald-300">DataMart API Key</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={datamartTesting || !values.datamart_api_key}
                  onClick={testDatamart}
                  className="h-7 text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200"
                >
                  {datamartTesting ? (
                    <>
                      <Loader2 className="size-3 mr-1 animate-spin" /> Verifying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-3 mr-1" /> Test Connection
                    </>
                  )}
                </Button>
              </div>
              <Input
                id="datamart_api_key"
                type="password"
                value={values.datamart_api_key ?? ""}
                onChange={e => {
                  setValues(v => ({ ...v, datamart_api_key: e.target.value }));
                  if (datamartResult) setDatamartResult(null);
                }}
                placeholder="e.g. dm_live_..."
                className="bg-background/60 border-emerald-500/25 focus-visible:ring-emerald-500/40"
              />
              <p className="text-xs text-muted-foreground">
                Used for Telecom Wallet balance, automated bundle delivery, and result checkers.
              </p>
              {datamartResult && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-center justify-between border ${
                    datamartResult.success
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  }`}
                >
                  <span>{datamartResult.message}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="datamart_api_secret" className="font-semibold text-sm text-emerald-100">DataMart API Secret (X-API-Secret)</Label>
              <Input
                id="datamart_api_secret"
                type="password"
                value={values.datamart_api_secret ?? ""}
                onChange={e => setValues(v => ({ ...v, datamart_api_secret: e.target.value }))}
                placeholder="Enter your DataMart API Secret (e.g. sec_...)"
                className="bg-background/60 border-emerald-500/25 focus-visible:ring-emerald-500/40"
              />
              <p className="text-xs text-muted-foreground">
                Required by DataMart developer API if your key was generated with an API Secret.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="akwaaba_api_key" className="font-semibold text-sm text-emerald-100">Akwaaba Sale API Key (Optional)</Label>
              <Input
                id="akwaaba_api_key"
                type="password"
                value={values.akwaaba_api_key ?? ""}
                onChange={e => setValues(v => ({ ...v, akwaaba_api_key: e.target.value }))}
                placeholder="e.g. ak_..."
                className="bg-background/60 border-emerald-500/25 focus-visible:ring-emerald-500/40"
              />
              <p className="text-xs text-muted-foreground">
                Secondary data fulfillment gateway balance and backup provider.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Card 2P: Paystack Payment Gateway & Automated MoMo Transfers */}
      <Card className="overflow-hidden border-2 border-cyan-500/50 bg-gradient-to-br from-cyan-950/60 via-card to-blue-950/40 shadow-[0_8px_32px_rgba(6,182,212,0.2)] rounded-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-500" />
        <div className="p-4 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-cyan-500/20">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)] shrink-0">
                <CreditCard className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg text-foreground">Paystack Payment Gateway &amp; Transfers</h2>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/35">
                    Live Payouts
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Powers store customer checkout payments and automated Ghana Mobile Money (MTN, Telecel, AT) profit payouts for agents.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
              className="h-8 text-xs border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20 hover:text-cyan-200 shrink-0"
            >
              <a href="https://dashboard.paystack.com/#/settings/developer" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5 mr-1" /> Paystack Dashboard
              </a>
            </Button>
          </div>

          <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-200/90 space-y-1.5">
            <div className="font-bold text-cyan-200 flex items-center gap-1.5">
              <Sparkles className="size-4 text-cyan-400" /> Automated Ghana MoMo Transfers Info
            </div>
            <p className="text-[11px] leading-relaxed text-cyan-300/80">
              1. Payouts require funds in your <strong>Paystack GHS Balance</strong> (transfer amount + GHS 1 network fee).<br />
              2. For seamless 1-click payouts without receiving SMS OTP prompts, disable <em>Transfer OTP</em> under Paystack Dashboard &rarr; <strong>Settings &rarr; Preferences &rarr; Transfers</strong>.<br />
              3. If using a Starter Business account, Paystack automated transfers are restricted by Paystack until upgraded — you can use <em>Mark Paid Manually</em> for those requests.
            </p>
          </div>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="paystack_secret_key" className="font-semibold text-sm text-cyan-200">
                  Paystack Secret Key (Live or Test)
                </Label>
                <button
                  type="button"
                  onClick={() => setShowPaystackKey(!showPaystackKey)}
                  className="text-xs text-cyan-300 hover:text-cyan-100 flex items-center gap-1"
                >
                  {showPaystackKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                  {showPaystackKey ? "Hide" : "Show"}
                </button>
              </div>
              <Input
                id="paystack_secret_key"
                type={showPaystackKey ? "text" : "password"}
                value={values.paystack_secret_key ?? ""}
                onChange={e => {
                  setValues(v => ({ ...v, paystack_secret_key: e.target.value }));
                  if (paystackTestResult) setPaystackTestResult(null);
                }}
                placeholder="sk_live_... or sk_test_..."
                className="bg-background/60 border-cyan-500/30 focus-visible:ring-cyan-500/50 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Required for processing customer checkout and initiating direct agent MoMo disbursements.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="paystack_public_key" className="font-semibold text-sm text-cyan-200">
                Paystack Public Key (Optional)
              </Label>
              <Input
                id="paystack_public_key"
                value={values.paystack_public_key ?? ""}
                onChange={e => setValues(v => ({ ...v, paystack_public_key: e.target.value }))}
                placeholder="pk_live_... or pk_test_..."
                className="bg-background/60 border-cyan-500/30 focus-visible:ring-cyan-500/50 font-mono text-sm"
              />
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Button
                type="button"
                disabled={testingPaystack}
                onClick={testPaystack}
                className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs gap-2 shadow-md shadow-cyan-900/40"
              >
                {testingPaystack ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                <span>Check Paystack Balance &amp; Transfer Status</span>
              </Button>
            </div>

            {paystackTestResult && (
              <div
                className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 border ${
                  paystackTestResult.ok
                    ? "bg-cyan-500/10 text-foreground border-cyan-500/40"
                    : "bg-rose-500/10 text-foreground border-rose-500/40"
                }`}
              >
                {paystackTestResult.ok ? (
                  <CheckCircle2 className="size-4 shrink-0 text-cyan-500 mt-0.5" />
                ) : (
                  <AlertCircle className="size-4 shrink-0 text-rose-500 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="font-bold text-sm text-foreground">
                    {paystackTestResult.ok ? "Paystack API Connected" : "Paystack Connection Failed"}
                  </div>
                  <div className="text-xs text-foreground/90 font-medium">
                    {paystackTestResult.ok ? paystackTestResult.message : paystackTestResult.error}
                  </div>
                  {paystackTestResult.ok && (paystackTestResult.balanceGHS ?? 0) === 0 && (
                    <div className="mt-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-[11px] leading-relaxed">
                      ⚠️ <strong>Paystack Balance is GH₵ 0.00:</strong> Automated MoMo payouts are deducted directly from your Paystack GHS balance (withdrawal amount + Paystack fee). Because your Paystack balance is currently GH₵ 0.00, any automated transfer attempt will be rejected by Paystack for insufficient balance. You can top up your Paystack balance on your <a href="https://dashboard.paystack.com" target="_blank" rel="noreferrer" className="underline font-bold text-foreground">Paystack Dashboard</a>, or use the <strong>&quot;Manual&quot;</strong> button in <em>Agent Reseller Portal &rarr; Withdrawals</em> after sending via phone MoMo (*170#).
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Card 2B: Email & Agent Verification Service (Resend API) */}
      <Card className="overflow-hidden border-2 border-violet-500/50 bg-gradient-to-br from-violet-950/60 via-card to-purple-950/40 shadow-[0_8px_32px_rgba(139,92,246,0.2)] rounded-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-violet-400 via-purple-500 to-indigo-500" />
        <div className="p-4 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-violet-500/20">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.25)] shrink-0">
                <Mail className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg text-foreground">Email &amp; Agent Verification</h2>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/35">
                    Resend API
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sends agent password reset verification codes and withdrawal OTPs directly to inbox. Codes are strictly private and never shown on screen.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
              className="h-8 text-xs border-violet-500/40 text-violet-300 hover:bg-violet-500/20 hover:text-violet-200 shrink-0"
            >
              <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5 mr-1" /> Get Resend Key
              </a>
            </Button>
          </div>

          <div className="p-3.5 rounded-xl bg-violet-500/10 border border-violet-500/30 text-xs text-violet-200/90 space-y-1.5">
            <div className="font-bold text-violet-200 flex items-center gap-1.5">
              <Sparkles className="size-4 text-violet-400" /> Free 3,000 Emails / Month via Resend
            </div>
            <p className="text-[11px] leading-relaxed text-violet-300/80">
              1. Sign up for free at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline font-semibold text-violet-200">resend.com</a>.<br />
              2. Go to <strong>API Keys</strong> &rarr; click <strong>Create API Key</strong> (Permissions: <em>Full access</em>).<br />
              3. Copy your key (starts with <code className="bg-black/30 px-1 py-0.5 rounded text-violet-300 font-mono">re_...</code>) and paste it below.
            </p>
          </div>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="resend_api_key" className="font-semibold text-sm text-violet-200">
                  Resend API Key
                </Label>
                <button
                  type="button"
                  onClick={() => setShowResendKey(!showResendKey)}
                  className="text-xs text-violet-300 hover:text-violet-100 flex items-center gap-1"
                >
                  {showResendKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                  {showResendKey ? "Hide" : "Show"}
                </button>
              </div>
              <Input
                id="resend_api_key"
                type={showResendKey ? "text" : "password"}
                value={values.resend_api_key ?? ""}
                onChange={e => {
                  setValues(v => ({ ...v, resend_api_key: e.target.value }));
                  if (emailTestResult) setEmailTestResult(null);
                }}
                placeholder="re_123456789_abcdef..."
                className="bg-background/60 border-violet-500/30 focus-visible:ring-violet-500/50 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Required for sending password reset codes and withdrawal verification codes.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resend_from_email" className="font-semibold text-sm text-violet-200">
                From Sender Email &amp; Name
              </Label>
              <Input
                id="resend_from_email"
                value={values.resend_from_email ?? ""}
                onChange={e => setValues(v => ({ ...v, resend_from_email: e.target.value }))}
                placeholder="Data1gh <onboarding@resend.dev>"
                className="bg-background/60 border-violet-500/30 focus-visible:ring-violet-500/50 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Use <code className="bg-black/30 px-1 py-0.5 rounded font-mono text-xs">Data1gh &lt;onboarding@resend.dev&gt;</code> for sandbox testing with your Resend signup email. To send to any registered agent email, add your domain at <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline font-semibold text-violet-200">resend.com/domains</a> or use Brevo below.
              </p>
            </div>

            {/* Brevo API Key & Sender Configuration */}
            <div className="space-y-3 p-3.5 rounded-xl border border-violet-500/30 bg-violet-950/20">
              <div className="flex items-center justify-between">
                <Label htmlFor="brevo_api_key" className="font-semibold text-xs text-violet-200 flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-violet-400" />
                  Brevo API Key (Sends to ANY email address without domain setup)
                </Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBrevoKey(!showBrevoKey)}
                    className="text-xs text-violet-300 hover:text-violet-100 flex items-center gap-1"
                  >
                    {showBrevoKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                    {showBrevoKey ? "Hide" : "Show"}
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-6 text-[10px] border-violet-500/40 text-violet-300 hover:bg-violet-500/20"
                  >
                    <a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3 mr-1" /> Get Brevo Key
                    </a>
                  </Button>
                </div>
              </div>
              <Input
                id="brevo_api_key"
                type={showBrevoKey ? "text" : "password"}
                value={values.brevo_api_key ?? ""}
                onChange={e => setValues(v => ({ ...v, brevo_api_key: e.target.value }))}
                placeholder="xkeysib-..."
                className="bg-background/60 border-violet-500/30 focus-visible:ring-violet-500/50 font-mono text-xs"
              />

              <div className="space-y-1">
                <Label htmlFor="brevo_sender_email" className="font-semibold text-xs text-violet-200">
                  Brevo Sender Email
                </Label>
                <Input
                  id="brevo_sender_email"
                  type="email"
                  value={values.brevo_sender_email ?? ""}
                  onChange={e => setValues(v => ({ ...v, brevo_sender_email: e.target.value }))}
                  placeholder="e.g. stillmoving11@gmail.com"
                  className="bg-background/60 border-violet-500/30 focus-visible:ring-violet-500/50 text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Must be your Brevo login email or an email address verified on your Brevo account (Settings &rarr; Senders).
                </p>
              </div>
            </div>

            {/* Interactive Live Email Tester */}
            <div className="p-3.5 rounded-xl border border-violet-500/30 bg-violet-950/30 space-y-3">
              <Label className="font-semibold text-xs text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
                <Send className="size-3.5 text-violet-400" /> Test Live Email Delivery (Brevo / Resend)
              </Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  value={testEmailRecipient}
                  onChange={e => setTestEmailRecipient(e.target.value)}
                  placeholder="Enter your email to receive test message"
                  className="bg-background/70 border-violet-500/30 focus-visible:ring-violet-500/50 text-xs h-9"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={testingEmail || (!values.brevo_api_key && !values.resend_api_key)}
                  onClick={testEmailDelivery}
                  className="bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs h-9 px-4 shrink-0 shadow-sm"
                >
                  {testingEmail ? (
                    <>
                      <Loader2 className="size-3.5 mr-1.5 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send className="size-3.5 mr-1.5" /> Send Test Email
                    </>
                  )}
                </Button>
              </div>

              {emailTestResult && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-start gap-2 border ${
                    emailTestResult.ok
                      ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/40"
                      : "bg-rose-500/15 text-rose-200 border-rose-500/40"
                  }`}
                >
                  {emailTestResult.ok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0 text-rose-400 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <div className="font-bold">
                      {emailTestResult.ok ? "Email Delivery Succeeded!" : "Delivery Failed"}
                    </div>
                    <div>
                      {emailTestResult.ok ? emailTestResult.message : emailTestResult.error}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Card 3: Automatic Payment Notifications (Amber / Sunburst Gold) */}
      <Card className="overflow-hidden border-2 border-amber-500/55 bg-gradient-to-br from-amber-950/65 via-card to-orange-950/45 shadow-[0_8px_32px_rgba(245,158,11,0.25)] rounded-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500" />
        <div className="p-4 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-amber-500/20">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)] shrink-0">
                <Bell className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg text-foreground">Instant Payment Notifications</h2>
                  <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full ${
                    values.auto_payment_sms_enabled !== "false"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}>
                    {values.auto_payment_sms_enabled !== "false" ? "Automatic SMS Active" : "Disabled"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Receive an automatic SMS and WhatsApp message the moment someone pays.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="auto_payment_sms_enabled" className="text-xs font-semibold text-amber-300">
                {values.auto_payment_sms_enabled !== "false" ? "Active" : "Disabled"}
              </Label>
              <Switch
                id="auto_payment_sms_enabled"
                checked={values.auto_payment_sms_enabled !== "false"}
                onCheckedChange={(c) => setValues(v => ({ ...v, auto_payment_sms_enabled: c ? "true" : "false" }))}
              />
            </div>
          </div>

          {/* Telco Protection Notice Banner */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200/90 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-200">
              <Sparkles className="size-4 text-amber-400" />
              <span>Sender ID: <strong>{values.arkesel_sender_id || "D_1Gh"}</strong> &bull; Automatic Payment Message Format</span>
            </div>
            <pre className="p-2.5 rounded-lg bg-black/40 border border-amber-500/30 text-[11px] font-mono text-amber-300 whitespace-pre-wrap leading-relaxed">
{`PAYMENT RECEIVED!
Shop: DataOne GH (or Agent Store Name)
Amount: GHS 15.00
Phone: 0541234567
Ref: WS7K9P2X
Status: Processing
Time: 06/10/2026 12:30`}
            </pre>
            <p className="text-[11px] text-amber-300/80">
              Clean format with zero carrier trigger words (&ldquo;data bundle&rdquo;) to prevent Ghanaian telcos (MTN, Telecel, AT) from blocking message delivery.
            </p>
          </div>

          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="admin_payment_alert_phone" className="font-semibold text-sm text-amber-200 flex items-center gap-1.5">
                  <Bell className="size-3.5 text-amber-400" />
                  Admin SMS Alert Phone (Ghana)
                </Label>
                <Input
                  id="admin_payment_alert_phone"
                  value={values.admin_payment_alert_phone ?? values.support_phone ?? values.admin_alert_phone ?? ""}
                  onChange={e => setValues(v => ({ ...v, admin_payment_alert_phone: e.target.value, admin_alert_phone: e.target.value }))}
                  placeholder="e.g. 0541234567 or 024xxxxxxx"
                  className="bg-background/60 border-amber-500/30 focus-visible:ring-amber-500/40"
                />
                <p className="text-xs text-muted-foreground">
                  Ghana number receiving instant SMS alerts via Arkesel (Sender ID: <strong>D_1Gh</strong>).
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin_whatsapp_number" className="font-semibold text-sm text-emerald-200 flex items-center gap-1.5">
                  <MessageSquare className="size-3.5 text-emerald-400" />
                  Admin WhatsApp Alert Phone
                </Label>
                <Input
                  id="admin_whatsapp_number"
                  value={values.admin_whatsapp_number || values.admin_payment_alert_phone || "0547100951"}
                  onChange={e => setValues(v => ({ ...v, admin_whatsapp_number: e.target.value }))}
                  placeholder="e.g. 0547100951 or 233547100951"
                  className="bg-background/60 border-emerald-500/30 focus-visible:ring-emerald-500/40"
                />
                <p className="text-xs text-muted-foreground">
                  WhatsApp number receiving instant order notifications via Meta Cloud API.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 p-3 rounded-xl bg-black/30 border border-emerald-500/20">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="whatsapp_access_token" className="font-semibold text-xs text-emerald-300">
                    Meta WhatsApp Cloud API Access Token
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowWaToken(!showWaToken)}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    {showWaToken ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                    {showWaToken ? "Hide" : "Show"}
                  </button>
                </div>
                <Input
                  id="whatsapp_access_token"
                  type={showWaToken ? "text" : "password"}
                  value={values.whatsapp_access_token ?? values.ACCESS_TOKEN ?? ""}
                  onChange={e => setValues(v => ({ ...v, whatsapp_access_token: e.target.value, ACCESS_TOKEN: e.target.value }))}
                  placeholder="EAAG... (System User or Meta Cloud API Token)"
                  className="font-mono text-xs bg-background/60 border-emerald-500/25 focus-visible:ring-emerald-500/40"
                />
                <p className="text-[11px] text-muted-foreground">
                  Permanent or temporary System User Token from Meta WhatsApp Developer Dashboard.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="whatsapp_phone_id" className="font-semibold text-xs text-emerald-300">
                  Meta WhatsApp Phone Number ID
                </Label>
                <Input
                  id="whatsapp_phone_id"
                  value={values.whatsapp_phone_id ?? values.PHONE_ID ?? ""}
                  onChange={e => setValues(v => ({ ...v, whatsapp_phone_id: e.target.value, PHONE_ID: e.target.value }))}
                  placeholder="e.g. 104829384729104"
                  className="font-mono text-xs bg-background/60 border-emerald-500/25 focus-visible:ring-emerald-500/40"
                />
                <p className="text-[11px] text-muted-foreground">
                  Found under Meta Developer App &rarr; WhatsApp &rarr; API Setup &rarr; <em>Phone number ID</em>.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-950/25 border border-amber-500/25">
              <div>
                <div className="text-sm font-semibold text-amber-200">Send Payment Receipt SMS to Customer</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Disabled by default. SMS alerts are delivered strictly to the admin.
                </p>
              </div>
              <Switch
                checked={values.customer_payment_sms_enabled === "true"}
                onCheckedChange={(c) => setValues(v => ({ ...v, customer_payment_sms_enabled: c ? "true" : "false" }))}
              />
            </div>

            {/* Test Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-amber-500/20">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testingWhatsApp}
                  onClick={testWhatsAppAlert}
                  className="text-xs gap-1.5 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
                >
                  {testingWhatsApp ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Testing WhatsApp...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="size-3.5 text-emerald-400" /> Send Test WhatsApp Alert
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testingWithdrawalAlert}
                  onClick={testWithdrawalAlert}
                  className="text-xs gap-1.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
                >
                  {testingWithdrawalAlert ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Testing Withdrawal Alert...
                    </>
                  ) : (
                    <>
                      <Wallet className="size-3.5 text-amber-400" /> Test Withdrawal Alert (WhatsApp)
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testingAgentRegAlert}
                  onClick={testAgentRegAlert}
                  className="text-xs gap-1.5 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20"
                >
                  {testingAgentRegAlert ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Testing Agent Alert...
                    </>
                  ) : (
                    <>
                      <Store className="size-3.5 text-cyan-400" /> Test New Agent Alert (SMS & WhatsApp)
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testingAlert}
                  onClick={testPaymentAlert}
                  className="text-xs gap-1.5 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  {testingAlert ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Sending Test SMS...
                    </>
                  ) : (
                    <>
                      <Bell className="size-3.5 text-zinc-400" /> Send Test SMS Alert
                    </>
                  )}
                </Button>
              </div>

              <span className="text-[11px] text-amber-400/80 font-medium">
                SMS Sender ID: <strong>D_1Gh</strong>
              </span>
            </div>

            {/* Withdrawal Alert Test Feedback */}
            {withdrawalAlertResult && (
              <div className={`p-3 rounded-xl text-xs space-y-1.5 border ${
                withdrawalAlertResult.ok
                  ? "bg-amber-500/15 text-amber-200 border-amber-500/40"
                  : "bg-rose-500/15 text-rose-200 border-rose-500/40"
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  {withdrawalAlertResult.ok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-amber-400" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0 text-rose-400" />
                  )}
                  <span>{withdrawalAlertResult.ok ? "Withdrawal WhatsApp Alert Delivered!" : "Withdrawal Alert Delivery Issue"}</span>
                </div>
                <div className="text-[11px] leading-relaxed">
                  {withdrawalAlertResult.message || withdrawalAlertResult.error}
                </div>
                {(withdrawalAlertResult.whatsappDetails || withdrawalAlertResult.smsDetails) && (
                  <div className="p-2 rounded bg-black/40 border border-white/10 font-mono text-[10px] text-muted-foreground space-y-1 break-all">
                    {withdrawalAlertResult.whatsappDetails && <div>WhatsApp: {withdrawalAlertResult.whatsappDetails}</div>}
                    {withdrawalAlertResult.smsDetails && <div>SMS: {withdrawalAlertResult.smsDetails}</div>}
                  </div>
                )}
                {withdrawalAlertResult.directWhatsAppUrl && (
                  <a
                    href={withdrawalAlertResult.directWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-300 hover:underline mt-1"
                  >
                    <ExternalLink className="size-3" /> Open in WhatsApp Web / App
                  </a>
                )}
              </div>
            )}

            {/* Agent Registration Alert Feedback */}
            {agentRegAlertResult && (
              <div className={`p-3 rounded-xl text-xs space-y-1.5 border ${
                agentRegAlertResult.ok
                  ? "bg-cyan-500/15 text-cyan-200 border-cyan-500/40"
                  : "bg-rose-500/15 text-rose-200 border-rose-500/40"
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  {agentRegAlertResult.ok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-cyan-400" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0 text-rose-400" />
                  )}
                  <span>{agentRegAlertResult.ok ? "New Agent Alert & Welcome SMS Dispatched!" : "Agent Registration Alert Issue"}</span>
                </div>
                <div className="text-[11px] leading-relaxed">
                  {agentRegAlertResult.message || agentRegAlertResult.error}
                </div>
                {(agentRegAlertResult.adminWhatsAppDetails || agentRegAlertResult.agentSmsDetails || agentRegAlertResult.adminSmsDetails) && (
                  <div className="p-2 rounded bg-black/40 border border-white/10 font-mono text-[10px] text-muted-foreground space-y-1 break-all">
                    {agentRegAlertResult.agentSmsDetails && <div>Agent SMS: {agentRegAlertResult.agentSmsDetails}</div>}
                    {agentRegAlertResult.adminWhatsAppDetails && <div>Admin WhatsApp: {agentRegAlertResult.adminWhatsAppDetails}</div>}
                    {agentRegAlertResult.adminSmsDetails && <div>Admin SMS: {agentRegAlertResult.adminSmsDetails}</div>}
                  </div>
                )}
                {agentRegAlertResult.storeUrl && (
                  <div className="text-[11px] text-zinc-300">
                    Generated Store Link: <span className="font-mono text-cyan-300 font-bold">{agentRegAlertResult.storeUrl}</span>
                  </div>
                )}
                {agentRegAlertResult.directWhatsAppUrl && (
                  <a
                    href={agentRegAlertResult.directWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-cyan-300 hover:underline mt-1"
                  >
                    <ExternalLink className="size-3" /> Open in WhatsApp Web / App
                  </a>
                )}
              </div>
            )}

            {/* WhatsApp Test Feedback */}
            {whatsAppAlertResult && (
              <div className={`p-3 rounded-xl text-xs space-y-1.5 border ${
                whatsAppAlertResult.ok
                  ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/40"
                  : "bg-rose-500/15 text-rose-200 border-rose-500/40"
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  {whatsAppAlertResult.ok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0 text-rose-400" />
                  )}
                  <span>{whatsAppAlertResult.ok ? "WhatsApp Alert Delivered Successfully!" : "WhatsApp Alert Not Delivered"}</span>
                </div>
                <div className="text-[11px] leading-relaxed">
                  {whatsAppAlertResult.message || whatsAppAlertResult.error}
                </div>
                {whatsAppAlertResult.whatsappDetails && (
                  <div className="p-2 rounded bg-black/40 border border-white/10 font-mono text-[10px] text-muted-foreground break-all">
                    Diagnostics: {whatsAppAlertResult.whatsappDetails}
                  </div>
                )}
              </div>
            )}

            {/* Payment / SMS Alert Feedback */}
            {paymentAlertResult && (
              <div className={`p-3 rounded-xl text-xs space-y-1.5 border ${
                paymentAlertResult.ok
                  ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/40"
                  : "bg-rose-500/15 text-rose-200 border-rose-500/40"
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  {paymentAlertResult.ok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0 text-rose-400" />
                  )}
                  <span>{paymentAlertResult.ok ? "Payment Alert Dispatched!" : "Alert Dispatch Issue"}</span>
                </div>
                <div className="text-[11px] leading-relaxed">
                  {paymentAlertResult.message || paymentAlertResult.error}
                </div>
                {(paymentAlertResult.smsDetails || paymentAlertResult.whatsappDetails) && (
                  <div className="p-2 rounded bg-black/40 border border-white/10 font-mono text-[10px] text-muted-foreground space-y-1">
                    {paymentAlertResult.smsDetails && <div>SMS: {paymentAlertResult.smsDetails}</div>}
                    {paymentAlertResult.whatsappDetails && <div>WhatsApp: {paymentAlertResult.whatsappDetails}</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Card 4: AI Customer Support & Live Chat (Cosmic Violet / Deep Purple) */}
      <Card className="overflow-hidden border-2 border-purple-500/50 bg-gradient-to-br from-purple-950/60 via-card to-violet-950/40 shadow-[0_8px_32px_rgba(168,85,247,0.2)] rounded-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500" />
        <div className="p-4 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-purple-500/20">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.25)] shrink-0">
                <Bot className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg text-foreground">AI Customer Support &amp; Live Chat</h2>
                  <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full ${
                    values.ai_support_enabled !== "false"
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}>
                    {values.ai_support_enabled !== "false" ? "AI Live Chat Online" : "Paused"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Powers 24/7 intelligent live chat support on Data One, answering customer questions with relaxed human vibe.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="ai_support_enabled" className="text-xs font-semibold text-purple-300">
                {values.ai_support_enabled !== "false" ? "Active" : "Paused"}
              </Label>
              <Switch
                id="ai_support_enabled"
                checked={values.ai_support_enabled !== "false"}
                onCheckedChange={(c) => setValues(v => ({ ...v, ai_support_enabled: c ? "true" : "false" }))}
              />
            </div>
          </div>

          <div className="space-y-4 pt-1">
            {/* Fallback & Engine Overview Banner */}
            <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs text-purple-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="font-bold text-white flex items-center gap-1.5 text-sm">
                  <Sparkles className="size-4 text-purple-400" /> Multi-Model Automated Fallback Engine
                </span>
                <p className="text-[11px] text-purple-300/80">
                  Chat &amp; Voice cascade seamlessly: Primary engine answers in real-time. If quota or connection drops, the secondary engine takes over instantly with zero downtime.
                </p>
              </div>

              {/* Primary Engine Selector */}
              <div className="flex items-center gap-2 shrink-0 bg-background/40 p-1.5 rounded-lg border border-purple-500/30">
                <Cpu className="size-4 text-purple-300 ml-1 shrink-0" />
                <div className="text-left">
                  <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Primary Engine</div>
                  <Select
                    value={values.primary_ai_provider || "groq"}
                    onValueChange={(val) => setValues(v => ({ ...v, primary_ai_provider: val }))}
                  >
                    <SelectTrigger className="h-7 w-[180px] bg-background text-xs font-semibold border-purple-500/40">
                      <SelectValue placeholder="Select Primary Engine" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="groq" className="text-xs">⚡ Groq (Llama 3.3 Primary)</SelectItem>
                      <SelectItem value="gemini" className="text-xs">✨ Google Gemini Primary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Groq AI Input, Model Selector & Test */}
            <div className="space-y-3 p-4 rounded-2xl bg-purple-950/20 border border-purple-500/25">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="groq_api_key" className="font-semibold text-sm text-purple-100 flex items-center gap-2">
                    <span>Groq AI API Key</span>
                    <span className="text-[10px] text-emerald-300 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      Ultra-Fast (50-200ms)
                    </span>
                  </Label>
                  {values.primary_ai_provider !== "gemini" && (
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
                  disabled={groqTesting || !values.groq_api_key}
                  className="h-7 text-xs border-purple-500/40 hover:bg-purple-900/40 text-purple-200 gap-1.5"
                >
                  {groqTesting ? (
                    <>
                      <Loader2 className="size-3 animate-spin text-purple-400" />
                      <span>Testing Groq…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3 text-purple-400" />
                      <span>Test Groq Connection</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Groq Model Selector */}
              <div className="space-y-1.5 pt-1">
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
                    disabled={fetchingGroqModels || !values.groq_api_key}
                    className="h-6 text-[11px] text-purple-300 hover:text-purple-100 hover:bg-purple-900/40 px-2 gap-1"
                    title="Connect to Groq API and fetch all available models"
                  >
                    <RefreshCw className={`size-3 text-purple-400 ${fetchingGroqModels ? "animate-spin" : ""}`} />
                    <span>{fetchingGroqModels ? "Loading…" : "Fetch Live Models"}</span>
                  </Button>
                </div>

                <Select
                  value={values.groq_model || "llama-3.3-70b-versatile"}
                  onValueChange={(val) => setValues(v => ({ ...v, groq_model: val }))}
                >
                  <SelectTrigger className="h-9 bg-background/80 text-xs border-purple-500/30">
                    <SelectValue placeholder="Select Groq Model" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {groqLiveModels.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                          Live Models From Your Account ({groqLiveModels.length})
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
                      Verified High-Performance Models
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

              <Input
                id="groq_api_key"
                type="password"
                value={values.groq_api_key ?? ""}
                onChange={e => setValues(v => ({ ...v, groq_api_key: e.target.value }))}
                placeholder="gsk_..."
                className="bg-background/60 border-purple-500/25 focus-visible:ring-purple-500/40"
              />
              <p className="text-xs text-muted-foreground">
                Get a free ultra-fast Groq key at{" "}
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 underline font-medium hover:text-purple-300"
                >
                  console.groq.com
                </a>{" "}
                (Powers instant, natural human responses with selected Groq model).
              </p>

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
                        <span>Connected successfully to Groq ({groqTestResult.model}) in {groqTestResult.latencyMs}ms</span>
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

            {/* Gemini AI Input, Model Selector & Test */}
            <div className="space-y-3 p-4 rounded-2xl bg-purple-950/20 border border-purple-500/25">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="gemini_api_key" className="font-semibold text-sm text-purple-100 flex items-center gap-2">
                    <span>Google Gemini AI API Key</span>
                    <span className="text-[10px] text-purple-300 font-bold bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded-full">
                      Free Tier
                    </span>
                  </Label>
                  {values.primary_ai_provider === "gemini" && (
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
                  disabled={geminiTesting || !values.gemini_api_key}
                  className="h-7 text-xs border-purple-500/40 hover:bg-purple-900/40 text-purple-200 gap-1.5"
                >
                  {geminiTesting ? (
                    <>
                      <Loader2 className="size-3 animate-spin text-purple-400" />
                      <span>Testing Gemini…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3 text-purple-400" />
                      <span>Test Gemini Connection</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Gemini Model Selector */}
              <div className="space-y-1.5 pt-1">
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
                    disabled={fetchingGeminiModels || !values.gemini_api_key}
                    className="h-6 text-[11px] text-purple-300 hover:text-purple-100 hover:bg-purple-900/40 px-2 gap-1"
                    title="Connect to Google AI Studio and fetch all available models"
                  >
                    <RefreshCw className={`size-3 text-purple-400 ${fetchingGeminiModels ? "animate-spin" : ""}`} />
                    <span>{fetchingGeminiModels ? "Loading…" : "Fetch Live Models from AIS"}</span>
                  </Button>
                </div>

                <Select
                  value={values.gemini_model || "gemini-3.8-flash"}
                  onValueChange={(val) => setValues(v => ({ ...v, gemini_model: val }))}
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

              <Input
                id="gemini_api_key"
                type="password"
                value={values.gemini_api_key ?? ""}
                onChange={e => setValues(v => ({ ...v, gemini_api_key: e.target.value }))}
                placeholder="AIzaSy..."
                className="bg-background/60 border-purple-500/25 focus-visible:ring-purple-500/40"
              />
              <p className="text-xs text-muted-foreground">
                Get a 100% free Gemini API key at{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 underline font-medium hover:text-purple-300"
                >
                  aistudio.google.com
                </a>{" "}
                (zero payment or credit card needed, supports Gemini 2.0 Flash &amp; Gemini 1.5 Flash).
              </p>

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
                        <span>Connected successfully to Gemini ({geminiTestResult.model}) in {geminiTestResult.latencyMs}ms</span>
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

            <div className="rounded-xl p-3.5 bg-purple-950/25 border border-purple-500/25 text-xs space-y-1">
              <div className="font-semibold text-purple-200 flex items-center gap-1.5 text-sm">
                <Bell className="size-4 text-purple-400" /> Alert SMS Recipient Number
              </div>
              <p className="text-muted-foreground">
                Order failure and issue alerts will be sent directly to your Support Phone Number:
              </p>
              <div className="font-mono font-bold text-sm text-purple-300 pt-0.5">
                {values.support_phone || "Not set yet (enter your phone number under Store Branding above)"}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Card 5: Announcement Popup (Electric Rose / Crimson) */}
      <Card className="overflow-hidden border-2 border-rose-500/50 bg-gradient-to-br from-rose-950/60 via-card to-pink-950/40 shadow-[0_8px_32px_rgba(244,63,94,0.2)] rounded-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-pink-500 to-red-500" />
        <div className="p-4 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-rose-500/20">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.25)] shrink-0">
                <Megaphone className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg text-foreground">Announcement Popup</h2>
                  <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full ${
                    announcementOn
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}>
                    {announcementOn ? "Popup Active" : "Disabled"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Shown to customers as an announcement modal the first time they visit the shop.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="announcement_enabled" className="text-xs font-semibold text-rose-300">
                {announcementOn ? "On" : "Off"}
              </Label>
              <Switch
                id="announcement_enabled"
                checked={announcementOn}
                onCheckedChange={(c) => setValues(v => ({ ...v, announcement_enabled: c ? "true" : "false" }))}
              />
            </div>
          </div>

          <div className="space-y-3.5 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="announcement_title" className="font-semibold text-sm text-rose-100">Title</Label>
              <Input
                id="announcement_title"
                value={values.announcement_title ?? ""}
                onChange={e => setValues(v => ({ ...v, announcement_title: e.target.value }))}
                placeholder="🎉 Special offer!"
                className="bg-background/60 border-rose-500/25 focus-visible:ring-rose-500/40"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="announcement_message" className="font-semibold text-sm text-rose-100">Message</Label>
              <Textarea
                id="announcement_message"
                rows={3}
                value={values.announcement_message ?? ""}
                onChange={e => setValues(v => ({ ...v, announcement_message: e.target.value }))}
                placeholder="Special promo on all MTN data bundles this weekend!"
                className="bg-background/60 border-rose-500/25 focus-visible:ring-rose-500/40"
              />
              <p className="text-xs text-muted-foreground">Leave empty to hide the popup, or turn the switch off.</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Card 6: Spin & Win Lucky Wheel (Cyan / Turquoise) */}
      <Card className="overflow-hidden border-2 border-cyan-500/50 bg-gradient-to-br from-cyan-950/60 via-card to-teal-950/40 shadow-[0_8px_32px_rgba(6,182,212,0.2)] rounded-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-500" />
        <div className="p-4 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-cyan-500/20">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)] shrink-0">
                <Sparkles className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg text-foreground">Spin &amp; Win Lucky Wheel</h2>
                  <span
                    className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full ${
                      values.spin_game_enabled === "true"
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {values.spin_game_enabled === "true" ? "Wheel Active on Storefront" : "Disabled"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Visitors can spin to win 1GB or 2GB free data reward codes directly on your store.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="spin_game_enabled" className="text-xs font-semibold text-cyan-300">
                {values.spin_game_enabled === "true" ? "On" : "Off"}
              </Label>
              <Switch
                id="spin_game_enabled"
                checked={values.spin_game_enabled === "true"}
                onCheckedChange={(c) => setValues(v => ({ ...v, spin_game_enabled: c ? "true" : "false" }))}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Card 7: 🎄 Festive Christmas Design Toggle */}
      <Card className="overflow-hidden border-2 border-red-500/50 bg-gradient-to-br from-red-950/60 via-card to-emerald-950/40 shadow-[0_8px_32px_rgba(239,68,68,0.2)] rounded-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500" />
        <div className="p-4 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-red-500/20">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.25)] shrink-0 text-xl">
                🎅
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg text-foreground">Christmas Season Festive Design</h2>
                  <span
                    className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full ${
                      values.christmas_theme_enabled !== "false"
                        ? "bg-red-500/20 text-red-300 border border-red-500/40 font-black"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {values.christmas_theme_enabled !== "false" ? "🎄 Christmas Design Active" : "Default Design Active"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  When enabled, shows Santa hats on logos &amp; network pills, snowfall, hanging fairy lights, and Father Christmas Reindeer Sleigh across both Main Store and Agent Storefronts. When turned off, the default design is restored everywhere.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="christmas_theme_enabled" className="text-xs font-semibold text-red-300">
                {values.christmas_theme_enabled !== "false" ? "On" : "Off"}
              </Label>
              <Switch
                id="christmas_theme_enabled"
                checked={values.christmas_theme_enabled !== "false"}
                onCheckedChange={(c) => {
                  const val = c ? "true" : "false";
                  setValues(v => ({ ...v, christmas_theme_enabled: val }));
                  try {
                    localStorage.setItem("christmas_theme_enabled", val);
                    window.dispatchEvent(new CustomEvent("christmas-theme-changed", { detail: c }));
                  } catch (_) {}
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      <Button onClick={() => save()} disabled={saving} className="bg-gradient-gold text-accent-foreground font-bold shadow-glow hover:opacity-90 h-11 px-6 text-sm">
        {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
        Save all settings
      </Button>
    </div>
  );
};

export default AdminSettings;

