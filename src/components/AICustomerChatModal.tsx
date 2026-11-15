import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  Send,
  X,
  Loader2,
  Sparkles,
  MessageCircle,
  RotateCcw,
  Mic,
  MicOff,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { invokeApiFunction, supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  storeName?: string;
  whatsappNumber?: string;
  whatsappChannelUrl?: string;
}

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  provider?: string;
  modelUsed?: string;
  timestamp: string;
}

const STORAGE_KEY = "data1gh_customer_chat_messages";
const SESSION_KEY = "support_chat_session";
const CONV_KEY = "support_chat_conv";

const getVisitorSession = () => {
  try {
    let s = localStorage.getItem("support_chat_session") || localStorage.getItem("data1gh_chat_session");
    if (!s) {
      s = "sess_" + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      localStorage.setItem("support_chat_session", s);
      localStorage.setItem("data1gh_chat_session", s);
    }
    return s;
  } catch {
    return "sess_" + Date.now();
  }
};

const getCustomerPhone = () => {
  try {
    return (
      localStorage.getItem("support_chat_phone") ||
      localStorage.getItem("last_recipient_phone") ||
      localStorage.getItem("customer_phone") ||
      ""
    );
  } catch {
    return "";
  }
};

const getCustomerName = () => {
  try {
    return (
      localStorage.getItem("support_chat_name") ||
      localStorage.getItem("customer_name") ||
      ""
    );
  } catch {
    return "";
  }
};

