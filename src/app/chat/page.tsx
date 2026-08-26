"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "ai/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import {
  Shield,
  LogOut,
  Send,
  User,
  Bot,
  ChevronDown,
  Database,
  Lock,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  Terminal,
  Search,
  Clock,
  ListChecks,
  MessageSquare,
} from "lucide-react";
import { AGENT_REGISTRY, TEST_SCENARIOS } from "@/lib/agents";
import type { AgentId } from "@/lib/agents";
import type { AgentSession, SecurityContext, InsurancePolicy, McpToolResult, ChatDataAnnotation, SessionSearchResult } from "@/types";
import type { SessionSearchToolResult } from "@/app/api/chat/route";

// Tools that carry SecurityContext telemetry
const DATA_TOOL_NAMES = new Set(["find", "aggregate", "count"]);
// search_sessions tool name constant
const SEARCH_SESSIONS_TOOL = "search_sessions";

// ─── JSON Syntax Highlighter ──────────────────────────────────────────────────
function JsonHighlight({ data }: { data: unknown }) {
  const json = JSON.stringify(data, null, 2);
  const highlighted = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = "json-number";
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "json-key" : "json-string";
      } else if (/true|false/.test(match)) {
        cls = "json-boolean";
      } else if (/null/.test(match)) {
        cls = "json-null";
      }
      return `<span class="${cls}">${match}</span>`;
    });
  return (
    <pre
      className="text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-all"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}

