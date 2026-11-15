import { Fragment as FragmentWithKey, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { invokeApiFunction, supabase } from "@/integrations/supabase/client";
import { getCacheMeta, setCache, createSmartInterval, invalidateCache } from "@/lib/localCache";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, RefreshCw, Search, CreditCard, Gift, ArrowUpRight, Store, MessageSquareText, MessageCircle, SendHorizonal, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NETWORK_LABEL, networkClass, formatGHS } from "@/lib/networks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PhoneLink } from "@/components/PhoneLink";
import { DeliveryTracker } from "@/components/DeliveryTracker";

export interface UnifiedOrder {
  id: string;
  reference: string;
  display_reference?: string;
  source: "paystack" | "free_data" | "agent";
  network: string;
  capacity: string;
  recipient_phone: string;
  amount: number;
  payment_status: string;
  delivery_status: string;
  datamart_status?: string | null;
  created_at: string;
  datamart_reference?: string;
  error_message?: string;
  notes?: string;
  customer_email?: string;
  agent_id?: string;
  agent_name?: string;
  agent_store_name?: string;
  agent_store_slug?: string;
  agent_custom_domain?: string;
  agent_profit?: number;
  base_price?: number;
}

const isWhatsAppOrder = (o: any) => {
  if (!o) return false;
  const ref = String(o.reference || o.ref || o.id || "").trim();
  const notes = String(o.notes || "").toLowerCase();
  const net = String(o.network || "").toUpperCase();
  const src = String(o.source || "").toLowerCase();
  return (
    notes.includes("[channel:whatsapp_bot]") ||
    notes.includes("whatsapp_bot") ||
    notes.includes("[whatsapp_phone:") ||
    src === "whatsapp" ||
    src === "whatsapp_bot" ||
    net === "MASHUP" ||
    ref.startsWith("MASHUP-")
  );
};

const resolveDisplayDeliveryStatus = (o: UnifiedOrder): string => {
  const del = String(o.delivery_status || "").toLowerCase().trim();
  const dm = String(o.datamart_status || "").toLowerCase().trim();
  if (del === "delivered" || del === "completed" || dm === "completed" || dm === "delivered") {
    return "delivered";
  }
  if (dm === "processing" || dm === "in_progress" || del === "processing" || del === "in_progress") {
    return "processing";
  }
  if (dm === "failed" || dm === "cancelled" || dm === "rejected" || del === "failed" || del === "cancelled" || del === "rejected") {
    return "failed";
  }
  if (dm === "waiting" || del === "waiting") {
    return "waiting";
  }
  if (dm === "pending" || dm === "queued" || del === "pending") {
    return "pending";
  }
  return o.delivery_status || "processing";
};