export default function AICustomerChatModal({
  isOpen,
  onClose,
  storeName = "DATA 1 GH",
  whatsappNumber = "233541234567",
  whatsappChannelUrl = "",
}: Props) {
  const navigate = useNavigate();
  const defaultWelcomeText = `Hello bossu! 👋 Welcome to ${storeName}.\n\nI am your live Customer Support Specialist. How can I assist you right now? You can ask me:\n• "What are the prices for MTN 5GB or 10GB?"\n• "Track my order ORD-xxxxxxxx or 055xxxxxxx"\n• "How long does automated delivery take?"\n• "Can I buy Telecel, AT bundles, or Netflix?"`;

  const [conversationId, setConversationId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(CONV_KEY);
    } catch {
      return null;
    }
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [
      {
        id: "welcome-1",
        sender: "ai",
        text: defaultWelcomeText,
        provider: "system",
        modelUsed: `${storeName} Support`,
        timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      },
    ];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Persist messages in localStorage
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
      }
    } catch (_) {}
  }, [messages]);

  // Auto-focus and scroll to bottom
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        if (chatAreaRef.current) {
          chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
        }
      }, 60);
    }
  }, [isOpen, messages, loading]);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript || "";
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleSpeech = () => {
    if (!recognitionRef.current) {
      alert("Voice speech recognition is not supported in this browser. Please type your message.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (_) {
        setIsListening(false);
      }
    }
  };

  // Realtime subscription and sync for live human support replies
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    // Check if we need to retrieve conversation_id from session
    const loadConversationIdIfNeeded = async () => {
      if (conversationId) return;
      const session = getVisitorSession();
      try {
        const { data } = await supabase
          .from("chat_conversations")
          .select("id")
          .eq("visitor_session", session)
          .eq("status", "open")
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.id && !cancelled) {
          setConversationId(data.id);
          try {
            localStorage.setItem(CONV_KEY, data.id);
          } catch (_) {}
        }
      } catch (_) {}
    };

    void loadConversationIdIfNeeded();

    if (!conversationId) return;

    const syncAdminMessages = async () => {
      try {
        const { data, error } = await invokeApiFunction("chat", {
          body: { action: "listMessages", conversation_id: conversationId },
        });
        if (!error && Array.isArray(data?.messages) && !cancelled) {
          setMessages((prev) => {
            let updated = [...prev];
            let changed = false;
            for (const msg of data.messages) {
              if (msg.sender === "support") {
                const alreadyExists = updated.some(
                  (m) => m.id === msg.id || m.text.trim() === msg.body.trim()
                );
                if (!alreadyExists) {
                  updated.push({
                    id: msg.id,
                    sender: "ai",
                    text: msg.body,
                    provider: "Live Agent",
                    modelUsed: "Support Staff",
                    timestamp: new Date(msg.created_at || Date.now()).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    }),
                  });
                  changed = true;
                }
              }
            }
            return changed ? updated : prev;
          });
        }
      } catch (_) {}
    };

    void syncAdminMessages();
    const interval = setInterval(syncAdminMessages, 5000);

    const channel = supabase
      .channel(`modal-chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as any;
          if (m?.sender === "support") {
            setMessages((prev) => {
              if (prev.some((x) => x.id === m.id || x.text.trim() === m.body.trim())) return prev;
              return [
                ...prev,
                {
                  id: m.id,
                  sender: "ai",
                  text: m.body,
                  provider: "Live Agent",
                  modelUsed: "Support Staff",
                  timestamp: new Date(m.created_at || Date.now()).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  }),
                },
              ];
            });
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [isOpen, conversationId]);

  const handleClearChat = () => {
    const freshMessage: ChatMessage = {
      id: "welcome-" + Date.now(),
      sender: "ai",
      text: defaultWelcomeText,
      provider: "system",
      modelUsed: `${storeName} Support`,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    };
    setMessages([freshMessage]);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CONV_KEY);
      setConversationId(null);
    } catch (_) {}
  };

  const handleSendMessage = async (textToSend?: string) => {
    const userText = (textToSend || input).trim();
    if (!userText || loading) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMsg: ChatMessage = {
      id: "user-" + Date.now(),
      sender: "user",
      text: userText,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setLoading(true);

    try {
      // Exclude greeting placeholder from API history to keep context crisp
      const history = messages
        .filter((m) => !m.id.startsWith("welcome-"))
        .map((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text,
        }));

      const visitorSession = getVisitorSession();
      const phone = getCustomerPhone();
      const name = getCustomerName();

      const res = await invokeApiFunction("ai-chat", {
        body: {
          message: userText,
          history,
          session: visitorSession,
          conversation_id: conversationId || undefined,
          phone: phone || undefined,
          name: name || undefined,
        },
      });

      if (res?.error) {
        throw res.error;
      }

      const data = res?.data || {};
      const aiReplyText = data.reply || data.message;

      if (!aiReplyText) {
        throw new Error(data.error || "No reply generated");
      }

      if (data.conversation_id && data.conversation_id !== conversationId) {
        setConversationId(data.conversation_id);
        try {
          localStorage.setItem(CONV_KEY, data.conversation_id);
        } catch (_) {}
      }

      const aiReply: ChatMessage = {
        id: "ai-" + Date.now(),
        sender: "ai",
        text: aiReplyText,
        provider: data.provider || "Customer Care",
        modelUsed: data.modelUsed || "Primary AI",
        timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      };

      setMessages((prev) => [...prev, aiReply]);
    } catch (err: any) {
      console.warn("Front end chat send error:", err);
      // Warm local fallback ensuring customer never feels stranded
      const fallbackText = `I hear you bossu! 😊 You can ask about our MTN, Telecel, or AT rates right now, or drop your phone number or reference to track an order. For instant manual care, our WhatsApp line is also open!`;
      setMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          sender: "ai",
          text: fallbackText,
          timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sanitizeUrl = (url?: string) => {
    if (!url) return "";
    const trimmed = url.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    return `https://${trimmed}`;
  };

  const channelLink =
    sanitizeUrl(whatsappChannelUrl) || `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=Hi%20DATA%201%20GH`;

  const quickPrompts = [
    { label: "💰 MTN Prices", prompt: "What are the prices for MTN data bundles?" },
    { label: "⚡ Telecel Rates", prompt: "What are the rates for Telecel data bundles?" },
    { label: "🔵 AT Rates", prompt: "What are the rates for AT AirtelTigo data bundles?" },
    { label: "🔍 Track Order", prompt: "How do I track my order status?" },
    { label: "⏱️ Delivery Speed", prompt: "How fast is bundle delivery?" },
    { label: "🍿 Netflix Pass", prompt: "How much is Netflix 30 days subscription?" },
    { label: "🌾 AFA Registration", prompt: "How do I register for MTN AFA?" },
  ];

  // Helper to parse links / actions in text
  const renderMessageContent = (text: string) => {
    // If text contains internal navigation paths like /network/mtn, /services, /track
    const parts = text.split(/(\[.*?\]\(.*?\)|\/network\/[a-z]+|\/services|\/track)/gi);

    return (
      <div className="whitespace-pre-wrap leading-relaxed break-words">
        {parts.map((part, index) => {
          const markdownLinkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
          if (markdownLinkMatch) {
            const label = markdownLinkMatch[1];
            const url = markdownLinkMatch[2];
            if (url.startsWith("/")) {
              return (
                <button
                  key={index}
                  onClick={() => {
                    onClose();
                    navigate(url);
                  }}
                  className="inline-flex items-center gap-1 font-bold text-amber-300 hover:text-amber-200 underline decoration-amber-400 cursor-pointer mx-1"
                >
                  {label} <ChevronRight className="w-3 h-3 inline" />
                </button>
              );
            }
            return (
              <a
                key={index}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-emerald-400 hover:underline mx-1"
              >
                {label} <ExternalLink className="w-3 h-3 inline" />
              </a>
            );
          }

          if (part.startsWith("/network/") || part === "/services" || part === "/track") {
            const displayTitle = part.replace("/", "").toUpperCase();
            return (
              <button
                key={index}
                onClick={() => {
                  onClose();
                  navigate(part);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 my-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[11px] font-bold hover:bg-emerald-500/30 transition cursor-pointer mx-1"
              >
                Open {displayTitle} <ChevronRight className="w-3 h-3" />
              </button>
            );
          }

          return <span key={index}>{part}</span>;
        })}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0b1320] border border-slate-800 text-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg h-[92vh] sm:h-[680px] shadow-2xl flex flex-col overflow-hidden relative">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 p-4 sm:p-5 flex items-center justify-between border-b border-slate-700/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-black/40 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-inner">
                <Bot className="w-6 h-6 text-emerald-400 animate-pulse" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#0b1320] rounded-full animate-ping" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                  {storeName} Support
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-950/90 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> Live AI Active
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/90 flex items-center gap-1 font-medium">
                <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                <span>Instant human-style answers · 24/7 Realtime</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleClearChat}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Clear chat history"
              aria-label="Clear chat history"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              aria-label="Close Help Chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MESSAGES SCROLL AREA */}
        <div ref={chatAreaRef} className="flex-1 p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4 text-xs sm:text-sm font-sans">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl p-3.5 sm:p-4 leading-relaxed shadow-md ${
                  m.sender === "user"
                    ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-semibold rounded-br-none"
                    : "bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-none"
                }`}
              >
                {renderMessageContent(m.text)}
              </div>

              <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-500 font-mono">
                <span>{m.timestamp}</span>
                {m.sender === "ai" && m.provider && (
                  <span className="text-emerald-400/80 font-bold uppercase">
                    • {m.provider}
                  </span>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-slate-300 text-xs py-2.5 px-3.5 bg-slate-900/80 rounded-2xl w-fit border border-emerald-500/30 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              <span>{storeName} Support is typing...</span>
            </div>
          )}
        </div>

        {/* QUICK SUGGESTIONS CAROUSEL */}
        <div className="px-3 py-2 bg-slate-950/90 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          {quickPrompts.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(q.prompt)}
              disabled={loading}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-medium text-slate-300 hover:text-white whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* INPUT BOX & ACTIONS */}
        <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 shrink-0 space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={toggleSpeech}
              className={`p-3 rounded-2xl border transition-colors shrink-0 cursor-pointer ${
                isListening
                  ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse"
                  : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title={isListening ? "Listening... Tap to stop" : "Tap to speak hands-free"}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              placeholder={isListening ? "Listening... Speak now!" : "Ask anything (e.g. MTN prices, track order)..."}
              className="flex-1 bg-slate-900 border border-slate-700/80 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all disabled:opacity-40 flex items-center justify-center shrink-0 cursor-pointer"
              aria-label="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Bottom WhatsApp Channel Direct Link */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span className="truncate">Need manual WhatsApp agent?</span>
            <a
              href={channelLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-bold ml-2 underline shrink-0"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp Direct ↗</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