// ─── Copy Button ─────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-zinc-600 hover:text-zinc-300 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ─── Collapsible Panel Section ────────────────────────────────────────────────
function PanelSection({
  title,
  icon: Icon,
  defaultOpen = true,
  badge,
  children,
  accentColor = "zinc",
}: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  badge?: string;
  children: React.ReactNode;
  accentColor?: "indigo" | "violet" | "emerald" | "amber" | "zinc";
}) {
  const [open, setOpen] = useState(defaultOpen);
  const accentMap = {
    indigo: "text-indigo-400",
    violet: "text-violet-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    zinc: "text-zinc-400",
  };
  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900 hover:bg-zinc-800/70 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${accentMap[accentColor]}`} />
          <span className="text-zinc-200 text-xs font-semibold tracking-wide uppercase">{title}</span>
          {badge && (
            <span className="bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs px-1.5 py-0.5 rounded font-mono">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-600 transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div className="bg-zinc-950 px-4 py-4">{children}</div>}
    </div>
  );
}

// ─── Policy Card ──────────────────────────────────────────────────────────────
function PolicyCard({ policy }: { policy: InsurancePolicy }) {
  const typeColors: Record<string, string> = {
    Auto: "text-sky-300 bg-sky-500/10 border-sky-500/25",
    Home: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
    Life: "text-violet-300 bg-violet-500/10 border-violet-500/25",
  };
  const statusColors: Record<string, string> = {
    Active: "text-emerald-400",
    Pending: "text-amber-400",
    Cancelled: "text-red-400",
    Expired: "text-zinc-500",
  };
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-zinc-200 font-semibold">{policy.client_name}</p>
          <p className="text-zinc-500 font-mono">{policy.policy_number}</p>
        </div>
        <div className="flex gap-1 flex-wrap justify-end">
          <span className={`px-1.5 py-0.5 rounded border text-xs font-medium ${typeColors[policy.policy_type]}`}>
            {policy.policy_type}
          </span>
          <span className={`font-medium ${statusColors[policy.status]}`}>
            ● {policy.status}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-zinc-600">Coverage</p>
          <p className="text-zinc-300 font-mono font-medium">
            ${policy.coverage_amount.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-zinc-600">Premium/mo</p>
          <p className="text-zinc-300 font-mono font-medium">${policy.premium_monthly}</p>
        </div>
        <div>
          <p className="text-zinc-600">Deductible</p>
          <p className="text-zinc-300 font-mono font-medium">${policy.deductible}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Session Result Card ──────────────────────────────────────────────────────
// Rendered inline in the chat when the search_sessions tool returns results.
function SessionResultCard({ result }: { result: SessionSearchResult }) {
  const scorePct = typeof result.score === "number" ? (result.score * 100).toFixed(1) : null;
  return (
    <div className="bg-zinc-900 border border-amber-500/20 rounded-lg p-3 text-xs space-y-2">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <MessageSquare className="w-3 h-3 text-amber-400 flex-shrink-0" />
            <p className="text-zinc-200 font-semibold truncate">{result.customer_name}</p>
          </div>
          {result.customer_policy_number && (
            <p className="text-zinc-600 font-mono text-[10px]">{result.customer_policy_number}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {scorePct && (
            <span className="bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[10px] px-1.5 py-0.5 rounded font-mono">
              {scorePct}%
            </span>
          )}
        </div>
      </div>

      {/* Date */}
      <div className="flex items-center gap-1 text-zinc-600 text-[10px] font-mono">
        <Clock className="w-2.5 h-2.5 flex-shrink-0" />
        {new Date(result.ended_at).toLocaleDateString(undefined, {
          month: "short", day: "numeric", year: "numeric",
        })}
      </div>

      {/* Summary */}
      <p className="text-zinc-400 leading-relaxed line-clamp-3">{result.summary}</p>

      {/* Follow-up actions */}
      {result.follow_up_actions?.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-zinc-600 text-[10px] font-mono uppercase tracking-wider mb-1">
            <ListChecks className="w-2.5 h-2.5" />
            Follow-up actions
          </div>
          <ul className="space-y-0.5">
            {result.follow_up_actions.map((action, i) => (
              <li key={i} className="flex items-start gap-1.5 text-amber-400">
                <span className="text-amber-600 flex-shrink-0 mt-px">›</span>
                {action}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Typing Indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
        <Bot className="w-3.5 h-3.5 text-indigo-400" />
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 flex items-center gap-1">
        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full typing-dot" />
        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full typing-dot" />
        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full typing-dot" />
      </div>
    </div>
  );
}

// ─── Markdown Renderer ────────────────────────────────────────────────────────
// Renders LLM markdown output with full GFM support (tables, bold, lists, code).
// Every element is styled with Tailwind to match the dark enterprise theme.

const markdownComponents: Components = {
  // ── Headings ──────────────────────────────────────────────────────────────
  h1: ({ children }) => (
    <h1 className="text-base font-bold text-zinc-100 mt-3 mb-1.5 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-bold text-zinc-100 mt-3 mb-1.5 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-zinc-200 mt-2 mb-1 first:mt-0">{children}</h3>
  ),

  // ── Paragraph ─────────────────────────────────────────────────────────────
  p: ({ children }) => (
    <p className="text-zinc-200 text-sm leading-relaxed mb-2 last:mb-0">{children}</p>
  ),

  // ── Emphasis ──────────────────────────────────────────────────────────────
  strong: ({ children }) => (
    <strong className="text-zinc-100 font-semibold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-zinc-300 italic">{children}</em>
  ),

  // ── Lists ─────────────────────────────────────────────────────────────────
  ul: ({ children }) => (
    <ul className="list-disc list-outside ml-4 space-y-0.5 mb-2 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside ml-4 space-y-0.5 mb-2 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-zinc-300 text-sm leading-relaxed pl-0.5">{children}</li>
  ),

  // ── Code ──────────────────────────────────────────────────────────────────
  // Inline code
  code: ({ className, children, ...props }) => {
    const isBlock = !!className; // block code gets a language class like "language-js"
    if (isBlock) {
      return (
        <code className="block text-xs font-mono text-zinc-300 leading-relaxed" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="bg-zinc-800 text-indigo-300 px-1.5 py-0.5 rounded font-mono text-xs"
        {...props}
      >
        {children}
      </code>
    );
  },
  // Code block wrapper
  pre: ({ children }) => (
    <pre className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 overflow-x-auto my-2 text-xs font-mono">
      {children}
    </pre>
  ),

  // ── Table (GFM) ───────────────────────────────────────────────────────────
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-zinc-700">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-zinc-800">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-zinc-800">{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr className="even:bg-zinc-900/40 hover:bg-zinc-800/50 transition-colors">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-zinc-300 font-semibold border-b border-zinc-700 whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-zinc-300 border-zinc-800 whitespace-nowrap">
      {children}
    </td>
  ),

  // ── Horizontal rule ───────────────────────────────────────────────────────
  hr: () => <hr className="border-zinc-700 my-3" />,

  // ── Blockquote ────────────────────────────────────────────────────────────
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-indigo-500 pl-3 my-2 text-zinc-400 italic">
      {children}
    </blockquote>
  ),

  // ── Links ─────────────────────────────────────────────────────────────────
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300 transition-colors"
    >
      {children}
    </a>
  ),
};

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}

// ─── Main Chat Page ───────────────────────────────────────────────────────────
export default function ChatPage() {
  const router = useRouter();
  const [session, setSession] = useState<AgentSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [input, setInput] = useState("");
  const [securityCtx, setSecurityCtx] = useState<SecurityContext | null>(null);
  const [showTestPanel, setShowTestPanel] = useState(false);

  // ── Session Search panel state ──────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SessionSearchResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Tracks the index of the last streamData annotation we already processed.
  // Prevents the security-context effect from re-firing on every render when
  // streamData is a new array reference but contains no new entries.
  const lastProcessedDataIndexRef = useRef<number>(-1);

  // ── Load session on mount ───────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then(({ session: s }: { session: AgentSession | null }) => {
        if (!s) {
          router.replace("/");
          return;
        }
        setSession(s);
      })
      .catch(() => router.replace("/"))
      .finally(() => setSessionLoading(false));
  }, [router]);

  // ── useChat (AI SDK v3) ─────────────────────────────────────────────────
  const {
    messages,
    isLoading,
    data: streamData,
    append,
    reload,
    stop,
    setMessages,
  } = useChat({
    api: "/api/chat",
    onError: (err) => {
      console.error("[Chat] Stream error:", err);
    },
  });

  // ── Extract security context from stream data annotations ───────────────
  // Guard: only process entries we haven't seen yet (tracked by index ref).
  // Without this guard, every re-render creates a new `streamData` array
  // reference, the effect fires, setSecurityCtx triggers another render,
  // which creates a new reference → infinite loop.
  useEffect(() => {
    if (!streamData || streamData.length === 0) return;
    const newEntries = streamData.slice(lastProcessedDataIndexRef.current + 1);
    if (newEntries.length === 0) return;
    lastProcessedDataIndexRef.current = streamData.length - 1;

    for (const entry of newEntries) {
      const annotation = entry as unknown as ChatDataAnnotation;
      if (annotation?.type === "security_context" && annotation?.payload) {
        setSecurityCtx(annotation.payload);
      }
    }
  }, [streamData]);

  // ── Auto-scroll to bottom ───────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Auto-resize textarea ────────────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  // ── Session Search handler ──────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || searchLoading) return;
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults(null);
    try {
      const res = await fetch("/api/chat-session/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery.trim(), limit: 5 }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? `HTTP ${res.status}`);
      }
      const { results } = await res.json();
      setSearchResults(results as SessionSearchResult[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSearchError(msg);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, searchLoading]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isLoading) return;
      setInput("");
      await append({ role: "user", content: trimmed });
    },
    [input, isLoading, append]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTestScenario = async (prompt: string, agentId: string) => {
    if (!session) return;
    if (agentId !== session.id) {
      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      const res = await fetch("/api/session");
      const { session: s } = await res.json();
      setSession(s);
      setMessages([]);
      setSecurityCtx(null);
      lastProcessedDataIndexRef.current = -1;
    }
    setInput(prompt);
    setShowTestPanel(false);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleLogout = async () => {
    await fetch("/api/session", { method: "DELETE" });
    router.push("/");
  };

  // ── Render guards ───────────────────────────────────────────────────────
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-mono">Authenticating...</span>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const agentInfo = AGENT_REGISTRY[session.id as AgentId];
  const agentColor = agentInfo?.tenantColor ?? "indigo";
  const isIndigo = agentColor === "indigo";
  const tenantAgentScenarios = TEST_SCENARIOS.filter((tc) => tc.agentId === session.id);
  const otherScenarios = TEST_SCENARIOS.filter((tc) => tc.agentId !== session.id);

  // Colour helpers scoped to current agent
  const avatarCls =
    agentColor === "emerald"
      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
      : isIndigo
        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
        : "bg-violet-500/20 text-violet-300 border border-violet-500/30";
  const tenantBadgeCls =
    agentColor === "emerald"
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
      : isIndigo
        ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/25"
        : "bg-violet-500/10 text-violet-300 border-violet-500/25";

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-sm px-4 py-3 z-10">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Brand + identity */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-zinc-200 font-semibold text-sm hidden sm:block">InsureAI</span>
            </div>
            <div className="w-px h-5 bg-zinc-800 flex-shrink-0" />
            {/* Active session badge */}
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  avatarCls
                }`}
              >
                {agentInfo?.initials ?? session.id.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-zinc-200 text-xs font-semibold truncate">{session.name}</p>
                <p className="text-zinc-500 text-xs font-mono truncate">{session.id} · {session.tenantId}</p>
              </div>
              <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium border ${tenantBadgeCls}`}>
                {session.tenantId}
              </span>
            </div>
          </div>

          {/* Right: Status + actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse" />
              <span className="font-mono">ABAC Active</span>
            </div>
            <button
              onClick={() => setShowTestPanel(!showTestPanel)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 transition-colors"
            >
              <Terminal className="w-3 h-3" />
              <span className="hidden sm:block">Test Cases</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800/50 transition-all"
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Test scenarios dropdown ─────────────────────────────────────────── */}
      {showTestPanel && (
        <div className="flex-shrink-0 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
          <div className="px-4 py-3 max-h-64 overflow-y-auto">
            <p className="text-zinc-500 text-xs font-mono uppercase tracking-wider mb-2">
              Quick-fire test prompts — click to load into input
            </p>
            <div className="space-y-1">
              {tenantAgentScenarios.length > 0 && (
                <>
                  <p className="text-zinc-600 text-xs mt-2 mb-1 font-mono">Your agent ({session.id})</p>
                  {tenantAgentScenarios.map((tc) => (
                    <button
                      key={tc.id}
                      onClick={() => handleTestScenario(tc.prompt, tc.agentId)}
                      className="w-full text-left flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-zinc-600 text-xs font-mono flex-shrink-0">{tc.id.toUpperCase()}</span>
                        <span className="text-zinc-300 text-xs truncate">&ldquo;{tc.prompt}&rdquo;</span>
                      </div>
                      <span className={`flex-shrink-0 text-xs font-mono ${tc.expectedCount === 0 ? "text-zinc-600" : "text-emerald-500"}`}>
                        {tc.expectedCount === 0 ? "∅" : `+${tc.expectedCount}`}
                      </span>
                    </button>
                  ))}
                </>
              )}
              {otherScenarios.length > 0 && (
                <>
                  <p className="text-zinc-600 text-xs mt-3 mb-1 font-mono">Other agents (will switch session)</p>
                  {otherScenarios.map((tc) => {
                    const ag = AGENT_REGISTRY[tc.agentId as AgentId];
                    return (
                      <button
                        key={tc.id}
                        onClick={() => handleTestScenario(tc.prompt, tc.agentId)}
                        className="w-full text-left flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-zinc-600 text-xs font-mono flex-shrink-0">{tc.id.toUpperCase()}</span>
                          <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded border font-medium ${
                            ag.tenantColor === "indigo"   ? "border-indigo-500/25 text-indigo-400"
                            : ag.tenantColor === "violet"  ? "border-violet-500/25 text-violet-400"
                            :                               "border-emerald-500/25 text-emerald-400"
                          }`}>
                            {tc.agentId}
                          </span>
                          <span className="text-zinc-300 text-xs truncate">&ldquo;{tc.prompt}&rdquo;</span>
                        </div>
                        <span className={`flex-shrink-0 text-xs font-mono ${tc.expectedCount === 0 ? "text-zinc-600" : "text-emerald-500"}`}>
                          {tc.expectedCount === 0 ? "∅" : `+${tc.expectedCount}`}
                        </span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Main content: chat + analytics side panel ───────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left: Chat panel ───────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-4">
                  <Bot className="w-7 h-7 text-indigo-400" />
                </div>
                <h3 className="text-zinc-200 font-semibold text-base mb-2">Ready to assist</h3>
                <p className="text-zinc-500 text-sm max-w-sm leading-relaxed">
                  Ask me about your insurance policies, client coverage, or premium details.
                  All data is filtered by your verified session identity.
                </p>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm">
                  {[
                    { text: "Show me all my clients' policies", type: "policy" },
                    { text: "Which policies expire before 2027?", type: "policy" },
                    { text: "Any past sessions about claim disputes?", type: "search" },
                    { text: "Show me pending follow-up actions from past chats", type: "search" },
                  ].map(({ text, type }) => (
                    <button
                      key={text}
                      onClick={() => setInput(text)}
                      className={`text-xs text-left px-3 py-2.5 rounded-xl border bg-zinc-900 transition-all ${
                        type === "search"
                          ? "border-amber-800/40 text-amber-600/80 hover:text-amber-400 hover:border-amber-600/50 hover:bg-zinc-800"
                          : "border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800"
                      }`}
                    >
                      {type === "search" && <MessageSquare className="w-3 h-3 inline mr-1 opacity-60" />}
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, i) => {
              const isUser = message.role === "user";
              const isAssistant = message.role === "assistant";

              // Tool call states embedded in the message
              const toolCallParts = (message.toolInvocations ?? []);

              return (
                <div key={message.id ?? i} className="message-in">
                  {isUser && (
                    <div className="flex items-start gap-3 justify-end">
                      <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm max-w-[80%] leading-relaxed">
                        {message.content}
                      </div>
                      <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-zinc-400" />
                      </div>
                    </div>
                  )}

                  {isAssistant && (
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                        <Bot className="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-3">
                        {/* Tool invocation indicators */}
                        {toolCallParts.length > 0 && toolCallParts.map((tc, ti) => {
                          const isDataTool = DATA_TOOL_NAMES.has(tc.toolName);
                          const isSearchTool = tc.toolName === SEARCH_SESSIONS_TOOL;

                          // Pretty-print the key arg for each tool type
                          const argPreview = (() => {
                            const a = tc.args as Record<string, unknown> | undefined;
                            if (!a) return "";
                            if (tc.toolName === "find" && a.filter_json)
                              return `filter: ${String(a.filter_json).slice(0, 80)}`;
                            if (tc.toolName === "aggregate" && a.pipeline_json) {
                              try {
                                const p = JSON.parse(String(a.pipeline_json));
                                return `pipeline[${Array.isArray(p) ? p.length : "?"} stages]`;
                              } catch { return `pipeline: ${String(a.pipeline_json).slice(0, 60)}`; }
                            }
                            if (tc.toolName === "count" && a.query_json)
                              return `query: ${String(a.query_json).slice(0, 80)}`;
                            if (tc.toolName === SEARCH_SESSIONS_TOOL && a.query)
                              return `"${String(a.query).slice(0, 80)}"`;
                            return JSON.stringify(a).slice(0, 80);
                          })();

                          const borderCls = isDataTool
                            ? "border-indigo-500/20"
                            : isSearchTool
                              ? "border-amber-500/20"
                              : "border-zinc-800";

                          return (
                            <div key={ti} className={`flex items-start gap-2 bg-zinc-900/60 border rounded-xl px-3 py-2.5 ${borderCls}`}>
                              {tc.state === "call" ? (
                                <>
                                  <Loader2 className={`w-3.5 h-3.5 animate-spin flex-shrink-0 mt-0.5 ${isSearchTool ? "text-amber-400" : "text-indigo-400"}`} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-zinc-300 text-xs font-mono">
                                      <span className={isSearchTool ? "text-amber-300" : "text-indigo-300"}>{tc.toolName}</span>
                                      {argPreview && (
                                        <span className="text-zinc-500"> ({argPreview})</span>
                                      )}
                                    </p>
                                    <p className="text-zinc-600 text-xs mt-0.5">
                                      {isDataTool
                                        ? "Injecting Cerbos filter → Querying MongoDB..."
                                        : isSearchTool
                                          ? "Embedding query → $vectorSearch on chat_sessions..."
                                          : "Fetching schema info..."}
                                    </p>
                                  </div>
                                </>
                              ) : tc.state === "result" ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    {isSearchTool ? (() => {
                                      const res = tc.result as SessionSearchToolResult | undefined;
                                      const results = res?.results ?? [];
                                      return (
                                        <>
                                          <p className="text-zinc-300 text-xs font-mono mb-2">
                                            <span className="text-amber-300">search_sessions</span>
                                            {" → "}
                                            <span className="text-emerald-400">
                                              {results.length} session{results.length !== 1 ? "s" : ""} found
                                            </span>
                                          </p>
                                          {/* Session result cards inline in chat */}
                                          {results.length > 0 && (
                                            <div className="space-y-1.5">
                                              {results.map((r, ri) => (
                                                <SessionResultCard key={ri} result={r} />
                                              ))}
                                            </div>
                                          )}
                                        </>
                                      );
                                    })() : isDataTool ? (() => {
                                      const res = tc.result as McpToolResult | undefined;
                                      const count = res?.total_count ?? 0;
                                      const docs = res?.documents ?? [];
                                      return (
                                        <>
                                          <p className="text-zinc-300 text-xs font-mono">
                                            <span className="text-indigo-300">{tc.toolName}</span>
                                            {" → "}
                                            <span className="text-emerald-400">{count} document{count !== 1 ? "s" : ""}</span>
                                          </p>
                                          {/* Policy mini-cards — only for find */}
                                          {tc.toolName === "find" && docs.length > 0 && (
                                            <div className="mt-2 space-y-1.5">
                                              {docs.slice(0, 5).map((p, pi) => (
                                                <PolicyCard key={pi} policy={p} />
                                              ))}
                                              {docs.length > 5 && (
                                                <p className="text-zinc-600 text-xs font-mono pl-1">
                                                  +{docs.length - 5} more — see full response below
                                                </p>
                                              )}
                                            </div>
                                          )}
                                          {/* Count/aggregate result summary */}
                                          {(tc.toolName === "count" || tc.toolName === "aggregate") && (
                                            <p className="text-zinc-500 text-xs mt-0.5">{res?.message}</p>
                                          )}
                                        </>
                                      );
                                    })() : (
                                      <p className="text-zinc-300 text-xs font-mono">
                                        <span className="text-indigo-300">{tc.toolName}</span>
                                        {" → "}
                                        <span className="text-zinc-400">schema retrieved</span>
                                      </p>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                                  <p className="text-zinc-400 text-xs font-mono">
                                    <span className={isSearchTool ? "text-amber-300" : "text-indigo-300"}>{tc.toolName}</span> — failed
                                  </p>
                                </>
                              )}
                            </div>
                          );
                        })}

                        {/* Assistant text — rendered as formatted markdown */}
                        {message.content && (
                          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                            <MarkdownContent content={message.content} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <TypingIndicator />
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="flex-shrink-0 border-t border-zinc-900 bg-zinc-950/80 backdrop-blur-sm px-4 py-3">
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your clients' policies… (Enter to send, Shift+Enter for newline)"
                  rows={1}
                  disabled={isLoading}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/25 transition-all disabled:opacity-50 min-h-[46px] max-h-[120px] leading-relaxed"
                />
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {isLoading && (
                  <button
                    type="button"
                    onClick={stop}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 text-xs transition-all"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
                {messages.length > 0 && !isLoading && (
                  <button
                    type="button"
                    onClick={() => reload()}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 text-xs transition-all"
                    title="Regenerate last response"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ── Right: Security Analytics Panel ───────────────────────────── */}
        <div className="w-80 xl:w-96 flex-shrink-0 border-l border-zinc-900 bg-zinc-950 flex flex-col overflow-hidden hidden lg:flex">
          <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-zinc-300 text-xs font-semibold tracking-wide uppercase">Security Analytics</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full status-pulse ${securityCtx ? "bg-emerald-400" : "bg-zinc-600"}`} />
              <span className="text-zinc-600 text-xs font-mono">{securityCtx ? "live" : "waiting"}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {/* ── 1. Identity Claim Context ──────────────────────────────── */}
            <PanelSection
              title="Identity Claim Context"
              icon={User}
              accentColor="indigo"
              defaultOpen={true}
            >
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2">
                    <p className="text-zinc-600 mb-0.5">Principal ID</p>
                    <p className="text-zinc-200 font-mono font-medium">{session.id}</p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2">
                    <p className="text-zinc-600 mb-0.5">Tenant</p>
                    <p className={`font-mono font-medium ${
                      agentColor === "emerald" ? "text-emerald-300"
                      : isIndigo ? "text-indigo-300"
                      : "text-violet-300"
                    }`}>
                      {session.tenantId}
                    </p>
                  </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs">
                  <p className="text-zinc-600 mb-1">Display Name</p>
                  <p className="text-zinc-200">{session.name}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs">
                  <p className="text-zinc-600 mb-1.5">Roles</p>
                  <div className="flex flex-wrap gap-1">
                    {session.roles.map((role) => (
                      <span
                        key={role}
                        className="inline-flex items-center gap-1 bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs px-2 py-0.5 rounded font-mono"
                      >
                        <Lock className="w-2.5 h-2.5 text-zinc-500" />
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs">
                  <p className="text-zinc-600 mb-1">Cookie Transport</p>
                  <p className="text-zinc-400 font-mono text-xs leading-relaxed">
                    httpOnly · SameSite=Strict
                    <br />
                    <span className="text-zinc-600">LLM visibility: </span>
                    <span className="text-red-400 font-medium">none</span>
                  </p>
                </div>
              </div>
            </PanelSection>

            {/* ── 2. Cerbos Query Plan AST ──────────────────────────────── */}
            <PanelSection
              title="Cerbos Query Plan AST"
              icon={Cpu}
              accentColor="violet"
              defaultOpen={true}
              badge={securityCtx?.cerbosPlanKind?.replace("KIND_", "") ?? "—"}
            >
              {!securityCtx ? (
                <div className="text-center py-4">
                  <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-2">
                    <Cpu className="w-4 h-4 text-zinc-600" />
                  </div>
                  <p className="text-zinc-600 text-xs">No tool call yet.</p>
                  <p className="text-zinc-700 text-xs mt-0.5">Ask the AI to retrieve policies.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium border ${
                        securityCtx.cerbosPlanKind === "KIND_CONDITIONAL"
                          ? "bg-amber-500/10 text-amber-300 border-amber-500/25"
                          : securityCtx.cerbosPlanKind === "KIND_ALWAYS_DENIED"
                          ? "bg-red-500/10 text-red-300 border-red-500/25"
                          : "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
                      }`}
                    >
                      {securityCtx.cerbosPlanKind}
                    </span>
                    {securityCtx.cerbosRawAst && (
                      <CopyButton text={JSON.stringify(securityCtx.cerbosRawAst, null, 2)} />
                    )}
                  </div>
                  {securityCtx.cerbosRawAst ? (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 max-h-48 overflow-y-auto">
                      <JsonHighlight data={securityCtx.cerbosRawAst} />
                    </div>
                  ) : (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-500 font-mono">
                      {securityCtx.cerbosPlanKind === "KIND_ALWAYS_DENIED"
                        ? "// No condition — access denied unconditionally"
                        : "// No condition — access allowed unconditionally"}
                    </div>
                  )}
                </div>
              )}
            </PanelSection>

            {/* ── 3. MongoDB Query Pipeline / Vector Search Pipeline ────── */}
            <PanelSection
              title={securityCtx?.toolName === "search_sessions" ? "Vector Search Pipeline" : "MongoDB Query Pipeline"}
              icon={Database}
              accentColor="emerald"
              defaultOpen={true}
            >
              {!securityCtx ? (
                <div className="text-center py-4">
                  <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-2">
                    <Database className="w-4 h-4 text-zinc-600" />
                  </div>
                  <p className="text-zinc-600 text-xs">Awaiting first tool call...</p>
                </div>
              ) : (
                <div className="space-y-2">

                  {/* ── Step 1: Cerbos security boundary filter ─────────── */}
                  <div className="rounded-lg border border-zinc-800 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[9px] font-bold flex items-center justify-center flex-shrink-0">1</span>
                        <span className="text-zinc-400 text-xs font-mono">Cerbos Security Filter</span>
                      </div>
                      <CopyButton text={JSON.stringify(securityCtx.compiledMongoFilter, null, 2)} />
                    </div>
                    <div className="px-3 py-2.5 bg-zinc-950">
                      <p className="text-zinc-600 text-[10px] font-mono mb-1.5">
                        compiled from {securityCtx.cerbosPlanKind}
                      </p>
                      <JsonHighlight data={securityCtx.compiledMongoFilter} />
                    </div>
                  </div>

                  {/* ── Merge arrow ─────────────────────────────────────── */}
                  <div className="flex items-center gap-2 px-1">
                    <div className="flex-1 h-px bg-zinc-800" />
                    <span className="text-zinc-600 text-[10px] font-mono flex-shrink-0">
                      {securityCtx.toolName === "search_sessions"
                        ? "↓ Voyage embeds query → $vectorSearch pipeline"
                        : "↓ merged with LLM-generated MQL"}
                    </span>
                    <div className="flex-1 h-px bg-zinc-800" />
                  </div>

                  {/* ── Step 2: LLM-generated MQL / Voyage query input ───── */}
                  <div className="rounded-lg border border-zinc-800 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-bold flex items-center justify-center flex-shrink-0">2</span>
                        <span className="text-zinc-400 text-xs font-mono">
                          {securityCtx.toolName === "search_sessions"
                            ? "Voyage Query Input"
                            : "LLM-Generated MQL"}
                          {securityCtx.toolName && (
                            <span className="text-zinc-600 ml-1">({securityCtx.toolName})</span>
                          )}
                        </span>
                      </div>
                      <CopyButton text={JSON.stringify(securityCtx.llmGeneratedFilter, null, 2)} />
                    </div>
                    <div className="px-3 py-2.5 bg-zinc-950">
                      {(() => {
                        const f = securityCtx.llmGeneratedFilter;
                        const isEmpty = !f || Object.keys(f).length === 0 ||
                          (f.filter && Object.keys(f.filter as object).length === 0) ||
                          (f.pipeline && (f.pipeline as unknown[]).length === 0);
                        if (isEmpty) {
                          return (
                            <p className="text-zinc-600 text-xs italic font-mono">
                              &#123;&#125; — no additional filter (returning all authorized records)
                            </p>
                          );
                        }
                        return <JsonHighlight data={f} />;
                      })()}
                    </div>
                  </div>

                  {/* ── Produces arrow ──────────────────────────────────── */}
                  <div className="flex items-center gap-2 px-1">
                    <div className="flex-1 h-px bg-zinc-800" />
                    <span className="text-zinc-600 text-[10px] font-mono flex-shrink-0">
                      {securityCtx.toolName === "search_sessions"
                        ? "↓ produces secured $vectorSearch pipeline"
                        : "↓ produces final secured query"}
                    </span>
                    <div className="flex-1 h-px bg-zinc-800" />
                  </div>

                  {/* ── Step 3: Final secured query sent to MongoDB ─────── */}
                  {(() => {
                    const isVectorSearch = securityCtx.toolName === "search_sessions";
                    const isAgg = securityCtx.toolName === "aggregate";
                    // Collection differs: chat_sessions for vector search, insurance_policies otherwise
                    const collection = isVectorSearch ? "chat_sessions" : "insurance_policies";
                    // Both vector search and aggregate use aggregate(); others use their own name
                    const callLabel = isVectorSearch || isAgg
                      ? "aggregate("
                      : `${securityCtx.toolName ?? "find"}(`;
                    // Extract pipeline array for display
                    const displayData = (isVectorSearch || isAgg)
                      ? ((securityCtx.finalMongoQuery as { pipeline?: unknown[] }).pipeline
                          ?? securityCtx.finalMongoQuery)
                      : securityCtx.finalMongoQuery;
                    const copyText = `db.${collection}.aggregate(\n${JSON.stringify(displayData, null, 2)}\n)`;
                    const step3Label = isVectorSearch
                      ? "Final $vectorSearch Pipeline"
                      : `Final Secured Query → ${securityCtx.toolName ?? "find"}()`;
                    return (
                      <div className="rounded-lg border border-emerald-500/30 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-500/5 border-b border-emerald-500/20">
                          <div className="flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[9px] font-bold flex items-center justify-center flex-shrink-0">3</span>
                            <span className="text-emerald-300 text-xs font-mono font-semibold">
                              {step3Label}
                            </span>
                          </div>
                          <CopyButton text={copyText} />
                        </div>
                        <div className="px-3 py-2.5 bg-zinc-950">
                          <p className="text-zinc-600 text-[10px] font-mono mb-1.5">
                            db.{collection}.{callLabel}
                          </p>
                          <div className="pl-2 border-l-2 border-emerald-500/30">
                            <JsonHighlight data={displayData} />
                          </div>
                          <p className="text-zinc-600 text-[10px] font-mono mt-1">)</p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Result stats ────────────────────────────────────── */}
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2">
                      <p className="text-zinc-600 mb-0.5">
                        {securityCtx.toolName === "search_sessions" ? "Sessions found" : "Documents returned"}
                      </p>
                      <p className="text-emerald-400 font-mono font-bold text-sm">{securityCtx.resultCount}</p>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2">
                      <p className="text-zinc-600 mb-0.5">Executed at</p>
                      <p className="text-zinc-400 font-mono">
                        {new Date(securityCtx.queriedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>

                </div>
              )}
            </PanelSection>

            {/* ── 4. Isolation Proof ────────────────────────────────────── */}
            {securityCtx && (
              <PanelSection
                title="Data Isolation Proof"
                icon={Shield}
                accentColor="amber"
                defaultOpen={false}
              >
                <div className="space-y-2 text-xs">
                  {/* tenant_id boundary — shown for all tools */}
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <p className="text-zinc-400 leading-relaxed">
                      Cerbos AST enforces{" "}
                      <code className="bg-zinc-800 px-1 rounded font-mono text-zinc-300">tenant_id = {securityCtx.principal.tenantId}</code>{" "}
                      at the {securityCtx.toolName === "search_sessions" ? "$vectorSearch filter level (inside ANN scan)" : "database filter level"}.
                    </p>
                  </div>
                  {/* agent_id boundary — shown only when the compiled filter includes it */}
                  {"agent_id" in securityCtx.compiledMongoFilter ||
                   JSON.stringify(securityCtx.compiledMongoFilter).includes("agent_id") ? (
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <p className="text-zinc-400 leading-relaxed">
                        Cerbos AST enforces{" "}
                        <code className="bg-zinc-800 px-1 rounded font-mono text-zinc-300">agent_id = {securityCtx.principal.id}</code>{" "}
                        {securityCtx.toolName === "search_sessions"
                          ? "— only chat sessions this agent created are retrievable."
                          : "preventing cross-agent reads within the same tenant."}
                      </p>
                    </div>
                  ) : null}
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <p className="text-zinc-400 leading-relaxed">
                      {securityCtx.toolName === "search_sessions"
                        ? <>The LLM only supplies a natural language <code className="bg-zinc-800 px-1 rounded font-mono text-zinc-300">query</code> string. The Voyage embedding, Cerbos filter, and <code className="bg-zinc-800 px-1 rounded font-mono text-zinc-300">$vectorSearch</code> pipeline are constructed server-side from the <code className="bg-zinc-800 px-1 rounded font-mono text-zinc-300">httpOnly</code> cookie only.</>
                        : <>The LLM writes full MQL but cannot include <code className="bg-zinc-800 px-1 rounded font-mono text-zinc-300">tenant_id</code> or <code className="bg-zinc-800 px-1 rounded font-mono text-zinc-300">agent_id</code> — those are never in the tool schema. The session is injected server-side from the <code className="bg-zinc-800 px-1 rounded font-mono text-zinc-300">httpOnly</code> cookie only.</>}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-zinc-500 leading-relaxed">
                      {securityCtx.toolName === "search_sessions"
                        ? <>The Cerbos filter is pushed into the Atlas ANN index scan via <code className="bg-zinc-800 px-1 rounded font-mono text-zinc-300">$vectorSearch.filter</code> — documents outside the boundary are excluded before scoring, not post-filtered.</>
                        : <>Even if the LLM generated a filter containing <code className="bg-zinc-800 px-1 rounded font-mono text-zinc-300">&#123; tenant_id: &quot;Tenant_B&quot; &#125;</code>, the server-side <code className="bg-zinc-800 px-1 rounded font-mono text-zinc-300">mergeFilters()</code> would still enforce the Cerbos security boundary, making cross-tenant access structurally impossible.</>}
                    </p>
                  </div>
                </div>
              </PanelSection>
            )}

            {/* ── 5. Architecture legend ────────────────────────────────── */}
            <PanelSection
              title="Architecture Flow"
              icon={FileText}
              accentColor="zinc"
              defaultOpen={false}
            >
              <div className="space-y-1.5 text-xs font-mono">
                {[
                  { label: "Browser → httpOnly Cookie", color: "text-zinc-400" },
                  { label: "Cookie → API Route (server-side)", color: "text-indigo-300" },
                  { label: "LLM generates full MQL filter/pipeline", color: "text-amber-300" },
                  { label: "API Route → Cerbos PDP (planResources)", color: "text-violet-300" },
                  { label: "Cerbos → KIND_CONDITIONAL AST", color: "text-violet-300" },
                  { label: "AST Walker → security filter object", color: "text-violet-300" },
                  { label: "mergeFilters(cerbos, llmMQL) → final query", color: "text-emerald-300" },
                  { label: "Final query → mongodb-mcp-server.find()", color: "text-emerald-300" },
                  { label: "Results + SecurityContext → Stream", color: "text-indigo-300" },
                  { label: "Telemetry → Analytics Panel (live)", color: "text-zinc-400" },
                ].map(({ label, color }, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-zinc-700 w-4 text-right flex-shrink-0">{i + 1}.</span>
                    <span className={color}>{label}</span>
                  </div>
                ))}
              </div>
            </PanelSection>

            {/* ── 6. Session Search ─────────────────────────────────────── */}
            <PanelSection
              title="Session Search"
              icon={Search}
              accentColor="amber"
              defaultOpen={false}
            >
              <div className="space-y-3">
                <p className="text-zinc-600 text-xs leading-relaxed">
                  Semantic search across past customer service sessions.
                  Results are filtered to your authorised scope by Cerbos.
                </p>

                {/* Search input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="e.g. claim dispute, renewal issue..."
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all min-w-0"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={!searchQuery.trim() || searchLoading}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {searchLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Error */}
                {searchError && (
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 text-xs text-red-400">
                    <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    {searchError}
                  </div>
                )}

                {/* Results */}
                {searchResults !== null && (
                  searchResults.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-zinc-600 text-xs">No matching sessions found.</p>
                      <p className="text-zinc-700 text-xs mt-0.5">Try different search terms.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {searchResults.map((result) => (
                        <div
                          key={result.session_id}
                          className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2"
                        >
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-zinc-200 text-xs font-semibold truncate">{result.customer_name}</p>
                              {result.customer_policy_number && (
                                <p className="text-zinc-600 text-xs font-mono">{result.customer_policy_number}</p>
                              )}
                            </div>
                            <span className="flex-shrink-0 bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[10px] px-1.5 py-0.5 rounded font-mono">
                              {(result.score * 100).toFixed(1)}%
                            </span>
                          </div>

                          {/* Date */}
                          <div className="flex items-center gap-1 text-zinc-600 text-[10px] font-mono">
                            <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                            {new Date(result.ended_at).toLocaleDateString(undefined, {
                              month: "short", day: "numeric", year: "numeric",
                            })}
                          </div>

                          {/* Summary */}
                          <p className="text-zinc-400 text-xs leading-relaxed line-clamp-3">{result.summary}</p>

                          {/* Follow-up actions */}
                          {result.follow_up_actions.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1 text-zinc-600 text-[10px] font-mono uppercase tracking-wider mb-1">
                                <ListChecks className="w-2.5 h-2.5" />
                                Follow-up actions
                              </div>
                              <ul className="space-y-0.5">
                                {result.follow_up_actions.map((action, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-amber-400">
                                    <span className="text-amber-600 flex-shrink-0 mt-px">›</span>
                                    {action}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* Empty state before search */}
                {searchResults === null && !searchLoading && !searchError && (
                  <div className="text-center py-3">
                    <Search className="w-6 h-6 text-zinc-800 mx-auto mb-1.5" />
                    <p className="text-zinc-700 text-xs">Search past sessions above.</p>
                  </div>
                )}
              </div>
            </PanelSection>
          </div>
        </div>
      </div>
    </div>
  );
}
