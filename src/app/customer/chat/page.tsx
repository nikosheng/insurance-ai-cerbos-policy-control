"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "ai/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import {
  MessageCircle,
  LogOut,
  Send,
  Bot,
  User,
  Loader2,
  XCircle,
  PhoneOff,
  CheckCircle2,
  Shield,
} from "lucide-react";
import type { CustomerSession, EndSessionResponse } from "@/types";

// ─── Markdown renderer (consumer-friendly) ────────────────────────────────────
const mdComponents: Components = {
  p: ({ children }) => (
    <p className="text-slate-200 text-sm leading-relaxed mb-2 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => <strong className="text-slate-100 font-semibold">{children}</strong>,
  em: ({ children }) => <em className="text-slate-300 italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc list-outside ml-4 space-y-0.5 mb-2 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside ml-4 space-y-0.5 mb-2 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="text-slate-300 text-sm leading-relaxed pl-0.5">{children}</li>,
  code: ({ className, children, ...props }) =>
    className ? (
      <code className="block text-xs font-mono text-slate-300 leading-relaxed" {...props}>{children}</code>
    ) : (
      <code className="bg-slate-700 text-sky-300 px-1.5 py-0.5 rounded font-mono text-xs" {...props}>{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="bg-slate-900 border border-slate-700 rounded-lg p-3 overflow-x-auto my-2 text-xs font-mono">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-slate-700">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-800">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-slate-800">{children}</tbody>,
  tr: ({ children }) => <tr className="even:bg-slate-900/40 hover:bg-slate-800/50 transition-colors">{children}</tr>,
  th: ({ children }) => <th className="px-3 py-2 text-left text-slate-300 font-semibold border-b border-slate-700 whitespace-nowrap">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{children}</td>,
  hr: () => <hr className="border-slate-700 my-3" />,
};

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {content}
    </ReactMarkdown>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingIndicator({ agentName }: { agentName: string }) {
  const initials = agentName.split(" ").map((n) => n[0]).join("").slice(0, 2);
  return (
    <div className="flex items-start gap-3 py-1">
      <div className="w-8 h-8 rounded-full bg-sky-600/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0 text-xs font-bold text-sky-300">
        {initials}
      </div>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full typing-dot" />
        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full typing-dot" />
        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full typing-dot" />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CustomerChatPage() {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [inputValue, setInputValue] = useState("");

  // End session state
  const [endSessionLoading, setEndSessionLoading] = useState(false);
  const [endSessionResult, setEndSessionResult] = useState<EndSessionResponse | null>(null);
  const sessionStartedAt = useRef(new Date().toISOString());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Load customer session ───────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/customer-session")
      .then((r) => r.json())
      .then(({ session: s }: { session: CustomerSession | null }) => {
        if (!s) { router.replace("/customer"); return; }
        setSession(s);
      })
      .catch(() => router.replace("/customer"))
      .finally(() => setSessionLoading(false));
  }, [router]);

  // ── useChat ─────────────────────────────────────────────────────────────
  const { messages, isLoading, append, stop, setMessages } = useChat({
    api: "/api/customer-chat",
    onError: (err) => console.error("[CustomerChat]", err),
  });

  // ── Auto-scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Auto-resize textarea ────────────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [inputValue]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed || isLoading) return;
      setInputValue("");
      await append({ role: "user", content: trimmed });
    },
    [inputValue, isLoading, append]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ── End Session ─────────────────────────────────────────────────────────
  const handleEndSession = useCallback(async () => {
    if (!session || endSessionLoading || messages.length === 0) return;
    setEndSessionLoading(true);

    const transcript = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => `${m.role === "user" ? session.clientName : session.agentName}: ${m.content}`)
      .join("\n\n");

    try {
      const res = await fetch("/api/chat-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          customerName: session.clientName,
          startedAt: sessionStartedAt.current,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? `HTTP ${res.status}`);
      }
      const data: EndSessionResponse = await res.json();
      setEndSessionResult(data);
      // Reset for a fresh session
      setMessages([]);
      sessionStartedAt.current = new Date().toISOString();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Failed to save session: ${msg}`);
    } finally {
      setEndSessionLoading(false);
    }
  }, [session, endSessionLoading, messages, setMessages]);

  const handleLogout = async () => {
    await fetch("/api/customer-session", { method: "DELETE" });
    router.push("/customer");
  };

  // ── Guards ──────────────────────────────────────────────────────────────
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-mono">Connecting...</span>
        </div>
      </div>
    );
  }
  if (!session) return null;

  const agentInitials = session.agentName.split(" ").map((n) => n[0]).join("").slice(0, 2);
  const customerInitials = session.clientName.split(" ").map((n) => n[0]).join("").slice(0, 2);
  const firstName = session.clientName.split(" ")[0];

  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm px-4 py-3 z-10">
        <div className="flex items-center justify-between gap-4">
          {/* Left: brand + agent identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="w-px h-5 bg-slate-800 flex-shrink-0" />
            {/* Agent avatar + name */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-xs font-bold text-sky-300">
                {agentInitials}
              </div>
              <div className="min-w-0">
                <p className="text-slate-200 text-xs font-semibold truncate">{session.agentName}</p>
                <p className="text-slate-500 text-xs truncate">Your insurance agent</p>
              </div>
              <div className="flex-shrink-0 flex items-center gap-1 text-xs text-emerald-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse" />
                <span className="font-mono hidden sm:block">Online</span>
              </div>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {messages.length > 0 && !endSessionResult && (
              <button
                onClick={handleEndSession}
                disabled={endSessionLoading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-amber-600/40 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500 transition-all disabled:opacity-50"
                title="End this chat session"
              >
                {endSessionLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <PhoneOff className="w-3 h-3" />
                )}
                <span className="hidden sm:block">
                  {endSessionLoading ? "Saving..." : "End Chat"}
                </span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-slate-200 hover:border-slate-600 hover:bg-slate-800/50 transition-all"
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden sm:block">Leave</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Session saved result banner ───────────────────────────────────── */}
      {endSessionResult && (
        <div className="flex-shrink-0 bg-emerald-500/5 border-b border-emerald-500/20 px-4 py-3">
          <div className="flex items-start gap-3 max-w-2xl mx-auto">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-slate-200 text-xs font-semibold mb-1">
                Chat saved — your agent will follow up shortly
              </p>
              <p className="text-slate-400 text-xs leading-relaxed mb-2">
                {endSessionResult.summary}
              </p>
              {endSessionResult.follow_up_actions.length > 0 && (
                <div>
                  <p className="text-slate-500 text-xs font-mono uppercase tracking-wider mb-1">
                    Your agent will:
                  </p>
                  <ul className="space-y-0.5">
                    {endSessionResult.follow_up_actions.map((action, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-amber-300">
                        <span className="text-amber-500 flex-shrink-0 mt-px">›</span>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                onClick={() => setEndSessionResult(null)}
                className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Start a new conversation →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Messages ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Empty state */}
          {messages.length === 0 && !endSessionResult && (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-sky-600/10 border border-sky-500/20 flex items-center justify-center mb-5">
                <Bot className="w-8 h-8 text-sky-400" />
              </div>
              <h3 className="text-slate-200 font-semibold text-base mb-1">
                Hi {firstName}! I&apos;m {session.agentName}.
              </h3>
              <p className="text-slate-500 text-sm max-w-xs leading-relaxed mb-7">
                I&apos;m your insurance agent at SecureInsure Corp. How can I help you today?
              </p>
              {/* Suggestion chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm">
                {[
                  "What insurance policies do I have?",
                  "What is my deductible?",
                  "When does my policy expire?",
                  "How much is my monthly premium?",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setInputValue(s)}
                    className="text-xs text-left px-3 py-2.5 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:border-slate-600 hover:bg-slate-800 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((message, i) => {
            const isUser = message.role === "user";
            const isAssistant = message.role === "assistant";

            // Skip tool messages from display
            if (!isUser && !isAssistant) return null;

            // Show a "looking up your policies..." indicator for tool invocations
            const hasActiveTool = isAssistant &&
              (message.toolInvocations ?? []).some((t) => t.state === "call");

            return (
              <div key={message.id ?? i} className="message-in">
                {isUser && (
                  <div className="flex items-start gap-3 justify-end">
                    <div className="bg-sky-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm max-w-[80%] leading-relaxed">
                      {message.content}
                    </div>
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400">
                      {customerInitials}
                    </div>
                  </div>
                )}

                {isAssistant && (
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-xs font-bold text-sky-300">
                      {agentInitials}
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Tool-in-progress indicator */}
                      {hasActiveTool && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                          <Loader2 className="w-3 h-3 animate-spin text-sky-500" />
                          Looking up your policy information...
                        </div>
                      )}
                      {/* Assistant text */}
                      {message.content && (
                        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                          <MarkdownContent content={message.content} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing indicator */}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <TypingIndicator agentName={session.agentName} />
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input bar ────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-slate-800 bg-slate-950/80 backdrop-blur-sm px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${session.agentName}… (Enter to send)`}
                rows={1}
                disabled={isLoading || endSessionLoading}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/25 transition-all disabled:opacity-50 min-h-[46px] max-h-[120px] leading-relaxed"
              />
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {isLoading && (
                <button
                  type="button"
                  onClick={stop}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 text-xs transition-all"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading || endSessionLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </form>

          {/* Footer: identity badge */}
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="flex items-center gap-1.5 text-slate-700 text-xs">
              <User className="w-3 h-3" />
              <span>Logged in as <span className="text-slate-500">{session.clientName}</span></span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700 text-xs">
              <Shield className="w-3 h-3" />
              <span className="font-mono">Cerbos secured</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
