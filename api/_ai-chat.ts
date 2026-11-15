import { getSupabase, setCorsHeaders, parseBody, data1db, getCachedSettings } from "./_supabase.js";
import { askCustomerSupportAI } from "./_ai-rotator.js";
import { detectAndBlockIntrusion } from "./_firewall.js";

function maskPhone(phone?: string): string {
  if (!phone) return "";
  const clean = phone.trim().replace(/\D/g, "");
  if (clean.length < 7) return clean;
  return clean.slice(0, 3) + "****" + clean.slice(-3);
}

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    let supabase: any = null;
    try {
      supabase = getSupabase();
    } catch (e: any) {
      console.warn("api/ai-chat Supabase client note:", e?.message);
    }
    const localDb = data1db.getClient();

    // Intrusion firewall: blocks PowerShell, prompt injections, and system secret probing
    if (await detectAndBlockIntrusion(req, res, supabase)) return;

    const body = parseBody(req);
    const message = (body?.message || req.query?.message || "").trim();
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!message) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }

    // 1. Proactively check if the user is asking about an order or giving a reference / phone
    let orderContext = "";

    // Check for Order Reference
    const refMatch = message.match(/(?:ORD-|WS-|CK-|NF-|BMGH-|BIGJ-)[A-Za-z0-9\-_]+|[A-Za-z0-9]{4,}-[A-Za-z0-9]{4,}/i);
    if (refMatch) {
      const ref = refMatch[0].trim();
      try {
        let { data: order } = await localDb
          .from("orders")
          .select("reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, created_at")
          .ilike("reference", `%${ref}%`)
          .limit(1)
          .maybeSingle();

        if (!order && supabase) {
          const r = await supabase
            .from("orders")
            .select("reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, created_at")
            .ilike("reference", `%${ref}%`)
            .limit(1)
            .maybeSingle();
          order = r.data;
        }

        if (order) {
          orderContext += `ORDER FOUND: Reference ${order.reference} | Network: ${order.network} | Package: ${order.capacity} | Recipient: ${maskPhone(order.recipient_phone)} | Amount: GH₵ ${Number(order.amount).toFixed(2)} | Payment Status: ${order.payment_status} | Delivery Status: ${order.delivery_status} | Placed: ${new Date(order.created_at).toLocaleString()}`;
        }
      } catch (_) {}
    }

    // Check for 10-digit Ghana Phone Number
    const phoneMatch = message.match(/(?:\+?233|0)[235]\d{8}/);
    if (!orderContext && phoneMatch) {
      const rawPhone = phoneMatch[0].replace(/\D/g, "");
      const last9 = rawPhone.slice(-9);

      try {
        let { data: pOrders } = await localDb
          .from("orders")
          .select("reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, created_at")
          .ilike("recipient_phone", `%${last9}%`)
          .order("created_at", { ascending: false })
          .limit(1);

        if ((!pOrders || pOrders.length === 0) && supabase) {
          const r = await supabase
            .from("orders")
            .select("reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, created_at")
            .ilike("recipient_phone", `%${last9}%`)
            .order("created_at", { ascending: false })
            .limit(1);
          pOrders = r.data;
        }

        if (pOrders && pOrders.length > 0) {
          const o = pOrders[0];
          orderContext += `ORDER FOUND: Reference ${o.reference} | Network: ${o.network} | Package: ${o.capacity} | Recipient: ${maskPhone(o.recipient_phone)} | Amount: GH₵ ${Number(o.amount).toFixed(2)} | Payment Status: ${o.payment_status} | Delivery Status: ${o.delivery_status} | Placed: ${new Date(o.created_at).toLocaleString()}`;
        }
      } catch (_) {}
    }

    const settings = await getCachedSettings(supabase).catch(() => ({}));

    // 2. Dispatch to AI Rotator
    const aiRes = await askCustomerSupportAI({
      userMessage: message,
      history,
      extraContext: orderContext || undefined,
      supabase,
      settings,
    });

    // 3. Save to Supabase and localDb chat conversations so Admin Live Support sees queries immediately
    const session = String(body?.session || req.headers?.["x-session-id"] || "").trim();
    const providedPhone = body?.phone || (phoneMatch ? phoneMatch[0].replace(/\D/g, "") : "");
    const providedName = body?.name || "";
    let conversationId = body?.conversation_id || null;

    if (session && aiRes?.reply) {
      // 3A. Supabase write-through (Primary for live multi-user persistence)
      if (supabase) {
        try {
          let conv: any = null;
          if (conversationId) {
            const { data } = await supabase
              .from("chat_conversations")
              .select("id, visitor_phone, visitor_name, unread_for_support")
              .eq("id", conversationId)
              .maybeSingle();
            conv = data;
          }

          if (!conv) {
            const { data } = await supabase
              .from("chat_conversations")
              .select("id, visitor_phone, visitor_name, unread_for_support")
              .eq("visitor_session", session)
              .eq("status", "open")
              .order("last_message_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            conv = data;
          }

          if (conv) {
            conversationId = conv.id;
            const updates: any = {
              last_message_at: new Date().toISOString(),
              unread_for_support: (conv.unread_for_support || 0) + 1,
              updated_at: new Date().toISOString(),
            };
            if (providedPhone && !conv.visitor_phone) updates.visitor_phone = providedPhone;
            if (providedName && !conv.visitor_name) updates.visitor_name = providedName;

            await supabase
              .from("chat_conversations")
              .update(updates)
              .eq("id", conv.id);
          } else {
            const { data: newConv, error: insErr } = await supabase
              .from("chat_conversations")
              .insert({
                visitor_session: session,
                visitor_name: providedName || "Online Customer",
                visitor_phone: providedPhone || null,
                status: "open",
                last_message_at: new Date().toISOString(),
                unread_for_support: 1,
              })
              .select("id, unread_for_support")
              .single();

            if (!insErr && newConv) {
              conv = newConv;
              conversationId = newConv.id;
            }
          }

          if (conversationId) {
            await supabase.from("chat_messages").insert([
              {
                conversation_id: conversationId,
                sender: "visitor",
                body: message,
              },
              {
                conversation_id: conversationId,
                sender: "support",
                body: aiRes.reply,
              },
            ]);
          }
        } catch (supErr: any) {
          console.warn("[api/ai-chat] Supabase chat insert note:", supErr?.message);
        }
      }

      // 3B. Replicate to localDb as backup
      try {
        let conv: any = null;
        const { data: existingConv } = await localDb
          .from("chat_conversations")
          .select("id, unread_for_support")
          .eq("visitor_session", session)
          .eq("status", "open")
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingConv) {
          conv = existingConv;
        } else {
          const { data: newConv } = await localDb
            .from("chat_conversations")
            .insert({
              id: conversationId || undefined,
              visitor_session: session,
              visitor_name: providedName || "Online Customer",
              visitor_phone: providedPhone || null,
              status: "open",
              last_message_at: new Date().toISOString(),
              unread_for_support: 1,
            })
            .select("id, unread_for_support")
            .single();
          conv = newConv;
        }

        if (conv?.id) {
          await localDb.from("chat_messages").insert([
            {
              conversation_id: conv.id,
              sender: "visitor",
              body: message,
            },
            {
              conversation_id: conv.id,
              sender: "support",
              body: aiRes.reply,
            },
          ]);

          await localDb
            .from("chat_conversations")
            .update({
              last_message_at: new Date().toISOString(),
              unread_for_support: (conv.unread_for_support || 0) + 1,
            })
            .eq("id", conv.id);
        }
      } catch (dbErr: any) {
        console.warn("[api/ai-chat] LocalDb chat sync notice:", dbErr?.message);
      }
    }

    return res.status(200).json({
      ...aiRes,
      conversation_id: conversationId,
    });
  } catch (err: any) {
    console.error("[api/ai-chat] Error:", err);
    return res.status(500).json({
      success: false,
      reply: "Hello bossu! I'm temporarily having a connection glitch, but I'm right here. Please try asking again in a few seconds or drop your order details!",
      provider: "local",
      modelUsed: "local-fallback",
      error: err?.message,
    });
  }
}
