import { useState, useEffect, useRef } from "react";
import { invokeApiFunction } from "@/integrations/supabase/client";
import { getCacheMeta, setCache, createSmartInterval } from "@/lib/localCache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Bot,
  Send,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  RefreshCw,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface SuggestedAction {
  action_type: string;
  action_label: string;
  payload: Record<string, any>;
  preview: string;
  requires_confirmation: boolean;
  confirmation_prompt?: string;
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

export function AdminAiDrawer() {
  const [open, setOpen] = useState(false);
  const [issueCount, setIssueCount] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "intro",
      sender: "stony",
      text: "Bossu! 👋 I'm Stony. Tell me what needs doing (e.g. 'update order ORD-xxx to delivered', 'send SMS to 0244...', 'put MTN 5GB in stock') and I'll stage it for your confirmation!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Poll for issue count with local caching and visibility-awareness
  useEffect(() => {
    let mounted = true;
    const checkIssues = async (force = false) => {
      if (!force) {
        const cached = getCacheMeta<{ count: number }>("admin_ai_issue_count");
        if (cached.exists && cached.data) {
          if (mounted) setIssueCount(cached.data.count);
          if (!cached.isStale) return;
        }
      }

      try {
        const res = await invokeApiFunction("admin-ai", {
          body: { action: "getAiIssuesAndProposals" },
        });
        if (mounted && res.data?.issues) {
          const count = res.data.issues.length;
          setIssueCount(count);
          setCache("admin_ai_issue_count", { count }, 3 * 60 * 1000); // 3-minute cache
        }
      } catch {}
    };

    checkIssues(false);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        chatScrollRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    }
  }, [open, messages]);

  const handleSend = async (customText?: string) => {
    const text = (customText || input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInput("");
    setLoading(true);

    try {
      const res = await invokeApiFunction("admin-ai", {
        body: {
          action: "aiCoPilotChat",
          message: text,
          history: messages.slice(-5).map((m) => ({
            role: m.sender === "user" ? "user" : "assistant",
            text: m.text,
          })),
        },
      });

      if (res.data?.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: `s-${Date.now()}`,
            sender: "stony",
            text: res.data.reply || "Done bossu!",
            staged_action: res.data.staged_action || null,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } else {
        toast.error(res.data?.error || "Error contacting Stony");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to reach AI");
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteStaged = async (msgId: string, action: SuggestedAction) => {
    setExecuting(true);
    try {
      const res = await invokeApiFunction("admin-ai", {
        body: {
          action: "executeAiAction",
          action_type: action.action_type,
          payload: action.payload,
        },
      });

      if (res.data?.ok) {
        const msg = res.data.message || "Action executed successfully!";
        toast.success(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  executed_action: true,
                  action_result: msg,
                }
              : m
          )
        );
        setIssueCount((c) => Math.max(0, c - 1));
      } else {
        toast.error(res.data?.error || "Execution failed");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to execute");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-5 right-5 z-40">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              className="rounded-full shadow-2xl bg-gradient-hero text-primary-foreground border-2 border-emerald-400/50 hover:opacity-95 px-4 py-2.5 h-auto flex items-center gap-2.5 transition-transform hover:scale-105"
            >
              <div className="size-6 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-300">
                <Bot className="size-4 animate-pulse" />
              </div>
              <span className="font-bold text-sm tracking-tight">Stony Co-Pilot</span>
              {issueCount > 0 && (
                <Badge className="bg-amber-500 text-black text-[10px] font-black h-5 px-1.5 ml-1">
                  {issueCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>

          <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col h-full bg-card">
            {/* Sheet Header */}
            <SheetHeader className="p-4 border-b bg-muted/40 text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 flex items-center justify-center font-bold">
                    <Bot className="size-4" />
                  </div>
                  <div>
                    <SheetTitle className="text-base font-bold flex items-center gap-2">
                      Stony AI Co-Pilot
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    </SheetTitle>
                    <SheetDescription className="text-xs">
                      Human-Confirmed System Actions
                    </SheetDescription>
                  </div>
                </div>

                <Button asChild variant="ghost" size="sm" className="text-xs h-7 gap-1">
                  <Link to="/admin/ai-assistant" onClick={() => setOpen(false)}>
                    Full Page <ArrowRight className="size-3" />
                  </Link>
                </Button>
              </div>
            </SheetHeader>

            {/* Quick Actions Bar */}
            <div className="px-3 py-2 border-b bg-muted/10 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
              <button
                onClick={() => handleSend("Scan all orders for stuck deliveries")}
                className="px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-[11px] whitespace-nowrap shrink-0 border"
              >
                🔍 Check Stuck Orders
              </button>
              <button
                onClick={() => handleSend("Check DataMart wallet & SMS balance")}
                className="px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-[11px] whitespace-nowrap shrink-0 border"
              >
                💳 Check Balances
              </button>
              <button
                onClick={() => handleSend("Show out-of-stock data packages")}
                className="px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-[11px] whitespace-nowrap shrink-0 border"
              >
                📦 Check Stock
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {messages.map((m) => {
                const isUser = m.sender === "user";
                return (
                  <div key={m.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[88%] rounded-2xl p-3 text-xs leading-relaxed ${
                        isUser
                          ? "bg-primary text-primary-foreground rounded-br-none"
                          : "bg-muted text-foreground border rounded-bl-none shadow-sm whitespace-pre-wrap"
                      }`}
                    >
                      {m.text}

                      {/* Action Confirmation Inside Drawer */}
                      {m.staged_action && !m.executed_action && (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-card border border-amber-500/40 text-foreground space-y-2 shadow-sm">
                          <div className="flex items-center gap-1 font-bold text-amber-500 text-[11px]">
                            <AlertTriangle className="size-3.5" />
                            Confirmation Required
                          </div>
                          <p className="text-[11px] text-muted-foreground">{m.staged_action.preview}</p>
                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              size="sm"
                              disabled={executing}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-7 flex-1"
                              onClick={() => handleExecuteStaged(m.id, m.staged_action!)}
                            >
                              {executing ? (
                                <>
                                  <Loader2 className="size-3 animate-spin mr-1" /> Executing...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="size-3 mr-1" /> Yes, Go Ahead
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={() => {
                                setMessages((prev) => [
                                  ...prev,
                                  {
                                    id: `c-${Date.now()}`,
                                    sender: "stony",
                                    text: "Cancelled bossu. No changes made.",
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

                      {m.executed_action && (
                        <div className="mt-2 p-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] flex items-center gap-1.5 font-semibold">
                          <CheckCircle2 className="size-3.5 shrink-0" />
                          <span>{m.action_result || "Action executed successfully."}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-muted-foreground mt-0.5 px-1">{m.timestamp}</span>
                  </div>
                );
              })}
              {loading && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground p-2">
                  <Loader2 className="size-3.5 animate-spin text-emerald-500" />
                  <span>Stony is thinking...</span>
                </div>
              )}
              <div ref={chatScrollRef} />
            </div>

            {/* Input Footer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="p-3 border-t bg-muted/20 flex items-center gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Stony or tell him what to do..."
                className="text-xs h-9 bg-background"
                disabled={loading}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim() || loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 h-9"
              >
                <Send className="size-3.5" />
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
