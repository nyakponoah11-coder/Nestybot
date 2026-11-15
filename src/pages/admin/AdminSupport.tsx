import { useEffect, useRef, useState } from "react";
import { invokeApiFunction, supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, RefreshCw, Search, Send, CheckCheck, CircleDot, Archive, ArrowLeft, Phone, User, ImagePlus, Mic } from "lucide-react";
import { toast } from "sonner";
import { PhoneLink } from "@/components/PhoneLink";
import { AudioPlayer } from "@/components/AudioPlayer";

interface Conversation {
  id: string;
  visitor_name: string | null;
  visitor_phone: string | null;
  status: "open" | "closed";
  last_message_at: string;
  unread_for_support: number;
  unread_for_visitor: number;
  created_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender: "visitor" | "support";
  body: string;
  read_at: string | null;
  created_at: string;
}

const filterTabs = ["all", "unread", "open", "closed"] as const;
type FilterTab = typeof filterTabs[number];

const AdminSupport = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [uploading, setUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const pendingSign = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadMessages = async (id: string) => {
    setLoadingMsgs(true);
    let loaded = false;

    try {
      const { data, error } = await invokeApiFunction("chat", {
        body: { action: "listMessages", conversation_id: id },
      });
      if (!error && Array.isArray(data?.messages)) {
        setMessages(data.messages);
        loaded = true;
      }
    } catch (_) {}

    if (!loaded) {
      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true })
          .limit(300);

        if (!error && data) {
          setMessages(data as unknown as Message[]);
          loaded = true;
        }
      } catch (_) {}
    }

    setLoadingMsgs(false);
  };

  // Open a conversation
  const open = async (id: string) => {
    setActiveId(id);
    await loadMessages(id);
    try {
      await invokeApiFunction("chat", { body: { action: "markRead", conversation_id: id } });
    } catch (_) {
      try {
        await supabase.from("chat_conversations").update({ unread_for_support: 0 }).eq("id", id);
      } catch (_) {}
    }
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread_for_support: 0 } : c)));
  };

  const loadConversations = async () => {
    setLoadingList(true);
    let loaded = false;

    // 1. Primary: Serverless API with service role (bypasses RLS, always succeeds)
    try {
      const { data, error } = await invokeApiFunction("chat", {
        body: { action: "listConversations" },
      });
      if (!error && Array.isArray(data?.conversations)) {
        setConversations(data.conversations);
        loaded = true;
        // Auto-select first chat on wide screens if none selected
        if (!activeId && data.conversations.length > 0 && typeof window !== "undefined" && window.innerWidth >= 768) {
          void open(data.conversations[0].id);
        }
      }
    } catch (_) {}

    // 2. Direct Supabase query fallback
    if (!loaded) {
      try {
        const { data, error } = await supabase
          .from("chat_conversations")
          .select("*")
          .order("last_message_at", { ascending: false })
          .limit(200);

        if (!error && data) {
          setConversations(data as unknown as Conversation[]);
          loaded = true;
          if (!activeId && data.length > 0 && typeof window !== "undefined" && window.innerWidth >= 768) {
            void open(data[0].id);
          }
        }
      } catch (_) {}
    }

    setLoadingList(false);
  };

  const deleteMessage = async (msgId: string) => {
    if (!window.confirm("Are you sure you want to delete this voice note?")) return;
    try {
      await supabase.from("chat_messages").delete().eq("id", msgId);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      toast.success("Voice note deleted");
    } catch {
      toast.error("Failed to delete voice note");
    }
  };

  useEffect(() => {
    document.title = "Admin · Support Chat";
    loadConversations();
    // Safety auto-poll every 6 seconds to ensure fresh conversations list
    const pollInterval = setInterval(() => {
      loadConversations();
    }, 6000);
    return () => clearInterval(pollInterval);
  }, []);

  // Realtime: refresh list and active messages
  useEffect(() => {
    const ch = supabase
      .channel("support-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations" }, () => loadConversations())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const m = payload.new as Message;
        if (activeId && m.conversation_id === activeId) {
          setMessages((prev) => (prev.find((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      })
      .subscribe();

    // If an active conversation is open, poll its messages every 4 seconds to guarantee zero missed replies
    let msgPoll: NodeJS.Timeout | null = null;
    if (activeId) {
      msgPoll = setInterval(() => {
        loadMessages(activeId);
      }, 4000);
    }

    return () => {
      supabase.removeChannel(ch);
      if (msgPoll) clearInterval(msgPoll);
    };
  }, [activeId]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, activeId]);

  const sendBody = async (text: string) => {
    if (!activeId) return;
    const tempId = `tmp-${Date.now()}-${Math.random()}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: activeId,
      sender: "support",
      body: text,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    let sent = false;
    try {
      const { data: inserted, error: insErr } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: activeId,
          sender: "support",
          body: text,
        })
        .select("*")
        .single();

      if (!insErr && inserted) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? (inserted as unknown as Message) : m)));
        await supabase
          .from("chat_conversations")
          .update({
            last_message_at: new Date().toISOString(),
            unread_for_visitor: 1,
          })
          .eq("id", activeId);
        sent = true;
      }
    } catch (_) {}

    if (!sent) {
      const { error, data } = await invokeApiFunction("chat", {
        body: { action: "reply", conversation_id: activeId, body: text },
      });
      if (error || data?.error) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        throw new Error(data?.error || error?.message || "Send failed");
      }
      if (data?.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? data.message : m)).filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i)
        );
      }
    }
  };

  const reply = async () => {
    if (!activeId || !draft.trim() || sending) return;
    const text = draft.trim();
    setDraft("");
    setSending(true);
    try { await sendBody(text); }
    catch (e: any) { setDraft(text); toast.error(e.message || "Send failed"); }
    finally { setSending(false); }
  };

  const resolveSigned = async (path: string) => {
    if (!activeId || pendingSign.current.has(path)) return;
    pendingSign.current.add(path);
    const { data } = await invokeApiFunction("chat", {
      body: { action: "staffSignView", conversation_id: activeId, path },
    });
    if (data?.url) setSignedUrls((prev) => ({ ...prev, [path]: data.url }));
  };

  const uploadImage = async (file: File) => {
    if (!activeId) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 8 * 1024 * 1024) { toast.error("Image too large (max 8MB)"); return; }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").replace(/[^a-zA-Z0-9]/g, "").slice(0, 5) || "png";
      const { data: sig, error: sErr } = await invokeApiFunction("chat", {
        body: { action: "staffSignUpload", conversation_id: activeId, ext },
      });
      if (sErr || sig?.error) throw new Error(sig?.error || sErr?.message || "Upload failed");
      const { error: upErr } = await supabase.storage
        .from("chat-uploads")
        .uploadToSignedUrl(sig.path, sig.token, file, { contentType: file.type });
      if (upErr) throw upErr;
      await sendBody(`[image] storage:${sig.path}`);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (item) {
      const file = item.getAsFile();
      if (file) { e.preventDefault(); uploadImage(file); }
    }
  };

  const setStatus = async (status: "open" | "closed") => {
    if (!activeId) return;
    await invokeApiFunction("chat", { body: { action: "setStatus", conversation_id: activeId, status } });
    setConversations((prev) => prev.map((c) => (c.id === activeId ? { ...c, status } : c)));
    toast.success(status === "closed" ? "Marked as closed" : "Reopened");
  };

  const filtered = conversations.filter((c) => {
    if (tab === "unread" && c.unread_for_support === 0) return false;
    if (tab === "open" && c.status !== "open") return false;
    if (tab === "closed" && c.status !== "closed") return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${c.visitor_name || ""} ${c.visitor_phone || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const active = conversations.find((c) => c.id === activeId) || null;
  const totalUnread = conversations.reduce((a, c) => a + (c.unread_for_support || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-2">
            <MessageSquare className="size-7" /> Support chat
            {totalUnread > 0 && <Badge className="bg-red-600 hover:bg-red-600 text-white">{totalUnread} unread</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">Live messages from customers on the shop.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadConversations}><RefreshCw className="size-4 mr-1" /> Refresh</Button>
      </div>

      <div className="grid md:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-180px)] min-h-[500px]">
        {/* Conversation list — hidden on mobile when a chat is open */}
        <Card className={`overflow-hidden flex-col ${activeId ? "hidden md:flex" : "flex"}`}>
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9 h-9" placeholder="Search name or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1">
              {filterTabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 text-xs font-medium px-2 py-1.5 rounded-md capitalize transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="grid place-items-center py-10"><Loader2 className="size-5 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No conversations.</div>
            ) : (
              filtered.map((c) => {
                const isActive = c.id === activeId;
                const initial = (c.visitor_name || "V").charAt(0).toUpperCase();
                return (
                  <button
                    key={c.id}
                    onClick={() => open(c.id)}
                    className={`w-full text-left p-3 border-b hover:bg-muted/50 transition-colors flex gap-3 items-start ${isActive ? "bg-muted" : ""}`}
                  >
                    <div className="size-10 rounded-full bg-gradient-gold text-accent-foreground grid place-items-center font-bold shrink-0">
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold truncate">{c.visitor_name || "Visitor"}</div>
                        <div className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(c.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <div className="text-xs text-muted-foreground truncate">
                          {c.visitor_phone ? <PhoneLink value={c.visitor_phone} compact /> : "no phone"} · {c.status}
                        </div>
                        {c.unread_for_support > 0 && (
                          <Badge className="bg-red-600 hover:bg-red-600 text-white h-5 min-w-5 px-1.5 text-[10px] rounded-full">
                            {c.unread_for_support}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Active thread — full screen on mobile when open */}
        <Card className={`overflow-hidden flex-col ${activeId ? "flex" : "hidden md:flex"}`}>
          {!active ? (
            <div className="flex-1 grid place-items-center text-muted-foreground text-sm p-8 text-center">
              <div>
                <MessageSquare className="size-10 mx-auto mb-2 opacity-40" />
                Pick a conversation to start replying.
              </div>
            </div>
          ) : (
            <>
              {/* Phone-chat header */}
              <div className="p-3 border-b flex items-center gap-3 bg-card">
                <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => setActiveId(null)}>
                  <ArrowLeft className="size-5" />
                </Button>
                <div className="size-10 rounded-full bg-gradient-gold text-accent-foreground grid place-items-center font-bold shrink-0">
                  {(active.visitor_name || "V").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate flex items-center gap-1.5">
                    <User className="size-3.5 opacity-60" />{active.visitor_name || "Visitor"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                    <Phone className="size-3 opacity-60" />{active.visitor_phone ? <PhoneLink value={active.visitor_phone} compact /> : "No phone"} · {active.status}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {active.status === "open" ? (
                    <Button variant="outline" size="sm" onClick={() => setStatus("closed")}><Archive className="size-4 md:mr-1" /><span className="hidden md:inline">Close</span></Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setStatus("open")}><CircleDot className="size-4 md:mr-1" /><span className="hidden md:inline">Reopen</span></Button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-[hsl(var(--muted))]/30">
                {loadingMsgs ? (
                  <div className="grid place-items-center py-8"><Loader2 className="size-5 animate-spin" /></div>
                ) : messages.length === 0 ? (
                  <div className="text-xs text-center text-muted-foreground py-8">No messages yet. Say hi 👋</div>
                ) : (
                  messages.map((m) => {
                    const imgMatch = m.body.match(/^\[image\]\s+(\S+)$/);
                    const imgRef = imgMatch?.[1] ?? "";
                    const storagePath = imgRef.startsWith("storage:") ? imgRef.slice(8) : null;
                    const imgSrc = storagePath ? signedUrls[storagePath] : imgRef;
                    if (storagePath && !signedUrls[storagePath]) void resolveSigned(storagePath);

                    const audioMatch = m.body.match(/\[audio\]\s*(\S+)/);
                    const voiceTranscriptMatch = m.body.match(/^\[voice\]\s*([\s\S]*?)(?:\n\[(?:audio|bundle)|$)/);
                    const bundleMatch = m.body.match(/\[bundle:\s*([^\]]+)\]/);
                    const isAiVoice = m.body.startsWith("[ai_voice]");

                    return (
                    <div key={m.id} className={`flex ${m.sender === "support" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${m.sender === "support" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border rounded-bl-sm"}`}>
                        {imgMatch ? (
                          imgSrc ? (
                            <a href={imgSrc} target="_blank" rel="noreferrer" className="block">
                              <img src={imgSrc} alt="Attachment" className="rounded-lg max-h-60 w-auto" loading="lazy" />
                            </a>
                          ) : (
                            <div className="h-24 w-40 rounded-lg bg-muted animate-pulse" />
                          )
                        ) : audioMatch ? (
                          <div className="space-y-1.5 py-1 min-w-[250px]">
                            <AudioPlayer
                              src={audioMatch[1]}
                              showTranscript={false}
                              onDelete={() => deleteMessage(m.id)}
                              className="bg-black/60 border-emerald-500/30 text-white"
                            />
                          </div>
                        ) : isAiVoice ? (
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">AI Voice Reply:</span>
                            <div className="whitespace-pre-wrap break-words">{m.body.replace(/^\[ai_voice\]\s*/, "")}</div>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap break-words">{m.body}</div>
                        )}
                        <div className="text-[10px] opacity-60 mt-0.5 flex items-center gap-1 justify-end">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {m.sender === "support" && m.read_at && <CheckCheck className="size-3" />}
                        </div>
                      </div>
                    </div>
                    );
                  })
                )}
              </div>

              {/* Big reply area */}
              <div className="p-3 border-t flex gap-2 items-end bg-card">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="shrink-0 h-[80px] w-12 p-0"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || !activeId}
                  title="Attach image"
                >
                  {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
                </Button>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onPaste={onPaste}
                  placeholder="Type your reply or paste an image… (Shift+Enter for new line)"
                  rows={3}
                  maxLength={2000}
                  className="resize-none min-h-[80px] max-h-60 text-base"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      reply();
                    }
                  }}
                />
                <Button onClick={reply} disabled={!draft.trim() || sending} size="lg" className="shrink-0 h-[80px]">
                  {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminSupport;
