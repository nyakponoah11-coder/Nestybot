import { useEffect, useRef, useState } from "react";
import { ImagePlus, MessageCircle, Send, X, Loader2, Mic, Square, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { AudioPlayer } from "@/components/AudioPlayer";

interface Props {
  shopName?: string;
}

interface Msg {
  id: string;
  sender: "visitor" | "support";
  body: string;
  created_at: string;
}

const SESSION_KEY = "support_chat_session";
const CONV_KEY = "support_chat_conv";

const safeUUID = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  return "sess_" + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
};

const getSession = () => {
  try {
    let s = localStorage.getItem(SESSION_KEY);
    if (!s) {
      s = safeUUID();
      localStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return safeUUID();
  }
};

export const SupportChatWidget = ({ shopName }: Props) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState(localStorage.getItem("support_chat_name") || "");
  const [phone, setPhone] = useState(localStorage.getItem("support_chat_phone") || "");
  const [conversationId, setConversationId] = useState<string | null>(localStorage.getItem(CONV_KEY));
  const [messages, setMessages] = useState<Msg[]>([]);
  const [unread, setUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const pendingSign = useRef<Set<string>>(new Set());
  const session = useRef(getSession());
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Voice note timer
  useEffect(() => {
    if (isRecording) {
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } else {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      setRecordSeconds(0);
    }
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, [isRecording]);

  const startVoiceRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert("Audio recording is not supported in this browser.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      alert("Microphone permission denied or not available.");
    }
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    audioChunksRef.current = [];
  };

  const stopAndSendVoiceNote = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
    const recorder = mediaRecorderRef.current;

    recorder.onstop = async () => {
      setIsRecording(false);
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result === "string") {
          const body = `[voice] Customer Voice Note (${recordSeconds}s)\n[audio] ${reader.result}`;
          await sendBody(body);
        }
      };
      reader.readAsDataURL(audioBlob);
    };

    recorder.stop();
  };

  // Load messages + subscribe when we have a conversation
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("chat", {
          body: { action: "list", session: session.current, conversation_id: conversationId },
        });
        const errText = (data?.error || error?.message || "").toLowerCase();
        if (errText.includes("not found")) {
          localStorage.removeItem(CONV_KEY);
          if (!cancelled) {
            setConversationId(null);
            setMessages([]);
          }
          return;
        }
        if (!cancelled) {
          if (Array.isArray(data?.messages)) {
            setMessages(data.messages);
          }
          if (data?.conversation_id && data.conversation_id !== conversationId) {
            setConversationId(data.conversation_id);
            localStorage.setItem(CONV_KEY, data.conversation_id);
          }
        }
      } catch (err) {
        console.warn("Could not load support messages:", err);
      }
    };
    load();

    if (!open) {
      return () => { cancelled = true; };
    }

    const channel = supabase
      .channel(`chat-visitor-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((prev) => (prev.find((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [conversationId, open]);

  // Auto-scroll & mark read when open
  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    if (open && conversationId && unread > 0) {
      setUnread(0);
      supabase.functions.invoke("chat", {
        body: { action: "markVisitorRead", session: session.current, conversation_id: conversationId },
      });
    }
  }, [open, messages, conversationId, unread]);

  // Broadcast unread count so other UI (e.g. Live chat button) can show a badge
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("support-unread", { detail: unread }));
  }, [unread]);

  // Allow other parts of the app to open the chat via window event
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-support-chat", handler);
    return () => window.removeEventListener("open-support-chat", handler);
  }, []);

  const ensureConversation = async (forceNew = false) => {
    if (!forceNew && conversationId) return conversationId;
    if (forceNew) {
      localStorage.removeItem(CONV_KEY);
      setConversationId(null);
    }
    const { data, error } = await supabase.functions.invoke("chat", {
      body: { action: "start", session: session.current, name: name || undefined, phone: phone || undefined, force_new: forceNew },
    });
    if (error || data?.error) throw new Error(data?.error || error?.message || "Could not start chat");
    const id = (data?.conversation?.id || data?.id) as string;
    if (id) {
      localStorage.setItem(CONV_KEY, id);
      if (name) localStorage.setItem("support_chat_name", name);
      if (phone) localStorage.setItem("support_chat_phone", phone);
      setConversationId(id);
      return id;
    }
    throw new Error("Could not initialize chat conversation");
  };

  const sendBody = async (body: string) => {
    const tempId = `tmp-${Date.now()}-${Math.random()}`;
    const optimistic: Msg = { id: tempId, sender: "visitor", body, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    try {
      let id = conversationId;
      if (!id) {
        id = await ensureConversation();
      }
      let res = await supabase.functions.invoke("chat", {
        body: { action: "send", session: session.current, conversation_id: id, body, name: name || undefined, phone: phone || undefined },
      });

      const errText = (res.error?.message || res.data?.error || "").toLowerCase();
      if (errText.includes("not found") || !res.data?.message) {
        console.warn("Recovering with fresh conversation session...");
        localStorage.removeItem(CONV_KEY);
        setConversationId(null);
        id = await ensureConversation(true);
        res = await supabase.functions.invoke("chat", {
          body: { action: "send", session: session.current, conversation_id: id, body, name: name || undefined, phone: phone || undefined },
        });
      }

      if (res.error || res.data?.error) throw new Error(res.data?.error || res.error?.message);

      if (res.data?.conversation_id && res.data.conversation_id !== conversationId) {
        setConversationId(res.data.conversation_id);
        localStorage.setItem(CONV_KEY, res.data.conversation_id);
      }

      if (res.data?.message) {
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== tempId);
          const next = withoutTemp.find((m) => m.id === res.data.message.id) ? withoutTemp : [...withoutTemp, res.data.message];
          if (res.data?.ai_message && !next.find((m) => m.id === res.data.ai_message.id)) {
            return [...next, res.data.ai_message];
          }
          return next;
        });
      }
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw e;
    }
  };

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 8 * 1024 * 1024) { alert("Image too large (max 8MB)"); return; }
    setUploading(true);
    try {
      let convId = conversationId;
      if (!convId) {
        convId = await ensureConversation();
      }
      const ext = (file.name.split(".").pop() || "png").replace(/[^a-zA-Z0-9]/g, "").slice(0, 5) || "png";
      let { data: sig, error: sErr } = await supabase.functions.invoke("chat", {
        body: { action: "signUpload", session: session.current, conversation_id: convId, ext },
      });
      if ((sErr?.message || sig?.error || "").toLowerCase().includes("not found")) {
        localStorage.removeItem(CONV_KEY);
        setConversationId(null);
        convId = await ensureConversation(true);
        const retryRes = await supabase.functions.invoke("chat", {
          body: { action: "signUpload", session: session.current, conversation_id: convId, ext },
        });
        sig = retryRes.data;
        sErr = retryRes.error;
      }
      if (sErr || sig?.error) throw new Error(sig?.error || sErr?.message || "Upload failed");
      const { error: upErr } = await supabase.storage
        .from("chat-uploads")
        .uploadToSignedUrl(sig.path, sig.token, file, { contentType: file.type });
      if (upErr) throw upErr;
      await sendBody(`[image] storage:${sig.path}`);
    } catch (e: any) {
      alert(e.message || "Upload failed");
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

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    try {
      await sendBody(text);
    } catch (e: any) {
      setDraft(text);
      alert(e.message || "Could not send");
    } finally {
      setSending(false);
    }
  };

  const resolveSigned = async (path: string) => {
    if (!conversationId || pendingSign.current.has(path)) return;
    pendingSign.current.add(path);
    const { data } = await supabase.functions.invoke("chat", {
      body: { action: "signView", session: session.current, conversation_id: conversationId, path },
    });
    if (data?.url) setSignedUrls((prev) => ({ ...prev, [path]: data.url }));
  };

  const renderBody = (body: string) => {
    const audioMatch = body.match(/\[audio\]\s*(\S+)/);
    const voiceTranscriptMatch = body.match(/^\[voice\]\s*([\s\S]*?)(?:\n\[(?:audio|bundle)|$)/);

    if (audioMatch) {
      return (
        <div className="space-y-1.5 py-1 min-w-[220px]">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <Mic className="size-3.5" /> Voice Note
          </div>
          <AudioPlayer
            src={audioMatch[1]}
            transcript={voiceTranscriptMatch ? voiceTranscriptMatch[1].trim() : undefined}
            className="bg-black/30 border-emerald-500/20 text-white"
          />
        </div>
      );
    }

    const m = body.match(/^\[image\]\s+(\S+)$/);
    if (m) {
      const ref = m[1];
      if (ref.startsWith("storage:")) {
        const path = ref.slice("storage:".length);
        const url = signedUrls[path];
        if (!url) {
          void resolveSigned(path);
          return <div className="h-24 w-40 rounded-lg bg-muted animate-pulse" />;
        }
        return (
          <a href={url} target="_blank" rel="noreferrer" className="block">
            <img src={url} alt="Attachment" className="rounded-lg max-h-60 w-auto" loading="lazy" />
          </a>
        );
      }
      return (
        <a href={ref} target="_blank" rel="noreferrer" className="block">
          <img src={ref} alt="Attachment" className="rounded-lg max-h-60 w-auto" loading="lazy" />
        </a>
      );
    }
    return <div className="whitespace-pre-wrap break-words">{body}</div>;
  };

  const needsIntro = !conversationId;

  return (
    <>
      {/* Floating chat button removed — chat opens via the in-page "Live chat" button (open-support-chat event). */}



      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[92vw] max-w-sm rounded-2xl border bg-card shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 flex flex-col" style={{ height: "min(560px, 80vh)" }}>
          <div className="bg-gradient-hero text-primary-foreground p-3.5 flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-2">
              <div className="font-bold text-sm truncate">Stony · {shopName || "DATA 1 GH"} Support</div>
              <div className="text-[11px] opacity-80 flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Assistant
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  window.dispatchEvent(new CustomEvent("open-voice-assistant"));
                }}
                className="size-7 bg-white/10 hover:bg-white/20 border-white/25 text-white rounded-lg flex items-center justify-center"
                title="Call"
                aria-label="Call"
              >
                <PhoneCall className="size-3.5 text-emerald-300" />
              </Button>
              <button onClick={() => setOpen(false)} aria-label="Close" className="opacity-80 hover:opacity-100 p-1">
                <X className="size-5" />
              </button>
            </div>
          </div>

          {needsIntro ? (
            <div className="p-4 space-y-3 flex-1">
              <p className="text-sm text-muted-foreground">Optional — tell us who you are, or just start chatting.</p>
              <Input placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" />
              <Input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} autoComplete="tel" />
              <Button
                onClick={async () => {
                  try { await ensureConversation(); } catch (e: any) { alert(e.message); }
                }}
                className="w-full"
              >
                Start chat
              </Button>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/30">
                {messages.length === 0 && (
                  <div className="text-xs text-center text-muted-foreground py-8">
                    Send a message — our support team will reply immediately.
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === "visitor" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.sender === "visitor" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border rounded-bl-sm"}`}>
                      {renderBody(m.body)}
                      <div className="text-[10px] opacity-60 mt-0.5">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-2 border-t flex gap-2 items-end">
                {isRecording ? (
                  <div className="flex-1 flex items-center justify-between p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 animate-pulse">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                      <span className="size-2 rounded-full bg-red-500 animate-ping" />
                      <span>Recording voice… {recordSeconds}s</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={cancelVoiceRecording}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={stopAndSendVoiceNote}
                        className="h-7 px-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1 rounded-lg"
                      >
                        <Send className="size-3" />
                        <span>Send</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
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
                      size="icon"
                      className="shrink-0"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      title="Attach image"
                    >
                      {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/30"
                      onClick={startVoiceRecording}
                      title="Record Voice Note"
                    >
                      <Mic className="size-4" />
                    </Button>

                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onPaste={onPaste}
                      placeholder="Type a message or tap mic for voice…"
                      rows={1}
                      maxLength={2000}
                      className="resize-none min-h-[40px] max-h-32"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                    />
                    <Button onClick={send} disabled={!draft.trim() || sending} size="icon" className="shrink-0">
                      <Send className="size-4" />
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};