const AdminOrders = () => {
  const [orders, setOrders] = useState<UnifiedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "paystack" | "agent" | "free_data">("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [agentList, setAgentList] = useState<{ id: string; name: string; store_name: string; store_slug?: string; custom_domain?: string }[]>([]);
  const [network, setNetwork] = useState<string>("all");
  const [delivery, setDelivery] = useState<string>("all");
  const [retrying, setRetrying] = useState<string | null>(null);
  const [systemNumbers, setSystemNumbers] = useState<string[]>([]);
  const [showNumbers, setShowNumbers] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const syncingRef = useRef<Set<string>>(new Set());
  const [syncingLivePayments, setSyncingLivePayments] = useState(false);
  const syncingPaymentRef = useRef<Set<string>>(new Set());
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deliveryEdit, setDeliveryEdit] = useState<string>("");
  const [paymentEdit, setPaymentEdit] = useState<string>("");

  const addNumbers = (numbers: unknown[]) => {
    const isReal = (n: string) => /^(?:0\d{9}|233\d{9}|\+233\d{9})$/.test(n.trim());
    setSystemNumbers(current =>
      Array.from(
        new Set([
          ...current,
          ...numbers.filter((number): number is string => typeof number === "string" && isReal(number)),
        ])
      )
    );
  };

  const syncActiveOrders = (list: UnifiedOrder[]) => {
    const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;
    const toSync = list
      .filter(o => {
        if (o.source === "free_data" || o.notes?.includes("FLASH_SALE")) return false;
        if (o.payment_status !== "paid") return false;
        if (syncingRef.current.has(o.reference)) return false;

        // Never auto-sync orders that are already delivered, completed, failed, or refunded
        const displayDel = resolveDisplayDeliveryStatus(o);
        const rawDel = String(o.delivery_status || "").toLowerCase().trim();
        if (
          displayDel === "delivered" ||
          displayDel === "failed" ||
          rawDel === "delivered" ||
          rawDel === "completed" ||
          rawDel === "refunded" ||
          rawDel === "failed" ||
          rawDel === "cancelled"
        ) {
          return false;
        }

        // Only auto-sync recent active orders (within last 48h) that are still processing/pending/waiting
        const createdMs = o.created_at ? new Date(o.created_at).getTime() : 0;
        if (createdMs > 0 && createdMs < fortyEightHoursAgo) return false;

        return ["processing", "pending", "waiting", "unknown"].includes(displayDel);
      })
      .slice(0, 10);

    for (const o of toSync) {
      syncingRef.current.add(o.reference);
      invokeApiFunction("admin-data", { body: { action: "syncDatamartStatus", reference: o.reference } })
        .then(res => {
          const updated = res?.data?.order;
          if (updated) {
            setOrders(prev =>
              prev.map(item =>
                item.reference === o.reference
                  ? {
                      ...item,
                      delivery_status: updated.delivery_status || item.delivery_status,
                      datamart_status: updated.datamart_status || item.datamart_status,
                      datamart_reference: updated.datamart_reference || item.datamart_reference,
                      display_reference: updated.datamart_reference || item.display_reference,
                  error_message: updated.error_message !== undefined ? updated.error_message : null,
                }
                  : item
              )
            );
          }
        })
        .catch(() => {})
        .finally(() => {
          setTimeout(() => syncingRef.current.delete(o.reference), 30000);
        });
    }
  };

  const syncSingleOrder = async (o: UnifiedOrder) => {
    syncingRef.current.add(o.reference);
    try {
      const res = await invokeApiFunction("admin-data", {
        body: { action: "syncDatamartStatus", reference: o.reference, id: o.id },
      });
      const updated = res?.data?.order;
      if (updated) {
        setOrders(prev =>
          prev.map(item =>
            item.reference === o.reference || item.id === o.id
              ? {
                  ...item,
                  payment_status: updated.payment_status || item.payment_status,
                  delivery_status: updated.delivery_status || item.delivery_status,
                  datamart_status: updated.datamart_status || item.datamart_status,
                  datamart_reference: updated.datamart_reference || item.datamart_reference,
                  display_reference: updated.datamart_reference || item.display_reference,
                      error_message: updated.error_message !== undefined ? updated.error_message : null,
                    }
                  : item
          )
        );
        toast.success(`Synced: Payment=${updated.payment_status || o.payment_status}, Delivery=${updated.datamart_status || updated.delivery_status}`);
      } else {
        toast.info("Status is up to date");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to sync status");
    } finally {
      syncingRef.current.delete(o.reference);
    }
  };

  const syncAllDataMart = async () => {
    setSyncingAll(true);
    try {
      const toSync = orders
        .filter(o => o.source !== "free_data" && resolveDisplayDeliveryStatus(o) !== "delivered")
        .slice(0, 30);

      if (toSync.length === 0) {
        toast.info("All orders are already delivered.");
        return;
      }

      let updatedCount = 0;
      for (const o of toSync) {
        try {
          const res = await invokeApiFunction("admin-data", {
            body: { action: "syncDatamartStatus", reference: o.reference, id: o.id },
          });
          const updated = res?.data?.order;
          if (updated) {
            updatedCount++;
            setOrders(prev =>
              prev.map(item =>
                item.reference === o.reference || item.id === o.id
                  ? {
                      ...item,
                      payment_status: updated.payment_status || item.payment_status,
                      delivery_status: updated.delivery_status || item.delivery_status,
                      datamart_status: updated.datamart_status || item.datamart_status,
                      datamart_reference: updated.datamart_reference || item.datamart_reference,
                      display_reference: updated.datamart_reference || item.display_reference,
                    }
                  : item
              )
            );
          }
        } catch {}
      }
      toast.success(`Live status synced for ${updatedCount} orders.`);
    } finally {
      setSyncingAll(false);
    }
  };

  const syncSingleLivePayment = async (o: UnifiedOrder) => {
    if (syncingPaymentRef.current.has(o.reference)) return;
    syncingPaymentRef.current.add(o.reference);
    setOrders(prev => [...prev]);
    try {
      const res = await invokeApiFunction("admin-data", {
        body: { action: "syncLivePayment", reference: o.reference, id: o.id },
      });
      const updated = res?.data?.order;
      if (updated) {
        setOrders(prev =>
          prev.map(item =>
            item.reference === o.reference || item.id === o.id
              ? {
                  ...item,
                  payment_status: updated.payment_status || item.payment_status,
                  delivery_status: updated.delivery_status || item.delivery_status,
                  datamart_status: updated.datamart_status || item.datamart_status,
                  datamart_reference: updated.datamart_reference || item.datamart_reference,
                  display_reference: updated.datamart_reference || item.display_reference,
                  error_message: updated.error_message !== undefined ? updated.error_message : null,
                }
              : item
          )
        );
        if (updated.payment_status === "paid") {
          toast.success(`Payment verified: Order ${o.reference} is PAID! Delivery: ${updated.delivery_status || "Processing"}`);
        } else if (updated.payment_status === "failed") {
          toast.error(`Paystack verified: Payment FAILED (${updated.error_message || "Cancelled"}). Recovery SMS sent to customer.`);
        } else {
          toast.info(res?.data?.message || `Order ${o.reference} is still awaiting customer payment.`);
        }
      } else {
        toast.info(res?.data?.message || "Payment status checked");
      }
      invalidateCache("admin_orders_list");
    } catch (err: any) {
      toast.error(err?.message || "Failed to sync payment status");
    } finally {
      syncingPaymentRef.current.delete(o.reference);
      setOrders(prev => [...prev]);
    }
  };

  const syncAllLivePayments = async (silent = false) => {
    if (!silent) setSyncingLivePayments(true);
    try {
      const pendingRefs = orders
        .filter(o => o.source !== "free_data" && o.payment_status !== "paid")
        .slice(0, 30)
        .map(o => o.reference);

      if (silent && pendingRefs.length === 0) return;

      const res = await invokeApiFunction("admin-data", {
        body: {
          action: "syncAllLivePayments",
          references: pendingRefs.length > 0 ? pendingRefs : undefined,
        },
      });

      if (res?.data?.updatedOrders && Array.isArray(res.data.updatedOrders)) {
        const map = new Map<string, any>(res.data.updatedOrders.map((u: any) => [String(u.reference || ""), u]));
        setOrders(prev =>
          prev.map(item => {
            const upd: any = map.get(item.reference) || (item.id ? map.get(item.id) : null);
            if (upd) {
              return {
                ...item,
                payment_status: upd.payment_status || item.payment_status,
                delivery_status: upd.delivery_status || item.delivery_status,
                datamart_status: upd.datamart_status || item.datamart_status,
                datamart_reference: upd.datamart_reference || item.datamart_reference,
                display_reference: upd.datamart_reference || item.display_reference,
                error_message: upd.error_message !== undefined ? upd.error_message : null,
              };
            }
            return item;
          })
        );
      }

      invalidateCache("admin_orders_list");

      const { paidCount = 0, failedCount = 0, stillPendingCount = 0, totalChecked = 0 } = res?.data || {};
      if (!silent) {
        if (paidCount > 0) {
          toast.success(`Live payment sync complete: ${paidCount} marked PAID, ${failedCount} failed (auto recovery SMS sent), ${stillPendingCount} still pending.`);
          load(true, true);
        } else if (totalChecked > 0) {
          toast.info(`Checked ${totalChecked} payments: ${failedCount} failed (auto recovery SMS sent), ${stillPendingCount} still awaiting MoMo approval.`);
          load(true, true);
        } else {
          toast.info("All payments are already up to date.");
        }
      }
    } catch (err: any) {
      if (!silent) toast.error(err?.message || "Failed to sync live payments");
    } finally {
      if (!silent) setSyncingLivePayments(false);
    }
  };

  const updateOrderStatus = async (o: UnifiedOrder) => {
    const updates: Record<string, string> = {
      delivery_status: deliveryEdit,
      payment_status: paymentEdit,
    };
    try {
      const { data, error } = await invokeApiFunction("admin-data", {
        body: {
          action: "updateOrderStatus",
          reference: o.reference,
          payment_status: paymentEdit,
          delivery_status: deliveryEdit,
          status: deliveryEdit,
        },
      });
      if (error) throw new Error(error.message || "Update failed");
      if (data?.error) throw new Error(data.error);

      setOrders(prev =>
        prev.map(item =>
          item.reference === o.reference
            ? { ...item, payment_status: paymentEdit, delivery_status: deliveryEdit }
            : item
        )
      );
      toast.success(`Order ${o.reference} status updated`);
      setEditingId(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update order status");
    }
  };

  const load = async (silent = false, force = false) => {
    if (!silent) setLoading(true);

    // Instant initial render from cache (0ms perceived load time!)
    const cached = getCacheMeta<{ orders: UnifiedOrder[]; collectedNumbers: string[] }>("admin_orders_list");
    if (cached.exists && cached.data && Array.isArray(cached.data.orders) && cached.data.orders.length > 0) {
      setOrders(cached.data.orders);
      addNumbers(cached.data.collectedNumbers || []);
      if (!silent) setLoading(false);
    }

    const collectedNumbers: string[] = [];
    const allUnified: UnifiedOrder[] = [];

    // Fetch ALL order data sources in PARALLEL for ultra-fast page load (<300ms)
    try {
      const [webRes, fdRes, agentOrdersRes, allAgentsRes] = await Promise.all([
        invokeApiFunction("admin-data", { body: { action: "listOrders", refresh: force } }).catch(() => null),
        invokeApiFunction("free-data", { body: { action: "getOverview" } }).catch(() => null),
        invokeApiFunction("admin-agents", { body: { action: "adminGetOrders" } }).catch(() => ({ data: { orders: [] } })),
        invokeApiFunction("admin-agents", { body: { action: "adminGetAgents" } }).catch(() => ({ data: { agents: [] } })),
      ]);

      // 1. Process Paystack / Website Orders
      let webOrdersList: any[] = webRes?.data?.orders || [];
      if (webRes?.data?.phone_numbers) collectedNumbers.push(...webRes.data.phone_numbers);

      if (!webOrdersList.length) {
        try {
          const { data: dbOrders } = await supabase
            .from("orders")
            .select("id, reference, ref, datamart_reference, network, capacity, recipient_phone, phone_number, customer_email, amount, payment_status, delivery_status, datamart_status, created_at, error_message, notes, status, agent_id")
            .order("created_at", { ascending: false })
            .limit(100);
          if (dbOrders && Array.isArray(dbOrders)) webOrdersList = dbOrders;
        } catch (_) {}
      }

      for (const o of webOrdersList) {
        if (isWhatsAppOrder(o)) continue;
        const phone = o.recipient_phone || o.phone_number || o.whatsapp_phone || o.momo_number || o.customer_phone || o.phone || "";
        if (phone) collectedNumbers.push(phone);
        const isPaid = o.payment_status === "paid" || o.status === "paid" || o.status === "pending_manual";
        const actualDeliveryStatus = !isPaid && (o.delivery_status === "processing")
          ? (o.payment_status === "failed" ? "failed" : "pending")
          : (o.delivery_status || o.status || "pending");

        let agentId = o.agent_id;
        let storeName = "";
        if (o.notes) {
          const m = String(o.notes).match(/\[agent:([^\]]+)\]/);
          if (m && !agentId) agentId = m[1];
          const sm = String(o.notes).match(/\[store:([^\]]+)\]/);
          if (sm) storeName = sm[1];
        }

        allUnified.push({
          id: o.id || o.reference || o.ref,
          reference: o.reference || o.ref || o.id,
          display_reference: o.datamart_reference || undefined,
          source: agentId ? "agent" : "paystack",
          network: o.network || "MTN",
          capacity: String(o.capacity || o.bundle || "").replace(/GB/i, ""),
          recipient_phone: phone || "—",
          amount: Number(o.amount) || 0,
          payment_status: isPaid ? "paid" : (o.payment_status || o.status || "pending"),
          delivery_status: actualDeliveryStatus,
          datamart_status: o.datamart_status,
          created_at: o.created_at || new Date().toISOString(),
          datamart_reference: o.datamart_reference,
          error_message: o.error_message,
          customer_email: o.customer_email,
          agent_id: agentId || undefined,
          agent_store_name: storeName || undefined,
          notes: o.notes,
        });
      }

      // 2. Process Free Data Voucher Orders
      const fdData = fdRes?.data;
      if (fdData?.codes && Array.isArray(fdData.codes)) {
        for (const c of fdData.codes) {
          const cPhone = c.claimed_by_phone || c.phone || c.customer_phone || "";
          if (cPhone) collectedNumbers.push(cPhone);

          allUnified.push({
            id: `fd_${c.id || c.code}`,
            reference: c.code,
            source: "free_data",
            network: c.network || "MTN",
            capacity: String(c.capacity || "1GB").replace(/GB/i, ""),
            recipient_phone: cPhone || (c.is_claimed ? "Claimed" : "Unclaimed Voucher"),
            amount: 0,
            payment_status: c.is_claimed ? "free" : "unclaimed",
            delivery_status: c.delivery_status || (c.is_claimed ? "pending" : "unclaimed"),
            created_at: c.claimed_at || c.created_at || new Date().toISOString(),
            datamart_reference: c.datamart_ref,
            notes: c.notes,
          });
        }
      }

      // 3. Process Agent Orders

      const agentData = agentOrdersRes?.data;
      const allAgentsList = Array.isArray(allAgentsRes?.data?.agents) ? allAgentsRes.data.agents : [];
      const agentsMap = new Map<string, any>();
      allAgentsList.forEach((a: any) => {
        if (a.id) agentsMap.set(String(a.id), a);
        if (a.store_slug) agentsMap.set(String(a.store_slug).toLowerCase(), a);
      });

      if (agentData?.orders && Array.isArray(agentData.orders)) {
        const agentOrderMap = new Map<string, any>();
        const uniqueAgents = new Map<string, { id: string; name: string; store_name: string; store_slug?: string; custom_domain?: string }>();

        allAgentsList.forEach((ag: any) => {
          if (ag.id) {
            uniqueAgents.set(ag.id, {
              id: ag.id,
              name: ag.name || "Agent",
              store_name: ag.store_name || "Agent Store",
              store_slug: ag.store_slug || "",
              custom_domain: ag.custom_domain || "",
            });
          }
        });

        agentData.orders.forEach((ao: any) => {
          if (ao.reference) agentOrderMap.set(ao.reference, ao);
          if (ao.paystack_ref) agentOrderMap.set(ao.paystack_ref, ao);
          if (ao.id) agentOrderMap.set(ao.id, ao);
          if (ao.agent_id && !uniqueAgents.has(ao.agent_id)) {
            const ag = agentsMap.get(ao.agent_id);
            uniqueAgents.set(ao.agent_id, {
              id: ao.agent_id,
              name: ao.agent_name || ag?.name || "Agent",
              store_name: ao.store_name || ag?.store_name || "Agent Store",
              store_slug: ao.store_slug || ag?.store_slug || "",
              custom_domain: ag?.custom_domain || "",
            });
          }
        });

        // Tag matching web orders with agent details
        allUnified.forEach((ord) => {
          const match = agentOrderMap.get(ord.reference) || agentOrderMap.get(ord.id);
          if (match) {
            ord.source = "agent";
            ord.agent_id = match.agent_id;
            ord.agent_name = match.agent_name;
            ord.agent_store_name = match.store_name || ord.agent_store_name;
            ord.agent_store_slug = match.store_slug || ord.agent_store_slug;
            ord.agent_profit = match.agent_profit;
            ord.base_price = match.base_price;
          }

          // If not matched through orders map, check by agent_id or store_name against allAgentsList
          if (ord.agent_id && !ord.agent_store_slug) {
            const ag = agentsMap.get(ord.agent_id);
            if (ag) {
              ord.agent_store_slug = ag.store_slug || "";
              ord.agent_store_name = ag.store_name || ord.agent_store_name;
              ord.agent_custom_domain = ag.custom_domain || "";
            }
          }
          if (ord.agent_store_name && !ord.agent_store_slug) {
            const ag = allAgentsList.find(
              (a: any) => a.store_name?.toLowerCase().trim() === ord.agent_store_name?.toLowerCase().trim()
            );
            if (ag) {
              ord.agent_store_slug = ag.store_slug || "";
              ord.agent_custom_domain = ag.custom_domain || "";
              if (!ord.agent_id) ord.agent_id = ag.id;
            }
          }
        });

        setAgentList(Array.from(uniqueAgents.values()));

        // Add any distinct agent orders not already in allUnified
        const existingRefs = new Set<string>();
        allUnified.forEach((u) => {
          if (u.reference) existingRefs.add(String(u.reference).replace(/^agord-/, "").trim());
          if (u.display_reference) existingRefs.add(String(u.display_reference).replace(/^agord-/, "").trim());
          if (u.datamart_reference) existingRefs.add(String(u.datamart_reference).replace(/^agord-/, "").trim());
          if (u.id) existingRefs.add(String(u.id).replace(/^agord-/, "").trim());
        });
        agentData.orders.forEach((ao: any) => {
          if (isWhatsAppOrder(ao)) return;
          const rawRef = String(ao.reference || ao.id || "").trim();
          const ref = rawRef.replace(/^agord-/, "").trim();
          if (!ref) return;
          // Filter out internal wallet adjustments/credits or empty-phone phantom records
          if (ref.startsWith("ADJ-") || ao.network === "WALLET") return;
          const phone = String(ao.phone || ao.recipient_phone || "").trim();
          if (!phone || phone === "—") return;
          const psRef = ao.paystack_ref ? String(ao.paystack_ref).replace(/^agord-/, "").trim() : "";
          if (!existingRefs.has(ref) && (!psRef || !existingRefs.has(psRef))) {
            existingRefs.add(ref);
            if (psRef) existingRefs.add(psRef);
            collectedNumbers.push(phone);
            allUnified.push({
              id: ao.id || ref,
              reference: ref,
              display_reference: ao.paystack_ref || undefined,
              source: "agent",
              network: ao.network || "MTN",
              capacity: String(ao.package_size || "").replace(/GB/i, ""),
              recipient_phone: phone,
              amount: Number(ao.amount) || 0,
              payment_status: ao.payment_status || "paid",
              delivery_status: ao.delivery_status || ao.status || "completed",
              created_at: ao.created_at || ao.date || "2026-01-01T00:00:00.000Z",
              notes: ao.notes || undefined,
              agent_id: ao.agent_id,
              agent_name: ao.agent_name,
              agent_store_name: ao.store_name,
              agent_profit: ao.agent_profit,
              base_price: ao.base_price,
            });
          }
        });
      }
    } catch (_) {}

    // Strict isolation: WhatsApp bot orders must NEVER appear on the regular Orders page
    const cleanUnified = allUnified.filter(u => !isWhatsAppOrder(u));

    // Sort all combined orders newest first
    cleanUnified.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setOrders(prev => {
      if (prev.length > 0 && cleanUnified.length > 0 && silent) {
        const prevRefs = new Set(prev.map(p => p.reference));
        const newOrders = cleanUnified.filter(u => !prevRefs.has(u.reference) && u.payment_status === "paid");
        if (newOrders.length > 0) {
          const first = newOrders[0];
          toast.success(`🎉 New Order: ${first.capacity}GB ${first.network} → ${first.recipient_phone}!`);
        }
      }
      return cleanUnified;
    });

    addNumbers(collectedNumbers);
    syncActiveOrders(cleanUnified);
    // Cache unified orders for 15s locally (stale-while-revalidate)
    setCache("admin_orders_list", { orders: cleanUnified, collectedNumbers }, 15 * 1000);

    if (!silent) setLoading(false);

    // Automatically check recent pending orders in the background and dispatch recovery SMS
    const pendingOrdersToSync = cleanUnified.filter(
      (o) => o.source !== "free_data" && o.payment_status === "pending" && Date.now() - new Date(o.created_at).getTime() > 90000
    );
    if (pendingOrdersToSync.length > 0) {
      setTimeout(() => {
        syncAllLivePayments(true).catch(() => {});
      }, 1500);
    }
  };

  useEffect(() => {
    document.title = "Admin · All Orders";
    load(false, false);

    // Auto-refresh every 15 seconds when tab is active
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        load(true, false);
      }
    }, 15000);

    // Refetch when tab regains focus (fast cached / db fetch, no heavy gateway blocking)
    const onFocus = () => {
      load(true, false);
    };
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const retry = async (o: UnifiedOrder) => {
    setRetrying(o.id);
    const reference = (o.source as string) === "whatsapp" ? o.datamart_reference || o.reference : o.reference;
    const { data, error } = await invokeApiFunction("paystack-verify", { body: { reference, retry: true } });
    setRetrying(null);
    if (error || data?.error) {
      toast.error(error?.message || data?.error || "Retry failed");
      return;
    }
    toast.success(data?.message || "Order refreshed & synced with DataMart");
    invalidateCache("admin_orders_list");
    load(true, true);
  };

  const [sendingSmsRef, setSendingSmsRef] = useState<string | null>(null);

  const sendRecoverySms = async (o: UnifiedOrder) => {
    setSendingSmsRef(o.reference);
    try {
      const phone = o.recipient_phone;
      if (!phone || phone === "—") throw new Error("No recipient phone number on order");

      const isAgent =
        o.source === "agent" ||
        Boolean(o.agent_id) ||
        Boolean(
          o.agent_store_name &&
          o.agent_store_name.toLowerCase() !== "data1gh" &&
          o.agent_store_name.toLowerCase() !== "dataone gh" &&
          o.agent_store_name.toLowerCase() !== "data 1 gh"
        );

      let trackUrl = "";
      let brand = "Data1GH";

      if (isAgent) {
        brand = (o.agent_store_name || "Agent Store").trim();
        let slug = o.agent_store_slug || "";
        let customDomain = o.agent_custom_domain || "";

        if (!slug && o.agent_id) {
          const matched = agentList.find(a => a.id === o.agent_id || a.store_slug === o.agent_id);
          if (matched) {
            slug = matched.store_slug || "";
            customDomain = matched.custom_domain || "";
          }
        }

        if (!slug && o.agent_store_name) {
          const matched = agentList.find(
            a => a.store_name?.toLowerCase().trim() === o.agent_store_name?.toLowerCase().trim()
          );
          if (matched) {
            slug = matched.store_slug || "";
            customDomain = matched.custom_domain || "";
          }
        }

        if (!slug && o.agent_store_name) {
          slug = o.agent_store_name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, "")
            .replace(/[\s_-]+/g, "-")
            .replace(/^-+|-+$/g, "");
        }

        const baseDomain = (
          customDomain ||
          "https://gooddata1.vercel.app"
        ).trim().replace(/\/+$/, "");

        trackUrl = slug
          ? `${baseDomain}/s/${slug}?ref=${encodeURIComponent(o.reference)}`
          : `${baseDomain}/track?ref=${encodeURIComponent(o.reference)}`;
      } else {
        trackUrl = `https://www.data1gh.com/track?ref=${encodeURIComponent(o.reference)}`;
        brand = "Data1GH";
      }

      const amtStr = o.amount ? Number(o.amount).toFixed(2) : "";
      const msg = amtStr
        ? `Dear customer, your payment of GHS ${amtStr} for order ${o.reference} could not complete due to low MoMo wallet balance. Top up your wallet & complete here: ${trackUrl} - ${brand}`
        : `Dear customer, your payment for order ${o.reference} could not complete due to low MoMo wallet balance. Top up your wallet & complete here: ${trackUrl} - ${brand}`;

      const { data, error } = await invokeApiFunction("admin-data", {
        body: {
          action: "resendCustomerSms",
          recipient: phone,
          message: msg,
          reference: o.reference,
          type: "payment_issue",
        },
      });

      if (error || !data?.ok) {
        throw new Error(error?.message || data?.error || "Arkesel rejected SMS");
      }
      toast.success(`Payment recovery SMS sent to ${phone}!`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send recovery SMS");
    } finally {
      setSendingSmsRef(null);
    }
  };

  const counts = useMemo(() => {
    const isPaid = (o: UnifiedOrder) =>
      o.payment_status === "paid" || o.status === "paid" || o.source === "free_data" || o.payment_status === "free_voucher";
    const paidOrders = orders.filter(isPaid);
    const pendingOrders = orders.filter(o => o.source !== "free_data" && (o.payment_status === "pending" || o.payment_status === "unpaid"));
    return {
      all: orders.length,
      paid: paidOrders.length,
      pendingPayments: pendingOrders.length,
      paystack: orders.filter(o => o.source === "paystack" && !o.agent_id).length,
      agent: orders.filter(o => o.source === "agent" || Boolean(o.agent_id)).length,
      free_data: orders.filter(o => o.source === "free_data").length,
    };
  }, [orders]);

  const filtered = orders.filter(o => {
    if (sourceFilter === "agent" && o.source !== "agent" && !o.agent_id) return false;
    if (sourceFilter === "paystack" && (o.source !== "paystack" || Boolean(o.agent_id))) return false;
    if (sourceFilter === "free_data" && o.source !== "free_data") return false;
    if (agentFilter !== "all" && (sourceFilter === "agent" || o.source === "agent") && o.agent_id !== agentFilter) return false;
    if (network !== "all" && o.network.toUpperCase() !== network.toUpperCase()) return false;
    if (delivery !== "all" && o.delivery_status !== delivery) return false;
    if (paymentFilter !== "all") {
      if (paymentFilter === "pending" && !["pending", "unpaid"].includes(o.payment_status)) return false;
      if (paymentFilter === "paid" && o.payment_status !== "paid" && o.status !== "paid" && o.source !== "free_data" && o.payment_status !== "free_voucher") return false;
      if (paymentFilter === "failed" && !["failed", "abandoned"].includes(o.payment_status)) return false;
    }
    if (
      q &&
      !`${o.display_reference || ""} ${o.reference} ${o.recipient_phone} ${o.customer_email || ""} ${o.datamart_reference || ""} ${o.agent_name || ""} ${o.agent_store_name || ""} ${o.agent_id || ""} ${o.notes || ""}`
        .toLowerCase()
        .includes(q.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const uniqueNumbers = Array.from(new Set(systemNumbers.map(n => n.trim()).filter(Boolean)));

  const copyNumbers = async () => {
    if (!uniqueNumbers.length) {
      toast.error("No numbers to copy");
      return;
    }
    const text = uniqueNumbers.join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast.success(`Copied ${uniqueNumbers.length} number${uniqueNumbers.length > 1 ? "s" : ""}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black">All Orders</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Paystack / Website orders and Free Data vouchers.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowNumbers(v => !v)}>
            <Copy className="size-4 mr-1" /> {showNumbers ? "Hide" : "Show"} all numbers ({uniqueNumbers.length})
          </Button>
          <Button variant="secondary" size="sm" onClick={copyNumbers}>
            <Copy className="size-4 mr-1" /> Copy numbers
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            invalidateCache("admin_orders_list");
            load(false, true);
          }}>
            <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={syncAllLivePayments}
            disabled={syncingLivePayments}
            className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-medium"
            title="Automatically check Paystack live payment status for pending orders and update database"
          >
            <CreditCard className={`size-4 mr-1 ${syncingLivePayments ? "animate-spin text-emerald-400" : ""}`} />
            {syncingLivePayments
              ? "Syncing Payments..."
              : `Sync Live Payments (Paystack)${counts.pendingPayments > 0 ? ` (${counts.pendingPayments})` : ""}`}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={syncAllDataMart}
            disabled={syncingAll}
            className="border-sky-500/40 text-sky-400 hover:bg-sky-500/10 font-medium"
            title="Automatically check Paystack payments and sync live Delamart delivery statuses"
          >
            <RefreshCw className={`size-4 mr-1 ${syncingAll ? "animate-spin text-sky-400" : ""}`} />
            {syncingAll ? "Auto Syncing All..." : "Auto Sync All (Delamart)"}
          </Button>
          <Button asChild variant="outline" size="sm" className="border-amber-500/40 text-amber-500 hover:bg-amber-500/10 font-medium">
            <Link to="/admin/sms-logs">
              <MessageSquareText className="size-4 mr-1" /> SMS Logs (24h)
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-medium">
            <Link to="/admin/whatsapp-orders">
              <MessageCircle className="size-4 mr-1" /> WhatsApp Orders
            </Link>
          </Button>
        </div>
      </div>

      {/* Real Delamart Live Delivery Tracker */}
      <DeliveryTracker />

      {/* Phone numbers modal / drawer card */}
      {showNumbers && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-bold">All phone numbers ({uniqueNumbers.length})</h2>
            <Button variant="outline" size="sm" onClick={copyNumbers}>
              <Copy className="size-4 mr-1" /> Copy list
            </Button>
          </div>
          {uniqueNumbers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Numbers are still loading. Click Refresh and try again.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
              {uniqueNumbers.map(number => (
                <PhoneLink key={number} value={number} />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Source & Status Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setSourceFilter("all");
            setPaymentFilter("all");
            setAgentFilter("all");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
            sourceFilter === "all" && paymentFilter === "all"
              ? "bg-foreground text-background border-foreground shadow-sm"
              : "bg-card/70 hover:bg-card border-border text-muted-foreground"
          }`}
        >
          All Orders ({counts.all})
        </button>
        <button
          type="button"
          onClick={() => {
            setPaymentFilter("paid");
            setSourceFilter("all");
            setAgentFilter("all");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
            paymentFilter === "paid" && sourceFilter === "all"
              ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
              : "bg-card/70 hover:bg-card border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <CheckCircle2 className="size-3.5" /> Paid & Delivered ({counts.paid})
        </button>
        <button
          type="button"
          onClick={() => {
            setPaymentFilter("pending");
            setSourceFilter("all");
            setAgentFilter("all");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 relative ${
            paymentFilter === "pending"
              ? "bg-amber-500 text-black border-amber-400 shadow-sm font-black"
              : counts.pendingPayments > 0
              ? "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
              : "bg-card/70 hover:bg-card border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="size-3.5" /> Pending ({counts.pendingPayments})
          {counts.pendingPayments > 0 && paymentFilter !== "pending" && (
            <span className="inline-flex size-2 rounded-full bg-amber-400 animate-pulse ml-0.5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setSourceFilter("paystack");
            setPaymentFilter("all");
            setAgentFilter("all");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
            sourceFilter === "paystack"
              ? "bg-sky-500 text-white border-sky-600 shadow-sm"
              : "bg-card/70 hover:bg-card border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <CreditCard className="size-3.5" /> Direct Web ({counts.paystack})
        </button>
        <button
          type="button"
          onClick={() => {
            setSourceFilter("agent");
            setPaymentFilter("all");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
            sourceFilter === "agent"
              ? "bg-cyan-500 text-black border-cyan-400 shadow-sm font-black"
              : "bg-card/70 hover:bg-card border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Store className="size-3.5" /> Agent Resellers ({counts.agent})
        </button>
        <button
          type="button"
          onClick={() => {
            setSourceFilter("free_data");
            setPaymentFilter("all");
            setAgentFilter("all");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
            sourceFilter === "free_data"
              ? "bg-amber-500 text-white border-amber-600 shadow-sm"
              : "bg-card/70 hover:bg-card border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Gift className="size-3.5" /> Free Data Vouchers ({counts.free_data})
        </button>
      </div>

      {/* Search & Filter Bar */}
      <Card className="p-3 md:p-4 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search reference, phone, agent or email"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        {agentList.length > 0 && sourceFilter !== "paystack" && sourceFilter !== "free_data" && (
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents ({agentList.length})</SelectItem>
              {agentList.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {a.store_name} ({a.name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={network} onValueChange={setNetwork}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All networks</SelectItem>
            <SelectItem value="MTN">MTN</SelectItem>
            <SelectItem value="TELECEL">Telecel</SelectItem>
            <SelectItem value="AT">AirtelTigo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Payment status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders ({counts.all})</SelectItem>
            <SelectItem value="paid">Paid & Delivered ({counts.paid})</SelectItem>
            <SelectItem value="pending">
              Pending {counts.pendingPayments > 0 ? `(${counts.pendingPayments})` : ""}
            </SelectItem>
            <SelectItem value="failed">Failed / Abandoned</SelectItem>
          </SelectContent>
        </Select>
        <Select value={delivery} onValueChange={setDelivery}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="unclaimed">Unclaimed</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      {/* Orders Table */}
      <Card className="p-0 overflow-hidden">
        {loading && orders.length === 0 ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Reference / Code</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Network</th>
                  <th className="p-3">Bundle</th>
                  <th className="p-3">Recipient Phone</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3">Delivery</th>
                  <th className="p-3 text-right">Actions</th>
                  <th className="p-3">Admin Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-muted-foreground">
                      No orders match your filter criteria.
                    </td>
                  </tr>
                )}
                {filtered.map(o => (
                  <FragmentWithKey key={o.id}>
                    <tr className="border-t hover:bg-muted/20 transition-colors">
                      <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 font-mono text-xs font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span>{o.display_reference || o.reference}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(o.display_reference || o.reference);
                              toast.success("Reference copied");
                            }}
                            className="text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100"
                            title="Copy reference"
                          >
                            <Copy className="size-3" />
                          </button>
                        </div>
                        {o.datamart_reference && o.datamart_reference !== o.reference && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[140px]" title={o.reference}>
                            Site: {o.reference}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <SourceBadge
                          source={o.source}
                          agentStoreName={o.agent_store_name || o.agent_name}
                          agentName={o.agent_name}
                        />
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${networkClass(o.network)}`}>
                          {NETWORK_LABEL[o.network] || o.network}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-foreground">
                        {o.capacity}{o.capacity.toLowerCase().includes("gb") ? "" : "GB"}
                      </td>
                      <td className="p-3">
                        {o.recipient_phone && o.recipient_phone !== "—" && !o.recipient_phone.includes("Unclaimed") ? (
                          <PhoneLink value={o.recipient_phone} />
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            {o.recipient_phone || "Not claimed yet"}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-bold">
                        {o.source === "free_data" ? (
                          <span className="inline-flex px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-black">
                            FREE
                          </span>
                        ) : (
                          <div>
                            <div>{formatGHS(o.amount)}</div>
                            {o.agent_profit !== undefined && o.agent_profit > 0 && (
                              <div className="text-[10px] text-emerald-400 font-mono font-bold whitespace-nowrap">
                                Reseller: +{formatGHS(o.agent_profit)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {o.source === "free_data" ? (
                          <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/15">
                            {o.payment_status === "free" ? "Free Voucher" : "Unclaimed"}
                          </Badge>
                        ) : (
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge s={o.payment_status} />
                            {o.payment_status !== "paid" && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={syncingPaymentRef.current.has(o.reference)}
                                onClick={() => syncSingleLivePayment(o)}
                                className="h-5 text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-bold gap-1 shadow-sm whitespace-nowrap"
                                title="Check Paystack live for payment"
                              >
                                <CreditCard className={`size-2.5 ${syncingPaymentRef.current.has(o.reference) ? "animate-spin text-emerald-400" : ""}`} />
                                Sync Payment
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1 items-start">
                          <StatusBadge s={resolveDisplayDeliveryStatus(o)} />
                          {o.datamart_reference && o.datamart_reference !== o.reference && (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              DM Ref: {o.datamart_reference}
                            </div>
                          )}
                        </div>
                        {o.error_message && o.delivery_status === "failed" && !o.datamart_reference && o.payment_status !== "paid" && (
                          <div className="text-[11px] text-destructive mt-1 max-w-[180px] truncate" title={o.error_message}>
                            {o.error_message}
                          </div>
                        )}
                        {o.notes && (
                          <div className="text-[11px] text-muted-foreground mt-0.5 max-w-[180px] truncate" title={o.notes}>
                            {o.notes}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {o.source !== "free_data" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={syncingPaymentRef.current.has(o.reference) || syncingRef.current.has(o.reference)}
                              onClick={() => o.payment_status !== "paid" ? syncSingleLivePayment(o) : syncSingleOrder(o)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                              title={o.payment_status !== "paid" ? "Check live Paystack payment" : "Sync live DataMart delivery"}
                            >
                              <RefreshCw className={`size-3.5 ${(syncingPaymentRef.current.has(o.reference) || syncingRef.current.has(o.reference)) ? "animate-spin text-emerald-400" : ""}`} />
                            </Button>
                          )}
                          {o.source !== "free_data" && (o.payment_status === "paid" || (o.source as string) === "whatsapp") && o.delivery_status !== "delivered" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={retrying === o.id}
                              onClick={() => retry(o)}
                              className="h-7 text-xs px-2.5"
                            >
                              {retrying === o.id ? <Loader2 className="size-3 animate-spin" /> : "Retry"}
                            </Button>
                          )}
                          {o.source === "free_data" && o.delivery_status === "pending" && (
                            <Button asChild variant="outline" size="sm" className="h-7 text-xs px-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
                              <Link to="/admin/free-data">
                                Deliver <ArrowUpRight className="size-3 ml-1" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </td>
                      {o.source !== "free_data" && (
                        <td className="p-3 min-w-[220px]">
                          {editingId === o.id ? (
                            <div className="flex flex-col gap-2">
                              <Select value={paymentEdit} onValueChange={setPaymentEdit}>
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Payment Status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="paid">Paid</SelectItem>
                                  <SelectItem value="unpaid">Unpaid</SelectItem>
                                  <SelectItem value="failed">Failed</SelectItem>
                                </SelectContent>
                              </Select>
                              <Select value={deliveryEdit} onValueChange={setDeliveryEdit}>
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Delivery Status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="processing">Processing</SelectItem>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="delivered">Delivered</SelectItem>
                                  <SelectItem value="failed">Failed</SelectItem>
                                  <SelectItem value="refunded">Refunded</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => updateOrderStatus(o)}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={() => setEditingId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setEditingId(o.id);
                                  setDeliveryEdit(o.delivery_status || "");
                                  setPaymentEdit(o.payment_status || "");
                                }}
                              >
                                Edit Status
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={syncingRef.current.has(o.reference)}
                                onClick={() => syncSingleOrder(o)}
                                className="h-7 text-xs border-sky-500/40 text-sky-400 hover:bg-sky-500/10 gap-1 font-medium"
                                title="Automatically verify payment with Paystack & sync live Delamart delivery status"
                              >
                                <RefreshCw className={`size-3 ${syncingRef.current.has(o.reference) ? "animate-spin text-sky-400" : ""}`} />
                                Auto Sync
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={syncingPaymentRef.current.has(o.reference)}
                                onClick={() => syncSingleLivePayment(o)}
                                className="h-7 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 gap-1 font-medium"
                                title="Check Paystack live for payment status"
                              >
                                <CreditCard className={`size-3 ${syncingPaymentRef.current.has(o.reference) ? "animate-spin text-emerald-400" : ""}`} />
                                Sync Payment
                              </Button>
                              {(o.payment_status === "failed" || o.payment_status === "abandoned") && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={sendingSmsRef === o.reference}
                                  onClick={() => sendRecoverySms(o)}
                                  className="h-7 text-xs border-amber-500/40 text-amber-500 hover:bg-amber-500/10 gap-1 font-medium whitespace-nowrap"
                                  title="Send customer payment issue recovery SMS via Arkesel"
                                >
                                  {sendingSmsRef === o.reference ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <SendHorizonal className="size-3" />
                                  )}
                                  Send SMS
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                      {o.source === "free_data" && <td className="p-3" />}
                    </tr>
                  </FragmentWithKey>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

const SourceBadge = ({
  source,
  agentStoreName,
  agentName,
}: {
  source: "paystack" | "free_data" | "agent";
  agentStoreName?: string;
  agentName?: string;
}) => {
  if (source === "agent") {
    return (
      <div className="flex flex-col gap-0.5 items-start">
        <Badge className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/15 gap-1 font-bold text-[11px] whitespace-nowrap">
          <Store className="size-3" /> {agentStoreName || "Agent Store"}
        </Badge>
        {agentName && agentName !== agentStoreName && (
          <span className="text-[10px] text-muted-foreground font-medium pl-1 truncate max-w-[150px]" title={agentName}>
            by {agentName}
          </span>
        )}
      </div>
    );
  }
  if (source === "paystack") {
    return (
      <Badge className="bg-sky-500/15 text-sky-400 border border-sky-500/30 hover:bg-sky-500/15 gap-1 font-bold text-[11px]">
        <CreditCard className="size-3" /> Direct Web
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/15 gap-1 font-bold text-[11px]">
      <Gift className="size-3" /> Free Data
    </Badge>
  );
};

const StatusBadge = ({ s }: { s: string }) => {
  const norm = (s || "").toLowerCase();
  const cls =
      norm === "delivered" || norm === "completed" || norm === "paid"
      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold"
      : norm === "failed" || norm === "cancelled" || norm === "rejected"
      ? "bg-rose-500/15 text-rose-400 border border-rose-500/30 font-bold"
      : norm === "processing" || norm === "in_progress"
      ? "bg-blue-500/15 text-blue-400 border border-blue-500/30 font-medium"
      : norm === "pending" || norm === "unpaid"
      ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold"
      : norm === "waiting"
      ? "bg-violet-500/15 text-violet-400 border border-violet-500/30 font-medium"
      : norm === "refunded"
      ? "bg-orange-500/15 text-orange-400 border border-orange-500/30 font-medium"
      : norm === "unclaimed"
      ? "bg-slate-500/15 text-slate-400 border border-slate-500/30"
      : "bg-muted text-muted-foreground border border-border";
  const label =
    norm === "delivered" || norm === "completed" ? "Delivered ✓"
    : norm === "paid" ? "Paid"
    : norm === "failed" || norm === "cancelled" || norm === "rejected" ? "Failed"
    : norm === "processing" || norm === "in_progress" ? "Processing"
    : norm === "waiting" ? "Waiting"
    : norm === "refunded" ? "Refunded"
    : norm === "pending" ? "Pending"
    : norm === "unpaid" ? "Unpaid"
    : s;
  return <Badge className={`${cls} hover:${cls} text-xs`}>{label}</Badge>;
};

export default AdminOrders;
