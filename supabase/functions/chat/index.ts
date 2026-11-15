// Live in-site chat backend.
// - Visitors call: start, send, list (using a visitor_session token they own)
// - Support/admin call: listConversations, listMessages, reply, markRead, setStatus
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), {
  status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const Session = z.string().min(8).max(100);
const Body = z.string().trim().min(1).max(2000);

const Schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), session: Session, name: z.string().trim().max(80).optional(), phone: z.string().trim().max(40).optional(), force_new: z.boolean().optional() }),
  z.object({ action: z.literal("send"), session: Session, conversation_id: z.string().optional(), body: Body, name: z.string().trim().max(80).optional(), phone: z.string().trim().max(40).optional() }),
  z.object({ action: z.literal("list"), session: Session, conversation_id: z.string().optional() }),
  z.object({ action: z.literal("markVisitorRead"), session: Session, conversation_id: z.string().optional() }),
  z.object({ action: z.literal("signUpload"), session: Session, conversation_id: z.string().uuid(), ext: z.string().regex(/^[a-zA-Z0-9]{1,5}$/) }),
  z.object({ action: z.literal("signView"), session: Session, conversation_id: z.string().uuid(), path: z.string().min(1).max(300) }),
  // staff
  z.object({ action: z.literal("listConversations") }),
  z.object({ action: z.literal("listMessages"), conversation_id: z.string().uuid() }),
  z.object({ action: z.literal("reply"), conversation_id: z.string().uuid(), body: Body }),
  z.object({ action: z.literal("markRead"), conversation_id: z.string().uuid() }),
  z.object({ action: z.literal("setStatus"), conversation_id: z.string().uuid(), status: z.enum(["open","closed"]) }),
  z.object({ action: z.literal("staffSignUpload"), conversation_id: z.string().uuid(), ext: z.string().regex(/^[a-zA-Z0-9]{1,5}$/) }),
  z.object({ action: z.literal("staffSignView"), conversation_id: z.string().uuid(), path: z.string().min(1).max(300) }),
]);

const STAFF_ACTIONS = new Set(["listConversations","listMessages","reply","markRead","setStatus","staffSignUpload","staffSignView"]);
const BUCKET = "chat-uploads";

