import React, { useState, useEffect } from "react";
import { invokeApiFunction, supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Store,
  Wallet,
  Users,
  Sliders,
  Clock,
  Settings,
  Search,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Check,
  LogIn,
  Ban,
  Trash2,
  PlusCircle,
  DollarSign,
  ShoppingBag,
  Send,
  CreditCard,
  RotateCcw,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Lock,
  Rocket,
  Edit2,
} from "lucide-react";
import { toast } from "sonner";
import { formatGHS, NETWORK_LABEL, networkClass, DEFAULT_PRODUCTS } from "@/lib/networks";

export const AdminAgents: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"agents" | "orders" | "pricing" | "withdrawals" | "settings">("agents");

  // Agents list
  const [agents, setAgents] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Agent Orders
  const [agentOrders, setAgentOrders] = useState<any[]>([]);
  const [loadingAgentOrders, setLoadingAgentOrders] = useState(false);
  const [orderAgentFilter, setOrderAgentFilter] = useState("all");
  const [orderNetworkFilter, setOrderNetworkFilter] = useState("ALL");
  const [orderDateFilter, setOrderDateFilter] = useState("");
  const [orderSearch, setOrderSearch] = useState("");

  // Agent Management Modal State
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [selectedAgentForCredit, setSelectedAgentForCredit] = useState<any>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [creditSubmitting, setCreditSubmitting] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedAgentForDelete, setSelectedAgentForDelete] = useState<any>(null);
  const [deletingAgent, setDeletingAgent] = useState(false);

  // Edit Credentials Modal State
  const [credModalOpen, setCredModalOpen] = useState(false);
  const [selectedAgentForCred, setSelectedAgentForCred] = useState<any>(null);
  const [credName, setCredName] = useState("");
  const [credEmail, setCredEmail] = useState("");
  const [credPhone, setCredPhone] = useState("");
  const [credPassword, setCredPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [credStoreName, setCredStoreName] = useState("");
  const [credStoreSlug, setCredStoreSlug] = useState("");
  const [credWhatsapp, setCredWhatsapp] = useState("");
  const [credMomoNumber, setCredMomoNumber] = useState("");
  const [credMomoName, setCredMomoName] = useState("");
  const [credMomoNetwork, setCredMomoNetwork] = useState("MTN");
  const [credSubmitting, setCredSubmitting] = useState(false);

  // Base Prices
  const [basePrices, setBasePrices] = useState<Record<string, number>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [savingPrices, setSavingPrices] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<string>("ALL");
  const [pricingCategory, setPricingCategory] = useState<"data" | "services" | "boost">("data");
  const [preserveAgentProfit, setPreserveAgentProfit] = useState<boolean>(true);

  // Social Media Boost Margin Management Modal State
  const [boostModalOpen, setBoostModalOpen] = useState(false);
  const [selectedAgentForBoost, setSelectedAgentForBoost] = useState<any>(null);
  const [boostMarkupInput, setBoostMarkupInput] = useState<number>(25);
  const [savingAgentBoost, setSavingAgentBoost] = useState(false);

  const handleOpenBoostMarginModal = (agent: any) => {
    setSelectedAgentForBoost(agent);
    const current = Number(agent?.custom_prices?.boost_markup_percent);
    setBoostMarkupInput(Number.isFinite(current) ? current : 25);
    setBoostModalOpen(true);
  };

  const handleSaveAgentBoostMargin = async () => {
    if (!selectedAgentForBoost?.id) return;
    setSavingAgentBoost(true);
    try {
      const updatedCustomPrices = {
        ...(selectedAgentForBoost.custom_prices || {}),
        boost_markup_percent: Math.max(0, Math.min(500, Number(boostMarkupInput) || 0)),
      };
      const res = await invokeApiFunction("agent", {
        body: {
          action: "updateProducts",
          agent_id: selectedAgentForBoost.id,
          custom_prices: updatedCustomPrices,
        },
      });
      if (res?.data?.ok) {
        toast.success(`Updated ${selectedAgentForBoost.name}'s Social Boost margin to +${boostMarkupInput}%!`);
        setBoostModalOpen(false);
        loadAgents(true);
      } else {
        toast.error(res?.data?.error || "Failed to update agent margin.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save margin.");
    } finally {
      setSavingAgentBoost(false);
    }
  };

  // Universal Batch Boost Margin Control (One place to set for all agents)
  const [globalBoostMarkupInput, setGlobalBoostMarkupInput] = useState("25");
  const [applyingGlobalBoost, setApplyingGlobalBoost] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("settings")
          .select("value")
          .in("key", ["default_agent_boost_markup_percent", "agent_boost_default_markup_percent"])
          .maybeSingle();
        if (data?.value && Number.isFinite(Number(data.value))) {
          setGlobalBoostMarkupInput(String(data.value));
        }
      } catch (_) {}
    })();
  }, []);

  const handleApplyBoostMarginToAll = async () => {
    const num = Number(globalBoostMarkupInput);
    if (isNaN(num) || num < 0 || num > 500) {
      toast.error("Please enter a valid percentage between 0% and 500%.");
      return;
    }

    if (!confirm(`Are you sure you want to set +${num}% Social Boost profit margin for ALL ${agents.length} resellers?`)) {
      return;
    }

    setApplyingGlobalBoost(true);
    try {
      const res = await invokeApiFunction("agent", {
        body: {
          action: "setAllAgentsBoostMarkup",
          boost_markup_percent: num,
        },
      });

      if (res?.data?.ok) {
        toast.success(`🎉 Applied +${num}% Social Boost margin to all ${res?.data?.updated_count || agents.length} agents!`);
        setAgents((prev) =>
          prev.map((ag) => ({
            ...ag,
            custom_prices: {
              ...(ag.custom_prices || {}),
              boost_markup_percent: num,
            },
          }))
        );
        loadAgents(true);
      } else {
        toast.error(res?.data?.error || "Failed to apply margin to all agents.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to apply margin to all agents.");
    } finally {
      setApplyingGlobalBoost(false);
    }
  };

  // Withdrawals
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
  const [processingWithdrawalId, setProcessingWithdrawalId] = useState<string | null>(null);

  // Automated Paystack & Manual Withdrawal Modals State
  const [paystackModalOpen, setPaystackModalOpen] = useState(false);
  const [selectedWithdrawalForPaystack, setSelectedWithdrawalForPaystack] = useState<any>(null);
  const [paystackError, setPaystackError] = useState("");
  const [paystackDisbursing, setPaystackDisbursing] = useState(false);

  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [selectedWithdrawalForManual, setSelectedWithdrawalForManual] = useState<any>(null);
  const [manualReference, setManualReference] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedWithdrawalForReject, setSelectedWithdrawalForReject] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  // Agent Settings
  const [minWithdrawal, setMinWithdrawal] = useState("5.00");
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    document.title = "Admin · Agent Reseller Portal";
    loadAgents();
  }, []);

  useEffect(() => {
    if (activeTab === "agents") loadAgents();
    else if (activeTab === "orders") loadAgentOrdersList();
    else if (activeTab === "pricing") loadBasePrices();
    else if (activeTab === "withdrawals") loadWithdrawals();
  }, [activeTab]);

  const loadAgentOrdersList = async () => {
    setLoadingAgentOrders(true);
    try {
      const res = await invokeApiFunction("admin-agents", {
        body: { action: "adminGetOrders", force: true },
      });
      if (res?.data?.ok && Array.isArray(res.data.orders)) {
        setAgentOrders(res.data.orders);
      } else if (res?.error) {
        toast.error(res.error.message || "Failed to load agent orders.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load agent orders.");
    } finally {
      setLoadingAgentOrders(false);
    }
  };

  const loadAgents = async () => {
    setLoadingAgents(true);
    try {
      const res = await invokeApiFunction("admin-agents", {
        body: { action: "adminGetAgents", force: true },
      });
      if (res?.data?.ok && Array.isArray(res.data.agents)) {
        setAgents(res.data.agents);
      } else if (res?.error) {
        toast.error(res.error.message || "Failed to load agents.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load agents.");
    } finally {
      setLoadingAgents(false);
    }
  };

  const loadBasePrices = async () => {
    setLoadingPrices(true);
    try {
      const res = await invokeApiFunction("admin-agents", {
        body: { action: "adminGetBasePrices" },
      });
      if (res?.data?.ok && res.data.base_prices) {
        setBasePrices(res.data.base_prices);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load base prices.");
    } finally {
      setLoadingPrices(false);
    }
  };

  const handleSaveBasePrices = async () => {
    setSavingPrices(true);
    try {
      const res = await invokeApiFunction("admin-agents", {
        body: {
          action: "adminUpdateBasePrices",
          base_prices: basePrices,
          preserve_agent_profit: preserveAgentProfit,
        },
      });
      if (res?.data?.ok) {
        toast.success(res.data.message || "Agent base wholesale prices updated!");
        loadAgents();
      } else {
        toast.error(res?.data?.error || "Failed to update base prices.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to save prices.");
    } finally {
      setSavingPrices(false);
    }
  };

  const loadWithdrawals = async () => {
    setLoadingWithdrawals(true);
    try {
      const res = await invokeApiFunction("admin-agents", {
        body: { action: "adminGetWithdrawals" },
      });
      if (res?.data?.ok && Array.isArray(res.data.withdrawals)) {
        setWithdrawals(res.data.withdrawals);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load withdrawals.");
    } finally {
      setLoadingWithdrawals(false);
    }
  };

  const handleOpenPaystackModal = (w: any) => {
    setSelectedWithdrawalForPaystack(w);
    setPaystackError("");
    setPaystackModalOpen(true);
  };

  const executePaystackDisbursement = async (w: any) => {
    if (!w?.id) return;
    setPaystackDisbursing(true);
    setProcessingWithdrawalId(w.id);
    setPaystackError("");
    try {
      const res = await invokeApiFunction("admin-agents", {
        body: {
          action: "adminApproveWithdrawal",
          withdrawal_id: w.id,
          manual: false,
        },
      });
      if (res?.data?.ok) {
        toast.success(
          res.data.message ||
            `Payout of GH₵ ${Number(w.amount).toFixed(2)} disbursed to ${w.momo_name || "Agent"} via Paystack!`
        );
        setPaystackModalOpen(false);
        setSelectedWithdrawalForPaystack(null);
        loadWithdrawals();
        loadAgents();
      } else {
        const errMsg = res?.data?.error || "Paystack transfer initiation failed.";
        setPaystackError(errMsg);
        toast.error(errMsg);
      }
    } catch (e: any) {
      const errMsg = e?.message || "Error connecting to Paystack service.";
      setPaystackError(errMsg);
      toast.error(errMsg);
    } finally {
      setPaystackDisbursing(false);
      setProcessingWithdrawalId(null);
    }
  };

  const handleOpenManualModal = (w: any) => {
    setSelectedWithdrawalForManual(w);
    setManualReference("");
    setManualModalOpen(true);
  };

  const executeManualApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWithdrawalForManual?.id) return;
    setManualSubmitting(true);
    setProcessingWithdrawalId(selectedWithdrawalForManual.id);
    try {
      const res = await invokeApiFunction("admin-agents", {
        body: {
          action: "adminApproveWithdrawal",
          withdrawal_id: selectedWithdrawalForManual.id,
          manual: true,
          reference: manualReference.trim(),
        },
      });
      if (res?.data?.ok) {
        toast.success("Withdrawal approved and marked as completed manually!");
        setManualModalOpen(false);
        setSelectedWithdrawalForManual(null);
        loadWithdrawals();
        loadAgents();
      } else {
        toast.error(res?.data?.error || "Failed to mark withdrawal as completed.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Error approving withdrawal.");
    } finally {
      setManualSubmitting(false);
      setProcessingWithdrawalId(null);
    }
  };

  const handleOpenRejectModal = (w: any) => {
    setSelectedWithdrawalForReject(w);
    setRejectReason("Payment could not be processed / Invalid MoMo wallet details");
    setRejectModalOpen(true);
  };

  const executeRejectWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWithdrawalForReject?.id) return;
    setRejectSubmitting(true);
    setProcessingWithdrawalId(selectedWithdrawalForReject.id);
    try {
      const res = await invokeApiFunction("admin-agents", {
        body: {
          action: "adminRejectWithdrawal",
          withdrawal_id: selectedWithdrawalForReject.id,
          reason: rejectReason.trim() || "Payment could not be processed",
        },
      });
      if (res?.data?.ok) {
        toast.success("Withdrawal rejected and balance refunded to agent!");
        setRejectModalOpen(false);
        setSelectedWithdrawalForReject(null);
        loadWithdrawals();
        loadAgents();
      } else {
        toast.error(res?.data?.error || "Failed to reject withdrawal.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Error rejecting withdrawal.");
    } finally {
      setRejectSubmitting(false);
      setProcessingWithdrawalId(null);
    }
  };

  // -------------------------------------------------------------
  // Agent Control Handlers: Suspend, Impersonate, Credit, Delete
  // -------------------------------------------------------------
  const handleToggleSuspend = async (agent: any) => {
    const isCurrentlySuspended = agent.status === "suspended";
    const nextStatus = isCurrentlySuspended ? "active" : "suspended";
    const confirmMsg = isCurrentlySuspended
      ? `Reactivate agent "${agent.name}" (${agent.store_name})? Their store will be unlocked and they can log in again.`
      : `Suspend agent "${agent.name}" (${agent.store_name})? Their store will be locked and login will be blocked.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await invokeApiFunction("admin-agents", {
        body: { action: "adminToggleSuspendAgent", agent_id: agent.id, status: nextStatus },
      });
      if (res?.data?.ok) {
        toast.success(res.data.message || `Agent ${nextStatus === "suspended" ? "suspended" : "reactivated"}!`);
        loadAgents();
      } else {
        toast.error(res?.data?.error || "Failed to update agent status.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Error updating agent status.");
    }
  };

  const handleImpersonate = (agent: any) => {
    try {
      localStorage.setItem("data1_agent_token", `agent_impersonate_${agent.id}`);
      localStorage.setItem("data1_agent_profile", JSON.stringify(agent));
      toast.success(`⚡ Direct Login: Logged in as ${agent.name}! Opening dashboard...`);
      window.open("/agent/dashboard", "_blank");
    } catch {
      toast.error("Failed to launch agent session.");
    }
  };

  const handleOpenCredModal = (agent: any) => {
    setSelectedAgentForCred(agent);
    setCredName(agent.name || "");
    setCredEmail(agent.email || "");
    setCredPhone(agent.phone || "");
    setCredPassword(agent.raw_password || agent.password || "");
    setShowPassword(false);
    setCredStoreName(agent.store_name || "");
    setCredStoreSlug(agent.store_slug || "");
    setCredWhatsapp(agent.whatsapp_number || agent.phone || "");
    setCredMomoNumber(agent.momo_number || agent.phone || "");
    setCredMomoName(agent.momo_name || agent.name || "");
    setCredMomoNetwork(agent.momo_network || "MTN");
    setCredModalOpen(true);
  };

  const handleGenerateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let rand = "";
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const generated = `Data#${rand}`;
    setCredPassword(generated);
    setShowPassword(true);
    toast.info(`Generated new password: ${generated}`);
  };

  const handleCopyLoginDetails = async () => {
    if (!selectedAgentForCred) return;
    const loginUrl = `${window.location.origin}/agent/login`;
    const storeUrl = `${window.location.origin}/s/${credStoreSlug || selectedAgentForCred.store_slug}`;
    const text = `*🔐 DATA1GH AGENT LOGIN CREDENTIALS*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Agent Name:* ${credName || selectedAgentForCred.name}\n🏪 *Store Name:* ${credStoreName || selectedAgentForCred.store_name}\n\n📱 *Login Phone:* ${credPhone || selectedAgentForCred.phone}\n📧 *Login Email:* ${credEmail || selectedAgentForCred.email || "—"}\n🔑 *Password:* ${credPassword || selectedAgentForCred.raw_password || "(Unchanged)"}\n\n👉 *Login Here:* ${loginUrl}\n🛍️ *Storefront URL:* ${storeUrl}\n━━━━━━━━━━━━━━━━━━━━\nKeep your password secure!`;

    try {
      await navigator.clipboard.writeText(text);
      toast.success("Agent login credentials copied to clipboard!");
    } catch {
      toast.error("Could not copy automatically. Please select and copy manually.");
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForCred?.id) return;
    if (!credEmail.trim() && !credPhone.trim()) {
      toast.error("Agent must have either an email or a phone number for login.");
      return;
    }
    setCredSubmitting(true);
    try {
      const res = await invokeApiFunction("admin-agents", {
        body: {
          action: "adminUpdateAgentCredentials",
          agent_id: selectedAgentForCred.id,
          name: credName.trim(),
          email: credEmail.trim(),
          phone: credPhone.trim(),
          password: credPassword.trim(),
          store_name: credStoreName.trim(),
          store_slug: credStoreSlug.trim(),
          whatsapp_number: credWhatsapp.trim(),
          momo_number: credMomoNumber.trim(),
          momo_name: credMomoName.trim(),
          momo_network: credMomoNetwork,
        },
      });
      if (res?.data?.ok) {
        toast.success(res.data.message || "Agent credentials updated successfully!");
        setCredModalOpen(false);
        loadAgents();
      } else {
        toast.error(res?.data?.error || "Failed to update agent credentials.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error updating credentials.");
    } finally {
      setCredSubmitting(false);
    }
  };

  const handleOpenCreditModal = (agent: any) => {
    setSelectedAgentForCredit(agent);
    setCreditAmount("");
    setCreditNote("Admin Wallet Credit");
    setCreditModalOpen(true);
  };

  const handleCreditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForCredit?.id) return;
    const amt = parseFloat(creditAmount);
    if (isNaN(amt) || amt === 0) {
      toast.error("Please enter a valid credit or debit amount.");
      return;
    }
    setCreditSubmitting(true);
    try {
      const res = await invokeApiFunction("admin-agents", {
        body: {
          action: "adminCreditAgent",
          agent_id: selectedAgentForCredit.id,
          amount: amt,
          note: creditNote.trim() || "Admin Wallet Adjustment",
        },
      });
      if (res?.data?.ok) {
        toast.success(res.data.message || "Agent wallet credited!");
        setCreditModalOpen(false);
        loadAgents();
      } else {
        toast.error(res?.data?.error || "Failed to credit agent wallet.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Error crediting wallet.");
    } finally {
      setCreditSubmitting(false);
    }
  };

  const handleOpenDeleteModal = (agent: any) => {
    setSelectedAgentForDelete(agent);
    setDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!selectedAgentForDelete?.id) return;
    const targetId = selectedAgentForDelete.id;
    setDeletingAgent(true);
    try {
      const res = await invokeApiFunction("admin-agents", {
        body: { action: "adminDeleteAgent", agent_id: targetId },
        timeoutMs: 30000,
      });
      if (res?.data?.ok) {
        toast.success("Agent account deleted permanently.");
        setDeleteModalOpen(false);
        setSelectedAgentForDelete(null);
        setAgents((prev) => prev.filter((a) => a.id !== targetId));
        setFilteredAgents((prev) => prev.filter((a) => a.id !== targetId));
        loadAgents();
      } else {
        // If a client timeout happened or the server already completed deletion
        const isTimeout =
          res?.error?.message?.toLowerCase().includes("timed out") ||
          res?.error?.message?.toLowerCase().includes("aborted");

        if (isTimeout) {
          toast.success("Agent account deleted permanently.");
          setDeleteModalOpen(false);
          setSelectedAgentForDelete(null);
          setAgents((prev) => prev.filter((a) => a.id !== targetId));
          setFilteredAgents((prev) => prev.filter((a) => a.id !== targetId));
          loadAgents();
          return;
        }

        const err = res?.data?.error || res?.error?.message || "Failed to delete agent.";
        toast.error(err);
      }
    } catch (e: any) {
      toast.error(e?.message || "Error deleting agent.");
    } finally {
      setDeletingAgent(false);
    }
  };

  const [resettingAgentId, setResettingAgentId] = useState<string | null>(null);

  const handleResetAgentStats = async (agentId?: string) => {
    const isAll = !agentId || agentId === "all";
    const promptMsg = isAll
      ? "Are you sure you want to RESET ALL AGENTS' stats to GH₵ 0.00? This clears all test agent orders and withdrawals across the entire reseller network."
      : "Are you sure you want to reset this agent's stats to GH₵ 0.00? This clears all their test orders and withdrawals.";
    if (!window.confirm(promptMsg)) return;

    setResettingAgentId(agentId || "all");
    try {
      const res = await invokeApiFunction("admin-agents", {
        body: {
          action: "adminResetAgentStats",
          agent_id: agentId || "all",
        },
      });
      if (res?.data?.ok) {
        toast.success(res.data.message || "Agent stats reset to GH₵ 0.00 successfully!");
        await loadAgents();
        if (activeTab === "orders") await loadAgentOrdersList();
        if (activeTab === "withdrawals") await loadWithdrawals();
      } else {
        toast.error(res?.data?.error || "Failed to reset agent stats.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to reset agent stats.");
    } finally {
      setResettingAgentId(null);
    }
  };

  // Filter agents by search query
  const filteredAgents = agents.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (a.name || "").toLowerCase().includes(q) ||
      (a.email || "").toLowerCase().includes(q) ||
      (a.phone || "").includes(q) ||
      (a.store_name || "").toLowerCase().includes(q) ||
      (a.store_slug || "").toLowerCase().includes(q)
    );
  });

  const filteredProducts = DEFAULT_PRODUCTS.filter((p) => {
    if (selectedNetwork === "ALL") return true;
    return (p.network || "").toUpperCase() === selectedNetwork;
  });

  const filteredAgentOrders = agentOrders.filter((o) => {
    if (orderAgentFilter !== "all" && o.agent_id !== orderAgentFilter) return false;
    if (orderNetworkFilter !== "ALL" && (o.network || "").toUpperCase() !== orderNetworkFilter) return false;
    if (orderDateFilter) {
      const d = (o.created_at || "").split("T")[0];
      if (d !== orderDateFilter) return false;
    }
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase().trim();
      const match =
        (o.reference || "").toLowerCase().includes(q) ||
        (o.phone || "").includes(q) ||
        (o.agent_name || "").toLowerCase().includes(q) ||
        (o.store_name || "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const totalAgentOrdersVolume = filteredAgentOrders.reduce((acc, o) => acc + (Number(o.amount) || 0), 0);
  const totalAgentOrdersProfit = filteredAgentOrders.reduce((acc, o) => acc + (Number(o.agent_profit) || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-cyan-950/40 via-card to-zinc-900 border border-cyan-500/30 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="size-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shadow-[0_0_25px_rgba(6,182,212,0.3)] shrink-0">
            <Store className="size-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-foreground flex items-center gap-2">
              <span>Agent &amp; Reseller Management</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {agents.length} Registered
              </span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage reseller accounts, set wholesale base prices, and disburse MoMo profit withdrawals.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (activeTab === "agents") loadAgents();
            else if (activeTab === "orders") loadAgentOrdersList();
            else if (activeTab === "pricing") loadBasePrices();
            else if (activeTab === "withdrawals") loadWithdrawals();
          }}
          className="rounded-xl border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-bold gap-1.5 self-start md:self-auto"
        >
          <RefreshCw className="size-3.5" />
          <span>Refresh Data</span>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border/50 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("agents")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === "agents"
              ? "bg-cyan-500 text-black shadow-md font-black"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Users className="size-3.5" />
          <span>Registered Agents ({agents.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("orders")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === "orders"
              ? "bg-cyan-500 text-black shadow-md font-black"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <ShoppingBag className="size-3.5" />
          <span>Agent Orders ({agentOrders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("pricing")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === "pricing"
              ? "bg-cyan-500 text-black shadow-md font-black"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Sliders className="size-3.5" />
          <span>Agent Base Wholesale Pricing</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("withdrawals")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === "withdrawals"
              ? "bg-cyan-500 text-black shadow-md font-black"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Wallet className="size-3.5" />
          <span>Withdrawal Requests</span>
          {withdrawals.filter((w) => w.status === "pending").length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-black">
              {withdrawals.filter((w) => w.status === "pending").length} Pending
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: REGISTERED AGENTS */}
      {activeTab === "agents" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, phone, store..."
                className="pl-9 h-10 rounded-xl bg-card border-border/60 text-xs"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                Total Agents: <strong className="text-foreground">{filteredAgents.length}</strong>
              </div>
            </div>
          </div>

          {loadingAgents ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="size-6 animate-spin text-cyan-400" />
              <span className="text-xs">Loading registered agents...</span>
            </div>
          ) : filteredAgents.length === 0 ? (
            <Card className="p-12 rounded-3xl border border-dashed border-border text-center space-y-2">
              <Store className="size-8 text-muted-foreground mx-auto" />
              <div className="font-bold text-sm text-foreground">No agents found</div>
              <p className="text-xs text-muted-foreground">
                Registered resellers will appear here with live statistics and wallet balances.
              </p>
            </Card>
          ) : (
            <div className="rounded-3xl border border-border/60 bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3.5 font-bold">Agent Name</th>
                      <th className="p-3.5 font-bold">Storefront &amp; Link</th>
                      <th className="p-3.5 font-bold">Phone / MoMo</th>
                      <th className="p-3.5 font-bold text-fuchsia-400">Boost Margin %</th>
                      <th className="p-3.5 font-bold text-emerald-400">Today&apos;s Profit</th>
                      <th className="p-3.5 font-bold text-amber-400">Wallet Balance</th>
                      <th className="p-3.5 font-bold">Total Earned</th>
                      <th className="p-3.5 font-bold">Status</th>
                      <th className="p-3.5 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredAgents.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5">
                          <div className="font-bold text-foreground">{a.name}</div>
                          <div className="text-[11px] text-muted-foreground">{a.email}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-foreground">{a.store_name}</div>
                          <a
                            href={`/s/${a.store_slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 font-mono text-[11px] inline-flex items-center gap-1 hover:underline mt-0.5"
                          >
                            <span>/s/{a.store_slug}</span>
                            <ExternalLink className="size-3" />
                          </a>
                        </td>
                        <td className="p-3.5 font-mono text-foreground">
                          <div>{a.phone}</div>
                          <div className="text-[10px] text-muted-foreground">{a.momo_network} &bull; {a.momo_number}</div>
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenBoostMarginModal(a)}
                            className="px-2.5 py-1 rounded-full text-xs font-mono font-black bg-fuchsia-500/15 text-fuchsia-400 border border-fuchsia-500/30 hover:bg-fuchsia-500/25 transition-all flex items-center gap-1.5 group cursor-pointer"
                            title="Click to view or edit this agent's boost percentage"
                          >
                            <Rocket className="size-3 text-fuchsia-400 group-hover:rotate-12 transition-transform" />
                            <span>+{a.custom_prices?.boost_markup_percent ?? 25}%</span>
                            <Edit2 className="size-2.5 opacity-60 group-hover:opacity-100" />
                          </button>
                        </td>
                        <td className="p-3.5 font-bold text-emerald-400 font-mono whitespace-nowrap">
                          {formatGHS(a.today_profit ?? a.todayProfit ?? 0)}
                          <span className="text-[10px] font-normal text-muted-foreground block">
                            {a.today_orders_count ?? a.todayOrdersCount ?? 0} orders
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-amber-400 font-mono whitespace-nowrap">
                          {formatGHS(a.wallet_balance ?? a.walletBalance ?? 0)}
                        </td>
                        <td className="p-3.5 font-mono text-muted-foreground whitespace-nowrap">
                          {formatGHS(a.total_profit ?? a.totalProfit ?? 0)}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            a.status === "active" || !a.status
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}>
                            {a.status || "active"}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                            {/* Impersonate / Direct Login */}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleImpersonate(a)}
                              className="h-8 px-2 rounded-lg border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-[11px] font-bold gap-1 shadow-xs"
                              title="Login to agent dashboard"
                            >
                              <LogIn className="size-3.5" />
                              <span className="hidden sm:inline">Login</span>
                            </Button>

                            {/* Edit Login Credentials */}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenCredModal(a)}
                              className="h-8 px-2 rounded-lg border-indigo-500/40 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-[11px] font-bold gap-1 shadow-xs"
                              title="Edit login email, phone, password & profile"
                            >
                              <KeyRound className="size-3.5" />
                              <span className="hidden sm:inline">Credentials</span>
                            </Button>

                            {/* Credit Wallet */}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenCreditModal(a)}
                              className="h-8 px-2 rounded-lg border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-bold gap-1 shadow-xs"
                              title="Credit or adjust agent wallet"
                            >
                              <PlusCircle className="size-3.5" />
                              <span className="hidden sm:inline">Credit</span>
                            </Button>

                            {/* Suspend / Activate */}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleSuspend(a)}
                              className={`h-8 px-2 rounded-lg text-[11px] font-bold gap-1 shadow-xs ${
                                a.status === "suspended"
                                  ? "border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300"
                                  : "border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300"
                              }`}
                              title={a.status === "suspended" ? "Reactivate agent" : "Suspend agent account"}
                            >
                              {a.status === "suspended" ? (
                                <>
                                  <CheckCircle2 className="size-3.5" />
                                  <span className="hidden sm:inline">Activate</span>
                                </>
                              ) : (
                                <>
                                  <Ban className="size-3.5" />
                                  <span className="hidden sm:inline">Suspend</span>
                                </>
                              )}
                            </Button>

                            {/* Reset Stats to 0.00 */}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleResetAgentStats(a.id)}
                              disabled={resettingAgentId === a.id}
                              className="h-8 px-2 rounded-lg border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[11px] font-bold gap-1 shadow-xs"
                              title="Reset this agent's stats and wallet balance to 0.00"
                            >
                              {resettingAgentId === a.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="size-3.5" />
                              )}
                              <span className="hidden sm:inline">Reset 0.00</span>
                            </Button>

                            {/* Delete Agent */}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenDeleteModal(a)}
                              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                              title="Delete agent account"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: AGENT ORDERS */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Card className="p-4 rounded-2xl border border-border/60 bg-card shadow-xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Agent Orders Count</span>
              <div className="text-2xl font-black text-foreground mt-1">
                {filteredAgentOrders.length}
                <span className="text-xs font-normal text-muted-foreground ml-1.5">orders</span>
              </div>
            </Card>

            <Card className="p-4 rounded-2xl border border-border/60 bg-card shadow-xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Customer Sales Volume</span>
              <div className="text-2xl font-black text-foreground mt-1 font-mono">
                {formatGHS(totalAgentOrdersVolume)}
              </div>
            </Card>

            <Card className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">Total Agent Commission Profit</span>
              <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">
                +{formatGHS(totalAgentOrdersProfit)}
              </div>
            </Card>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search phone, reference, or agent..."
                className="pl-9 h-10 rounded-xl bg-card border-border/60 text-xs"
              />
            </div>

            {/* Agent Select */}
            <select
              value={orderAgentFilter}
              onChange={(e) => setOrderAgentFilter(e.target.value)}
              className="h-10 px-3 rounded-xl bg-card border border-border/60 text-xs font-semibold text-foreground focus:outline-none"
            >
              <option value="all">All Agents ({agents.length})</option>
              {agents.map((ag) => (
                <option key={ag.id} value={ag.id}>
                  {ag.store_name} ({ag.name})
                </option>
              ))}
            </select>

            {/* Network Selector */}
            <div className="flex items-center gap-1 bg-card border border-border/60 rounded-xl p-1">
              {["ALL", "MTN", "TELECEL", "AT"].map((net) => (
                <button
                  key={net}
                  type="button"
                  onClick={() => setOrderNetworkFilter(net)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    orderNetworkFilter === net
                      ? "bg-cyan-500 text-black shadow-xs font-black"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {net}
                </button>
              ))}
            </div>

            {/* Date Input */}
            <Input
              type="date"
              value={orderDateFilter}
              onChange={(e) => setOrderDateFilter(e.target.value)}
              className="h-10 w-36 rounded-xl bg-card border-border/60 text-xs font-mono"
            />

            {(orderSearch || orderAgentFilter !== "all" || orderNetworkFilter !== "ALL" || orderDateFilter) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOrderSearch("");
                  setOrderAgentFilter("all");
                  setOrderNetworkFilter("ALL");
                  setOrderDateFilter("");
                }}
                className="h-10 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear Filters
              </Button>
            )}
          </div>

          {/* Table */}
          {loadingAgentOrders ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="size-6 animate-spin text-cyan-400" />
              <span className="text-xs">Loading agent orders...</span>
            </div>
          ) : filteredAgentOrders.length === 0 ? (
            <Card className="p-12 rounded-3xl border border-dashed border-border text-center space-y-2">
              <ShoppingBag className="size-8 text-muted-foreground mx-auto" />
              <div className="font-bold text-sm text-foreground">No agent orders found</div>
              <p className="text-xs text-muted-foreground">
                Orders placed through agent storefronts will appear here with live profits and statuses.
              </p>
            </Card>
          ) : (
            <div className="rounded-3xl border border-border/60 bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3.5 font-bold">Date &amp; Ref</th>
                      <th className="p-3.5 font-bold">Agent Store</th>
                      <th className="p-3.5 font-bold">Package</th>
                      <th className="p-3.5 font-bold">Recipient Phone</th>
                      <th className="p-3.5 font-bold">Customer Paid</th>
                      <th className="p-3.5 font-bold">Wholesale Cost</th>
                      <th className="p-3.5 font-bold text-emerald-400">Agent Profit</th>
                      <th className="p-3.5 font-bold">Delivery Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredAgentOrders.map((o) => (
                      <tr key={o.id || o.reference} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          <div>{o.created_at ? new Date(o.created_at).toLocaleString("en-GB") : "N/A"}</div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[120px] font-mono">{o.reference}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-foreground">{o.store_name || "Agent Store"}</div>
                          <div className="text-[11px] text-muted-foreground">{o.agent_name}</div>
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase mr-1.5 ${networkClass(o.network)}`}>
                            {o.network}
                          </span>
                          <span className="font-bold text-foreground">{o.package_size || "Data"}</span>
                        </td>
                        <td className="p-3.5 font-mono text-foreground font-semibold">
                          {o.phone || "—"}
                        </td>
                        <td className="p-3.5 font-bold text-foreground font-mono">
                          {formatGHS(o.amount || 0)}
                        </td>
                        <td className="p-3.5 text-muted-foreground font-mono">
                          {formatGHS(o.base_price || 0)}
                        </td>
                        <td className="p-3.5 font-bold text-emerald-400 font-mono whitespace-nowrap">
                          +{formatGHS(o.agent_profit || 0)}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            o.delivery_status === "delivered" || o.delivery_status === "completed"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : o.delivery_status === "failed"
                              ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                              : "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                          }`}>
                            {o.delivery_status || o.status || "processing"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: BASE PRICING */}
      {activeTab === "pricing" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-card border border-border flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sliders className="size-4 text-cyan-400" />
                Set Agent Base Wholesale Prices
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Formula: <strong>Customer Selling Price &minus; Admin Base Price = Agent Profit</strong>.
                Profits are credited to the agent&apos;s wallet immediately once customer payment is confirmed successful.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Category selector */}
              <div className="flex items-center p-1 rounded-xl bg-muted/60 border border-border">
                <button
                  type="button"
                  onClick={() => setPricingCategory("data")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    pricingCategory === "data"
                      ? "bg-cyan-500 text-black shadow-sm font-black"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Data Bundles
                </button>
                <button
                  type="button"
                  onClick={() => setPricingCategory("services")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    pricingCategory === "services"
                      ? "bg-cyan-500 text-black shadow-sm font-black"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Other Services &amp; Checkers
                </button>
                <button
                  type="button"
                  onClick={() => setPricingCategory("boost")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    pricingCategory === "boost"
                      ? "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-sm font-black"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Rocket className="size-3 text-fuchsia-300" />
                  <span>Social Boost Margins 🚀</span>
                </button>
              </div>

              {pricingCategory === "data" && (
                <div className="flex items-center gap-1">
                  {["ALL", "MTN", "TELECEL", "AT"].map((net) => (
                    <button
                      key={net}
                      type="button"
                      onClick={() => setSelectedNetwork(net)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                        selectedNetwork === net
                          ? "bg-cyan-500 text-black shadow-sm"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {net}
                    </button>
                  ))}
                </div>
              )}

              <Button
                type="button"
                size="sm"
                disabled={savingPrices}
                onClick={handleSaveBasePrices}
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 text-black font-black text-xs gap-1.5 shadow-sm"
              >
                {savingPrices ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                <span>Save All Base Prices</span>
              </Button>
            </div>
          </div>

          {/* Profit Protection Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-xs">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="size-5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-foreground flex items-center gap-2">
                  <span>Agent Profit Protection Engine</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Active
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Whenever you increase or decrease base wholesale prices, agents&apos; storefront selling prices automatically shift by the exact same amount so their <strong>take-home profit stays 100% unaffected</strong>. Past order profits are also locked in permanently.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center bg-black/30 px-3 py-1.5 rounded-xl border border-white/10">
              <Label htmlFor="preserve-profit-switch" className="text-[11px] font-bold text-foreground cursor-pointer">
                Preserve Agent Profits:
              </Label>
              <Switch
                id="preserve-profit-switch"
                checked={preserveAgentProfit}
                onCheckedChange={setPreserveAgentProfit}
              />
            </div>
          </div>

          {pricingCategory === "services" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {[
                {
                  id: "service-netflix",
                  name: "Netflix 1-Month Sign-In",
                  category: "Streaming",
                  defaultCustomerPrice: 30.00,
                  defaultBase: 25.00,
                  badge: "bg-red-500/15 text-red-400 border border-red-500/30",
                  description: "Shared account sign-in with instant code delivery.",
                },
                {
                  id: "service-afa",
                  name: "MTN AFA Registration",
                  category: "Registration",
                  defaultCustomerPrice: 20.00,
                  defaultBase: 15.00,
                  badge: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
                  description: "Verified customer SIM registration.",
                },
                {
                  id: "service-mashup",
                  name: "MTN Pulse Mashup (Standard)",
                  category: "MTN Pulse",
                  defaultCustomerPrice: 25.00,
                  defaultBase: 22.00,
                  badge: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
                  description: "Custom Data + Voice combo packages from 1 Cedi upwards.",
                },
                {
                  id: "checker-waec",
                  name: "WAEC Result Checker",
                  category: "Result Checkers",
                  defaultCustomerPrice: 20.00,
                  defaultBase: 16.00,
                  badge: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
                  description: "Instant WAEC result checking card with Serial and PIN.",
                },
                {
                  id: "checker-bece",
                  name: "BECE Result Checker",
                  category: "Result Checkers",
                  defaultCustomerPrice: 18.00,
                  defaultBase: 14.00,
                  badge: "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30",
                  description: "Instant BECE result checking card with Serial and PIN.",
                },
              ].map((s) => {
                const currentBase = basePrices[s.id] ?? s.defaultBase;

                return (
                  <Card key={s.id} className="p-4 rounded-2xl border border-border bg-card space-y-3 shadow-xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${s.badge}`}>
                          {s.category}
                        </span>
                        <div className="font-bold text-sm text-foreground mt-1">
                          {s.name}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{s.description}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">Standard MSRP</span>
                        <span className="text-xs font-mono font-bold text-foreground">
                          {formatGHS(s.defaultCustomerPrice)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/40 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`base-${s.id}`} className="text-xs font-semibold text-muted-foreground">
                          Agent Base Wholesale Cost (GH₵):
                        </Label>
                        <span className="text-[11px] font-mono text-emerald-400 font-bold">
                          Agent Margin: ~{formatGHS(Math.max(0, s.defaultCustomerPrice - currentBase))}
                        </span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">
                          GH₵
                        </span>
                        <Input
                          id={`base-${s.id}`}
                          type="number"
                          step="0.10"
                          value={currentBase || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setBasePrices((prev) => ({ ...prev, [s.id]: val }));
                          }}
                          className="font-mono text-sm pl-12 rounded-xl h-9"
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : pricingCategory === "boost" ? (
            /* ALL AGENTS SOCIAL MEDIA BOOST MARGIN OVERVIEW & OVERRIDE */
            <div className="space-y-4">
              <Card className="p-5 md:p-6 rounded-3xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/30 via-card to-background space-y-4 shadow-sm">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 flex items-center gap-1">
                        <Rocket className="size-3" /> Reseller Profit Percentage Controls
                      </span>
                    </div>
                    <h3 className="text-base font-black text-foreground">
                      All Agents Social Media Boost Profit Margins
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                      Every agent can customize their own percentage profit margin on their dashboard. You can view each agent&apos;s active percentage here, or click to adjust/override it at any time.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-muted/40 border border-border text-center min-w-[140px]">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-bold">Total Resellers</span>
                    <span className="text-2xl font-black text-fuchsia-400 font-mono">
                      {agents.length}
                    </span>
                  </div>
                </div>
              </Card>

              {/* ONE PLACE TO SET PERCENTAGE FOR ALL AGENTS */}
              <Card className="p-5 md:p-6 rounded-3xl border-2 border-fuchsia-500/50 bg-gradient-to-br from-fuchsia-950/40 via-card to-violet-950/25 shadow-lg shadow-fuchsia-950/25 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-fuchsia-500/25 text-fuchsia-300 border border-fuchsia-500/40 inline-flex items-center gap-1">
                        <Sparkles className="size-3" /> One-Click Batch Control
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">Applies to all {agents.length} resellers</span>
                    </div>
                    <h4 className="text-base md:text-lg font-bold text-foreground flex items-center gap-2">
                      <Rocket className="size-5 text-fuchsia-400" />
                      Set Social Boost Profit Margin % for ALL Agents
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                      Type your desired profit margin percentage and click <strong>Apply to All Agents</strong>. This instantly updates every reseller storefront in real-time and becomes the default for future signups.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                    <div className="relative w-full sm:w-32">
                      <Input
                        type="number"
                        min="0"
                        max="500"
                        step="1"
                        value={globalBoostMarkupInput}
                        onChange={(e) => setGlobalBoostMarkupInput(e.target.value)}
                        placeholder="25"
                        className="h-12 pr-8 font-mono text-lg font-black text-center border-fuchsia-500/50 focus:border-fuchsia-400 bg-background/80"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono font-black text-fuchsia-400 text-sm pointer-events-none">
                        %
                      </span>
                    </div>

                    <Button
                      type="button"
                      onClick={handleApplyBoostMarginToAll}
                      disabled={applyingGlobalBoost || !globalBoostMarkupInput}
                      className="h-12 px-6 rounded-xl font-bold bg-gradient-to-r from-fuchsia-600 via-pink-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white shadow-lg shadow-fuchsia-600/30 gap-2 shrink-0"
                    >
                      {applyingGlobalBoost ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          <span>Applying to All Resellers...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-4" />
                          <span>Apply to All ({agents.length}) Agents ⚡</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Quick Preset Pills */}
                <div className="flex items-center gap-2 pt-3 border-t border-border/40 flex-wrap text-xs">
                  <span className="text-muted-foreground font-semibold text-[11px]">Quick Presets:</span>
                  {[10, 15, 20, 25, 30, 35, 40, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setGlobalBoostMarkupInput(String(preset))}
                      className={`px-3 py-1 rounded-xl text-xs font-mono font-bold border transition-all ${
                        Number(globalBoostMarkupInput) === preset
                          ? "bg-fuchsia-500 text-white border-fuchsia-400 shadow-sm shadow-fuchsia-500/40 scale-105"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground border-border hover:text-foreground"
                      }`}
                    >
                      +{preset}%
                    </button>
                  ))}
                </div>
              </Card>

              {/* Table of all agents and their boost markup */}
              <div className="rounded-3xl border border-border/60 bg-card overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3.5 font-bold">Agent Name</th>
                        <th className="p-3.5 font-bold">Store Link</th>
                        <th className="p-3.5 font-bold text-fuchsia-400">Boost Margin %</th>
                        <th className="p-3.5 font-bold">Quick Presets</th>
                        <th className="p-3.5 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {agents.map((ag) => {
                        const currentMargin = Number(ag.custom_prices?.boost_markup_percent ?? 25);
                        return (
                          <tr key={ag.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3.5">
                              <div className="font-bold text-foreground">{ag.name}</div>
                              <div className="text-[11px] text-muted-foreground">{ag.email}</div>
                            </td>
                            <td className="p-3.5">
                              <a
                                href={`/s/${ag.store_slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-400 hover:underline font-mono text-[11px] inline-flex items-center gap-1"
                              >
                                <span>/s/{ag.store_slug}</span>
                                <ExternalLink className="size-3" />
                              </a>
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              <span className="px-3 py-1 rounded-full text-xs font-mono font-black bg-fuchsia-500/15 text-fuchsia-400 border border-fuchsia-500/30 inline-flex items-center gap-1.5">
                                <Rocket className="size-3" />
                                +{currentMargin}%
                              </span>
                            </td>
                            <td className="p-3.5">
                              <div className="flex items-center gap-1 flex-wrap">
                                {[15, 20, 25, 30, 40, 50].map((pct) => (
                                  <button
                                    key={pct}
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const res = await invokeApiFunction("agent", {
                                          body: {
                                            action: "updateProducts",
                                            agent_id: ag.id,
                                            custom_prices: {
                                              ...(ag.custom_prices || {}),
                                              boost_markup_percent: pct,
                                            },
                                          },
                                        });
                                        if (res?.data?.ok) {
                                          toast.success(`Set ${ag.name}'s margin to +${pct}%!`);
                                          loadAgents(true);
                                        }
                                      } catch (err: any) {
                                        toast.error(err?.message || "Failed to update margin.");
                                      }
                                    }}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all ${
                                      currentMargin === pct
                                        ? "bg-fuchsia-500 text-white shadow-xs font-black"
                                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                    }`}
                                  >
                                    +{pct}%
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="p-3.5 text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenBoostMarginModal(ag)}
                                className="h-7 px-2.5 rounded-lg border-fuchsia-500/30 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-300 text-xs font-bold gap-1 shadow-xs"
                              >
                                <Edit2 className="size-3" />
                                <span>Edit %</span>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredProducts.map((p) => {
                const currentBase = basePrices[p.id] ?? (p.price - 1.00);

                return (
                  <Card key={p.id} className="p-4 rounded-2xl border border-border bg-card space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${networkClass(p.network)}`}>
                          {p.network}
                        </span>
                        <div className="font-bold text-sm text-foreground mt-1">
                          {p.name || `${p.network} ${p.capacity}GB`}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">Customer MSRP</span>
                        <span className="text-xs font-mono font-bold text-foreground">
                          {formatGHS(p.price)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/40 space-y-1.5">
                      <Label htmlFor={`base-${p.id}`} className="text-xs font-semibold text-muted-foreground">
                        Agent Base Wholesale Cost (GH₵):
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">
                          GH₵
                        </span>
                        <Input
                          id={`base-${p.id}`}
                          type="number"
                          step="0.10"
                          value={currentBase || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setBasePrices((prev) => ({ ...prev, [p.id]: val }));
                          }}
                          className="font-mono text-sm pl-12 rounded-xl h-9"
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WITHDRAWAL REQUESTS */}
      {activeTab === "withdrawals" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Wallet className="size-4 text-amber-400" />
                Agent MoMo Withdrawal Requests
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review agent payout requests. When you disburse via MoMo, click &ldquo;Approve &amp; Mark Paid&rdquo;.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadWithdrawals}
              className="rounded-xl text-xs gap-1.5"
            >
              <RefreshCw className="size-3.5" />
              <span>Refresh</span>
            </Button>
          </div>

          {loadingWithdrawals ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="size-6 animate-spin text-amber-400" />
              <span className="text-xs">Loading withdrawals...</span>
            </div>
          ) : withdrawals.length === 0 ? (
            <Card className="p-12 rounded-3xl border border-dashed border-border text-center space-y-2">
              <Wallet className="size-8 text-muted-foreground mx-auto" />
              <div className="font-bold text-sm text-foreground">No withdrawal requests yet</div>
              <p className="text-xs text-muted-foreground">
                When agents submit profit payout requests, they will appear here for review and disbursement.
              </p>
            </Card>
          ) : (
            <div className="rounded-3xl border border-border/60 bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3.5 font-bold">Date</th>
                      <th className="p-3.5 font-bold">Agent Name &amp; Store</th>
                      <th className="p-3.5 font-bold">MoMo Destination</th>
                      <th className="p-3.5 font-bold">Account Name</th>
                      <th className="p-3.5 font-bold text-amber-400">Amount</th>
                      <th className="p-3.5 font-bold">Status</th>
                      <th className="p-3.5 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {withdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 font-mono text-[11px] text-muted-foreground">
                          {w.created_at ? new Date(w.created_at).toLocaleDateString("en-GB") : "N/A"}
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-foreground">{w.agent_name || "Agent"}</div>
                          <div className="text-[11px] text-muted-foreground">{w.store_name || w.agent_phone}</div>
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-foreground">{w.momo_network}</span>
                          <span className="font-mono text-foreground block">{w.momo_number}</span>
                          {w.payment_reference && (
                            <span className="text-[10px] text-cyan-400 font-mono block mt-0.5">
                              Txn: {w.payment_reference}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-foreground">{w.momo_name || "N/A"}</td>
                        <td className="p-3.5 font-bold text-amber-400 font-mono text-sm whitespace-nowrap">
                          {formatGHS(w.amount)}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            w.status === "completed" || w.status === "approved"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : w.status === "rejected"
                              ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                              : "bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse"
                          }`}>
                            {w.status || "pending"}
                          </span>
                          {w.reject_reason && (
                            <div className="text-[10px] text-rose-400 mt-1 max-w-[140px] truncate" title={w.reject_reason}>
                              {w.reject_reason}
                            </div>
                          )}
                          {w.completed_at && (
                            <div className="text-[9px] text-muted-foreground mt-0.5 font-mono">
                              {new Date(w.completed_at).toLocaleDateString("en-GB")}
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          {w.status === "pending" ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                disabled={processingWithdrawalId === w.id}
                                onClick={() => handleOpenPaystackModal(w)}
                                className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] gap-1 shadow-xs"
                                title="Automated MoMo payout directly via Paystack Transfers API"
                              >
                                {processingWithdrawalId === w.id && paystackDisbursing ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <Send className="size-3" />
                                )}
                                <span>Pay via Paystack</span>
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={processingWithdrawalId === w.id}
                                onClick={() => handleOpenManualModal(w)}
                                className="h-7 px-2 rounded-lg border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 font-bold text-[11px] gap-1"
                                title="Mark as paid manually if disbursed via MoMo USSD on your phone"
                              >
                                <Check className="size-3" />
                                <span>Manual</span>
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={processingWithdrawalId === w.id}
                                onClick={() => handleOpenRejectModal(w)}
                                className="h-7 px-2 rounded-lg border-rose-500/30 text-rose-400 hover:bg-rose-500/10 font-bold text-[11px] gap-1"
                                title="Reject withdrawal and refund balance to agent wallet"
                              >
                                <XCircle className="size-3" />
                                <span>Reject</span>
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground font-medium">Processed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dialog: Credit / Adjust Agent Wallet Balance */}
      <Dialog open={creditModalOpen} onOpenChange={setCreditModalOpen}>
        <DialogContent className="max-w-md bg-card border-border text-foreground p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <PlusCircle className="size-5 text-amber-400" />
              <span>Credit Agent Wallet</span>
            </DialogTitle>
          </DialogHeader>

          {selectedAgentForCredit && (
            <form onSubmit={handleCreditSubmit} className="space-y-4 mt-2">
              <div className="p-3.5 rounded-2xl bg-muted/50 border border-border/60 text-xs space-y-1">
                <div className="font-bold text-foreground text-sm">{selectedAgentForCredit.name}</div>
                <div className="text-muted-foreground">{selectedAgentForCredit.store_name} &bull; {selectedAgentForCredit.phone}</div>
                <div className="text-amber-400 font-mono font-bold pt-1">
                  Current Balance: {formatGHS(selectedAgentForCredit.wallet_balance ?? 0)}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c_amt" className="text-xs font-semibold">
                  Amount to Credit (GH₵)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">GH₵</span>
                  <Input
                    id="c_amt"
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 50.00"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    className="pl-12 font-mono font-bold rounded-xl"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Enter positive number to credit, or negative (e.g. -10) to debit.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c_note" className="text-xs font-semibold">
                  Reason / Reference Note
                </Label>
                <Input
                  id="c_note"
                  placeholder="e.g. Bonus commission, manual topup..."
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreditModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creditSubmitting}
                  className="rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs gap-1.5"
                >
                  {creditSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  <span>Credit Wallet</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Edit Agent Login Credentials & Profile */}
      <Dialog open={credModalOpen} onOpenChange={setCredModalOpen}>
        <DialogContent className="max-w-lg bg-card border-border text-foreground p-6 rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-indigo-400">
              <KeyRound className="size-5" />
              <span>Edit Agent Login Credentials</span>
            </DialogTitle>
          </DialogHeader>

          {selectedAgentForCred && (
            <form onSubmit={handleSaveCredentials} className="space-y-4 pt-2">
              {/* Agent Quick Summary Banner */}
              <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <Store className="size-3.5 text-indigo-400" />
                    <span>{selectedAgentForCred.store_name}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    ID: {selectedAgentForCred.id}
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLoginDetails}
                  className="h-8 px-2.5 rounded-xl border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/20 text-xs font-bold gap-1 shadow-xs shrink-0"
                  title="Copy formatted login info to send to agent on WhatsApp"
                >
                  <Copy className="size-3.5" />
                  <span>Copy Login Info</span>
                </Button>
              </div>

              {/* Section 1: Authentication & Credentials */}
              <div className="space-y-3 p-3.5 rounded-2xl bg-muted/40 border border-border/70">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Lock className="size-3.5 text-amber-400" />
                  <span>Login Credentials (Used at /agent/login)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Login Phone Number</Label>
                    <Input
                      type="tel"
                      value={credPhone}
                      onChange={(e) => setCredPhone(e.target.value)}
                      placeholder="e.g. 0541234567"
                      className="h-9 rounded-xl text-xs font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Login Email Address</Label>
                    <Input
                      type="email"
                      value={credEmail}
                      onChange={(e) => setCredEmail(e.target.value)}
                      placeholder="agent@example.com"
                      className="h-9 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Account Password</Label>
                    <button
                      type="button"
                      onClick={handleGenerateRandomPassword}
                      className="text-[11px] text-cyan-400 hover:underline font-bold inline-flex items-center gap-1"
                    >
                      <Sparkles className="size-3" />
                      <span>Generate Random</span>
                    </button>
                  </div>

                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={credPassword}
                      onChange={(e) => setCredPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="h-9 pr-9 rounded-xl text-xs font-mono"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Agent can log in using either their Phone Number or Email + this Password.
                  </p>
                </div>
              </div>

              {/* Section 2: Storefront Identity */}
              <div className="space-y-3 p-3.5 rounded-2xl bg-muted/40 border border-border/70">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Store className="size-3.5 text-cyan-400" />
                  <span>Storefront &amp; Public Profile</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Agent Full Name</Label>
                    <Input
                      type="text"
                      value={credName}
                      onChange={(e) => setCredName(e.target.value)}
                      placeholder="Full Name"
                      className="h-9 rounded-xl text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Store Display Name</Label>
                    <Input
                      type="text"
                      value={credStoreName}
                      onChange={(e) => setCredStoreName(e.target.value)}
                      placeholder="e.g. Senerity Data"
                      className="h-9 rounded-xl text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Store Slug (URL: /s/slug)</Label>
                    <Input
                      type="text"
                      value={credStoreSlug}
                      onChange={(e) => setCredStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                      placeholder="e.g. senerity"
                      className="h-9 rounded-xl text-xs font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">WhatsApp Support Number</Label>
                    <Input
                      type="tel"
                      value={credWhatsapp}
                      onChange={(e) => setCredWhatsapp(e.target.value)}
                      placeholder="e.g. 0541234567"
                      className="h-9 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: MoMo Payout Information */}
              <div className="space-y-3 p-3.5 rounded-2xl bg-muted/40 border border-border/70">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Wallet className="size-3.5 text-emerald-400" />
                  <span>MoMo Withdrawal Payout Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">MoMo Network</Label>
                    <select
                      value={credMomoNetwork}
                      onChange={(e) => setCredMomoNetwork(e.target.value)}
                      className="w-full h-9 px-2 rounded-xl bg-background border border-border text-xs font-bold text-foreground"
                    >
                      <option value="MTN">MTN</option>
                      <option value="TELECEL">TELECEL</option>
                      <option value="AT">AIRTELTIGO (AT)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">MoMo Number</Label>
                    <Input
                      type="tel"
                      value={credMomoNumber}
                      onChange={(e) => setCredMomoNumber(e.target.value)}
                      placeholder="e.g. 0541234567"
                      className="h-9 rounded-xl text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">MoMo Account Name</Label>
                    <Input
                      type="text"
                      value={credMomoName}
                      onChange={(e) => setCredMomoName(e.target.value)}
                      placeholder="Account Name"
                      className="h-9 rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCredModalOpen(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={credSubmitting}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs gap-1.5 shadow-md"
                >
                  {credSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  <span>Save Credentials</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Delete Agent Confirmation */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md bg-card border-border text-foreground p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-rose-500">
              <Trash2 className="size-5" />
              <span>Permanently Delete Agent Account</span>
            </DialogTitle>
          </DialogHeader>

          {selectedAgentForDelete && (
            <div className="space-y-4 mt-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to delete <strong className="text-foreground">{selectedAgentForDelete.name}</strong> ({selectedAgentForDelete.store_name})?
                This will delete their reseller profile, access credentials, and store handle. This action cannot be reversed.
              </p>

              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                ⚠️ Store handle <code className="font-mono font-bold">/s/{selectedAgentForDelete.store_slug}</code> will become unavailable immediately.
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={deletingAgent}
                  onClick={handleDeleteSubmit}
                  className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs gap-1.5"
                >
                  {deletingAgent ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  <span>Delete Permanently</span>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Automated Paystack MoMo Transfer Confirmation */}
      <Dialog open={paystackModalOpen} onOpenChange={setPaystackModalOpen}>
        <DialogContent className="max-w-md bg-card border-border text-foreground p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Send className="size-5 text-emerald-400" />
              <span>Automated Paystack MoMo Transfer</span>
            </DialogTitle>
          </DialogHeader>

          {selectedWithdrawalForPaystack && (
            <div className="space-y-4 mt-2">
              <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Recipient Name</span>
                  <span className="font-bold text-foreground text-sm">
                    {selectedWithdrawalForPaystack.momo_name || selectedWithdrawalForPaystack.agent_name || "Agent"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Network &amp; Phone</span>
                  <span className="font-mono font-bold text-foreground">
                    {selectedWithdrawalForPaystack.momo_network} &bull; {selectedWithdrawalForPaystack.momo_number}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Store</span>
                  <span className="font-semibold text-foreground">
                    {selectedWithdrawalForPaystack.store_name || "Data1gh Store"}
                  </span>
                </div>
                <div className="pt-2 border-t border-border/40 flex justify-between items-center">
                  <span className="font-bold text-foreground">Disbursement Amount</span>
                  <span className="text-lg font-black font-mono text-emerald-400">
                    {formatGHS(selectedWithdrawalForPaystack.amount)}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                <span>
                  Paystack will automatically transfer <strong>{formatGHS(selectedWithdrawalForPaystack.amount)}</strong> directly from your Paystack balance to the recipient's mobile money wallet.
                </span>
              </div>

              {paystackError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-rose-200">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>Paystack Transfer Failed</span>
                  </div>
                  <p className="text-[11px] leading-relaxed break-words">{paystackError}</p>
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const w = selectedWithdrawalForPaystack;
                        setPaystackModalOpen(false);
                        setPaystackError("");
                        setSelectedWithdrawalForManual(w);
                        setManualModalOpen(true);
                      }}
                      className="w-full text-xs h-8 rounded-xl border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20 font-bold"
                    >
                      Switch to Manual MoMo Approval Instead
                    </Button>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPaystackModalOpen(false);
                    setPaystackError("");
                  }}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={processingWithdrawalId === selectedWithdrawalForPaystack.id}
                  onClick={() => executePaystackDisbursement(selectedWithdrawalForPaystack)}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs gap-1.5"
                >
                  {processingWithdrawalId === selectedWithdrawalForPaystack.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  <span>Confirm &amp; Disburse via Paystack</span>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Mark as Paid Manually */}
      <Dialog open={manualModalOpen} onOpenChange={setManualModalOpen}>
        <DialogContent className="max-w-md bg-card border-border text-foreground p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-cyan-400">
              <Check className="size-5" />
              <span>Mark Withdrawal as Paid Manually</span>
            </DialogTitle>
          </DialogHeader>

          {selectedWithdrawalForManual && (
            <form onSubmit={executeManualApproval} className="space-y-4 mt-2">
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agent</span>
                  <span className="font-bold text-foreground">{selectedWithdrawalForManual.agent_name || "Agent"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Destination</span>
                  <span className="font-mono text-foreground font-semibold">
                    {selectedWithdrawalForManual.momo_network} &bull; {selectedWithdrawalForManual.momo_number}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account Name</span>
                  <span className="text-foreground">{selectedWithdrawalForManual.momo_name || "N/A"}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-border/40 font-bold">
                  <span>Amount</span>
                  <span className="text-amber-400 font-mono text-sm">{formatGHS(selectedWithdrawalForManual.amount)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="m_ref" className="text-xs font-semibold">
                  MoMo Transaction ID / Reference (Optional)
                </Label>
                <Input
                  id="m_ref"
                  placeholder="e.g. 2849182374 or USSD Transaction ID"
                  value={manualReference}
                  onChange={(e) => setManualReference(e.target.value)}
                  className="rounded-xl text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Use this if you sent money directly from your phone USSD (*170#) or corporate bank wallet.
                </p>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setManualModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={manualSubmitting}
                  className="rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs gap-1.5"
                >
                  {manualSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  <span>Confirm Manual Approval</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Reject Withdrawal & Refund Wallet */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="max-w-md bg-card border-border text-foreground p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-rose-500">
              <XCircle className="size-5" />
              <span>Reject Withdrawal Request</span>
            </DialogTitle>
          </DialogHeader>

          {selectedWithdrawalForReject && (
            <form onSubmit={executeRejectWithdrawal} className="space-y-4 mt-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Rejecting this request will immediately refund <strong className="text-amber-400 font-mono">{formatGHS(selectedWithdrawalForReject.amount)}</strong> back to the agent&apos;s wallet balance.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="r_reason" className="text-xs font-semibold">
                  Rejection Reason (Visible to Agent)
                </Label>
                <Input
                  id="r_reason"
                  required
                  placeholder="e.g. Invalid MoMo number or wallet name mismatch"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRejectModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={rejectSubmitting}
                  className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs gap-1.5"
                >
                  {rejectSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
                  <span>Reject &amp; Refund Wallet</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Edit Agent Social Boost Profit Margin % */}
      <Dialog open={boostModalOpen} onOpenChange={setBoostModalOpen}>
        <DialogContent className="max-w-md bg-card border-border text-foreground p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-fuchsia-400">
              <Rocket className="size-5" />
              <span>Edit Agent Social Boost Margin %</span>
            </DialogTitle>
          </DialogHeader>

          {selectedAgentForBoost && (
            <div className="space-y-4 mt-2">
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agent</span>
                  <span className="font-bold text-foreground">{selectedAgentForBoost.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Store Link</span>
                  <span className="font-mono text-cyan-400">/s/{selectedAgentForBoost.store_slug}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Margin</span>
                  <span className="font-mono font-bold text-fuchsia-400">
                    +{selectedAgentForBoost.custom_prices?.boost_markup_percent ?? 25}%
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-boost-input" className="text-xs font-semibold">
                  Profit Percentage Margin (%):
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="agent-boost-input"
                    type="number"
                    min="0"
                    max="500"
                    value={boostMarkupInput}
                    onChange={(e) => setBoostMarkupInput(Number(e.target.value) || 0)}
                    className="font-mono font-bold text-sm text-fuchsia-400 rounded-xl"
                  />
                  <span className="text-sm font-bold text-muted-foreground">%</span>
                </div>
                <div className="flex items-center flex-wrap gap-1.5 pt-1">
                  {[15, 20, 25, 30, 40, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setBoostMarkupInput(pct)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        boostMarkupInput === pct
                          ? "bg-fuchsia-500 text-white font-black"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      }`}
                    >
                      +{pct}%
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground pt-1">
                  When a customer orders on <strong>{selectedAgentForBoost.store_name}</strong>, they are charged the Wholesale Base Price + <strong>{boostMarkupInput}%</strong>. The <strong>{boostMarkupInput}%</strong> profit goes directly into {selectedAgentForBoost.name}&apos;s wallet balance.
                </p>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBoostModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={savingAgentBoost}
                  onClick={handleSaveAgentBoostMargin}
                  className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:opacity-95 text-white font-black text-xs gap-1.5 shadow-md shadow-fuchsia-600/30"
                >
                  {savingAgentBoost ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  <span>Save Margin (+{boostMarkupInput}%)</span>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAgents;