// Files always live under `<conversation_id>/...` so access can be scoped.
const inConversation = (path: string, conversationId: string) =>
  path.startsWith(`${conversationId}/`) && !path.includes("..");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const parsed = Schema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
    const data = parsed.data;

    // Staff gate
    if (STAFF_ACTIONS.has(data.action)) {
      const auth = req.headers.get("Authorization");
      if (!auth) return json({ error: "Unauthorized" }, 401);
      const token = auth.replace("Bearer ", "");
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
      );
      const { data: ud } = await userClient.auth.getUser(token);
      if (!ud.user) return json({ error: "Unauthorized" }, 401);
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", ud.user.id);
      const isStaff = (roles || []).some(r => r.role === "admin" || r.role === "support");
      if (!isStaff) return json({ error: "Forbidden" }, 403);
    }

    switch (data.action) {
      case "start": {
        const forceNew = Boolean(data.force_new);
        if (!forceNew) {
          // Reuse existing open conversation for this session
          const { data: existing } = await admin.from("chat_conversations")
            .select("*").eq("visitor_session", data.session).eq("status","open")
            .order("last_message_at",{ascending:false}).limit(1).maybeSingle();
          if (existing) {
            if (data.name || data.phone) {
              await admin.from("chat_conversations").update({
                visitor_name: data.name ?? existing.visitor_name,
                visitor_phone: data.phone ?? existing.visitor_phone,
              }).eq("id", existing.id);
            }
            return json({ conversation: existing });
          }
        }
        const { data: conv, error } = await admin.from("chat_conversations")
          .insert({ visitor_session: data.session, visitor_name: data.name, visitor_phone: data.phone, status: "open" })
          .select("*").single();
        if (error) return json({ error: error.message }, 500);
        return json({ conversation: conv });
      }
      case "send": {
        let conv: any = null;
        if (data.conversation_id) {
          const { data: found } = await admin.from("chat_conversations")
            .select("id,visitor_session,unread_for_support").eq("id", data.conversation_id).maybeSingle();
          if (found && (!found.visitor_session || found.visitor_session === data.session)) {
            conv = found;
          }
        }

        if (!conv && data.session) {
          const { data: existing } = await admin.from("chat_conversations")
            .select("id,visitor_session,unread_for_support")
            .eq("visitor_session", data.session)
            .eq("status", "open")
            .order("last_message_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          conv = existing;
        }

        if (!conv && data.session) {
          const { data: newConv } = await admin.from("chat_conversations")
            .insert({ visitor_session: data.session, visitor_name: data.name, visitor_phone: data.phone, status: "open" })
            .select("id,visitor_session,unread_for_support")
            .single();
          conv = newConv;
        }

        if (!conv) return json({ error: "Could not find or create conversation" }, 500);

        const { data: msg, error: mErr } = await admin.from("chat_messages")
          .insert({ conversation_id: conv.id, sender: "visitor", body: data.body })
          .select("*").single();
        if (mErr) return json({ error: mErr.message }, 500);
        await admin.from("chat_conversations").update({
          last_message_at: new Date().toISOString(),
          unread_for_support: (conv.unread_for_support ?? 0) + 1,
          status: "open",
        }).eq("id", conv.id);
        return json({ ok: true, message: msg, conversation_id: conv.id });
      }
      case "list": {
        let conv: any = null;
        if (data.conversation_id) {
          const { data: found } = await admin.from("chat_conversations")
            .select("id,visitor_session").eq("id", data.conversation_id).maybeSingle();
          if (found && (!found.visitor_session || found.visitor_session === data.session)) {
            conv = found;
          }
        }

        if (!conv && data.session) {
          const { data: existing } = await admin.from("chat_conversations")
            .select("id,visitor_session")
            .eq("visitor_session", data.session)
            .eq("status", "open")
            .order("last_message_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          conv = existing;
        }

        if (!conv) return json({ messages: [], conversation_id: null });

        const { data: msgs, error } = await admin.from("chat_messages")
          .select("*").eq("conversation_id", conv.id).order("created_at", { ascending: true });
        if (error) return json({ error: error.message }, 500);
        return json({ messages: msgs || [], conversation_id: conv.id });
      }
      case "markVisitorRead": {
        if (!data.conversation_id) return json({ ok: true });
        const { data: conv } = await admin.from("chat_conversations")
          .select("visitor_session").eq("id", data.conversation_id).maybeSingle();
        if (!conv || conv.visitor_session !== data.session) return json({ ok: true });
        await admin.from("chat_conversations").update({ unread_for_visitor: 0 }).eq("id", data.conversation_id);
        await admin.from("chat_messages").update({ read_at: new Date().toISOString() })
          .eq("conversation_id", data.conversation_id).eq("sender","support").is("read_at", null);
        return json({ ok: true });
      }
      case "signUpload":
      case "signView": {
        const { data: conv } = await admin.from("chat_conversations")
          .select("visitor_session").eq("id", data.conversation_id).maybeSingle();
        if (!conv || conv.visitor_session !== data.session) return json({ error: "Not found" }, 404);
        if (data.action === "signUpload") {
          const path = `${data.conversation_id}/${crypto.randomUUID()}.${data.ext}`;
          const { data: signed, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
          if (error) return json({ error: error.message }, 500);
          return json({ path, token: signed.token });
        }
        if (!inConversation(data.path, data.conversation_id)) return json({ error: "Forbidden" }, 403);
        const { data: signed, error } = await admin.storage.from(BUCKET).createSignedUrl(data.path, 3600);
        if (error) return json({ error: error.message }, 500);
        return json({ url: signed.signedUrl });
      }
      case "staffSignUpload": {
        const path = `${data.conversation_id}/${crypto.randomUUID()}.${data.ext}`;
        const { data: signed, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
        if (error) return json({ error: error.message }, 500);
        return json({ path, token: signed.token });
      }
      case "staffSignView": {
        if (!inConversation(data.path, data.conversation_id)) return json({ error: "Forbidden" }, 403);
        const { data: signed, error } = await admin.storage.from(BUCKET).createSignedUrl(data.path, 3600);
        if (error) return json({ error: error.message }, 500);
        return json({ url: signed.signedUrl });
      }
      case "listConversations": {
        const { data: rows, error } = await admin.from("chat_conversations")
          .select("*").order("last_message_at", { ascending: false }).limit(200);
        if (error) return json({ error: error.message }, 500);
        return json({ conversations: rows || [] });
      }
      case "listMessages": {
        const { data: msgs, error } = await admin.from("chat_messages")
          .select("*").eq("conversation_id", data.conversation_id).order("created_at", { ascending: true });
        if (error) return json({ error: error.message }, 500);
        return json({ messages: msgs || [] });
      }
      case "reply": {
        const { data: msg, error } = await admin.from("chat_messages")
          .insert({ conversation_id: data.conversation_id, sender: "support", body: data.body })
          .select("*").single();
        if (error) return json({ error: error.message }, 500);
        const { data: conv } = await admin.from("chat_conversations")
          .select("unread_for_visitor").eq("id", data.conversation_id).maybeSingle();
        await admin.from("chat_conversations").update({
          last_message_at: new Date().toISOString(),
          unread_for_visitor: (conv?.unread_for_visitor ?? 0) + 1,
          unread_for_support: 0,
        }).eq("id", data.conversation_id);
        return json({ ok: true, message: msg });
      }
      case "markRead": {
        await admin.from("chat_conversations").update({ unread_for_support: 0 }).eq("id", data.conversation_id);
        await admin.from("chat_messages").update({ read_at: new Date().toISOString() })
          .eq("conversation_id", data.conversation_id).eq("sender","visitor").is("read_at", null);
        return json({ ok: true });
      }
      case "setStatus": {
        await admin.from("chat_conversations").update({ status: data.status }).eq("id", data.conversation_id);
        return json({ ok: true });
      }
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
