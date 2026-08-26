"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  ChevronRight,
  Lock,
  Database,
  Cpu,
  AlertCircle,
  CheckCircle2,
  FileText,
  MessageCircle,
  Users,
} from "lucide-react";
import { AGENT_REGISTRY, TEST_SCENARIOS } from "@/lib/agents";
import type { AgentId } from "@/lib/agents";

type AgentEntry = (typeof AGENT_REGISTRY)[AgentId];

const AGENTS = Object.values(AGENT_REGISTRY) as AgentEntry[];

const TENANT_STYLES: Record<string, { badge: string; glow: string; ring: string; dot: string }> = {
  indigo: {
    badge: "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30",
    glow: "hover:shadow-indigo-500/20 hover:shadow-xl",
    ring: "focus:ring-indigo-500/50",
    dot: "bg-indigo-400",
  },
  violet: {
    badge: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
    glow: "hover:shadow-violet-500/20 hover:shadow-xl",
    ring: "focus:ring-violet-500/50",
    dot: "bg-violet-400",
  },
  emerald: {
    badge: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    glow: "hover:shadow-emerald-500/20 hover:shadow-xl",
    ring: "focus:ring-emerald-500/50",
    dot: "bg-emerald-400",
  },
};

function AgentCard({
  agent,
  onSelect,
  isLoading,
}: {
  agent: AgentEntry;
  onSelect: (id: AgentId) => void;
  isLoading: boolean;
}) {
  const styles = TENANT_STYLES[agent.tenantColor] ?? TENANT_STYLES.indigo;
  const color = agent.tenantColor;

  const accentLine =
    color === "indigo"
      ? "bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent"
      : color === "violet"
        ? "bg-gradient-to-r from-transparent via-violet-500/60 to-transparent"
        : "bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent";

  const avatarClass =
    color === "indigo"
      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
      : color === "violet"
        ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";

  const btnClass =
    color === "indigo"
      ? "bg-indigo-600/90 hover:bg-indigo-500 text-white"
      : color === "violet"
        ? "bg-violet-600/90 hover:bg-violet-500 text-white"
        : "bg-emerald-600/90 hover:bg-emerald-500 text-white";

  return (
    <div
      className={`
        group relative flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900
        overflow-hidden transition-all duration-300
        hover:border-zinc-600 hover:bg-zinc-800/80
        ${styles.glow}
      `}
    >
      {/* Coloured top accent line */}
      <div className={`absolute inset-x-0 top-0 h-0.5 ${accentLine}`} />

      {/* Card body — flex-1 so all cards stretch to equal height */}
      <div className="flex-1 flex flex-col p-5 pt-6">

        {/* Row 1: avatar + tenant badge */}
        <div className="flex items-center justify-between mb-4">
          <div
            className={`
              w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold
              flex-shrink-0 transition-transform duration-200 group-hover:scale-105
              ${avatarClass}
            `}
          >
            {agent.initials}
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${styles.badge}`}>
            {agent.tenantLabel}
          </span>
        </div>

        {/* Row 2: name + agent id */}
        <h3 className="text-zinc-100 font-semibold text-sm leading-snug">
          {agent.name}
        </h3>
        <p className="text-zinc-500 text-xs font-mono mt-0.5 mb-3">{agent.id}</p>

        {/* Row 3: description — clamped to 3 lines so cards align */}
        <p className="text-zinc-400 text-xs leading-relaxed line-clamp-3 flex-1">
          {agent.description}
        </p>

        {/* Row 4: role pill */}
        <div className="flex flex-wrap gap-1 mt-4">
          {agent.roles.map((role) => (
            <span
              key={role}
              className="inline-flex items-center gap-1 bg-zinc-800 border border-zinc-700/80 text-zinc-400 text-xs px-2 py-0.5 rounded-md font-mono"
            >
              <Shield className="w-2.5 h-2.5" />
              {role}
            </span>
          ))}
        </div>
      </div>

      {/* Footer: login button — always pinned to bottom */}
      <div className="px-5 pb-5">
        <button
          onClick={() => onSelect(agent.id as AgentId)}
          disabled={isLoading}
          className={`
            w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold
            transition-all duration-200 focus:outline-none focus:ring-2 ${styles.ring}
            disabled:opacity-50 disabled:cursor-not-allowed
            ${btnClass}
          `}
        >
          <ChevronRight className="w-3.5 h-3.5" />
          Login as {agent.name.split(" ")[0]}
        </button>
      </div>
    </div>
  );
}

function TechBadge({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-400">
      <Icon className="w-3 h-3 text-zinc-500" />
      {label}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [loadingAgent, setLoadingAgent] = useState<AgentId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTestCases, setShowTestCases] = useState(false);

  const handleSelectAgent = async (agentId: AgentId) => {
    setLoadingAgent(agentId);
    setError(null);

    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create session");
      }

      router.push("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setLoadingAgent(null);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* ── Top navigation bar ─────────────────────────────────────────────── */}
      <header className="border-b border-zinc-900 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-zinc-100 font-semibold text-sm">InsureAI</span>
              <span className="text-zinc-600 text-xs ml-2 font-mono">v1.0</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse" />
              <span className="font-mono">Zero-Trust Active</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-5xl">
          {/* ── Hero section ─────────────────────────────────────────────── */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 text-xs text-indigo-300 font-mono mb-6">
              <Lock className="w-3 h-3" />
              Cerbos ABAC · MongoDB Atlas · Azure OpenAI
            </div>

            <h1 className="text-4xl font-bold text-zinc-100 mb-3 tracking-tight">
              Secure Agent{" "}
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Chat Studio
              </span>
            </h1>
            <p className="text-zinc-400 text-base max-w-2xl mx-auto leading-relaxed">
              Multi-tenant insurance AI assistant with zero-trust data isolation.
              Select an agent identity below to experience Cerbos ABAC role-based access control in action.
            </p>
          </div>

          {/* ── Error banner ─────────────────────────────────────────────── */}
          {error && (
            <div className="mb-6 flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Agent selector grid ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {AGENTS.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onSelect={handleSelectAgent}
                isLoading={loadingAgent !== null}
              />
            ))}
          </div>

          {/* ── Customer Portal entry ────────────────────────────────────── */}
          <div className="mb-8 relative overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-r from-sky-950/60 via-slate-900/80 to-sky-950/60">
            {/* subtle glow line */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 px-6 py-5">
              {/* icon */}
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-sky-600/15 border border-sky-500/25 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-sky-400" />
              </div>
              {/* text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-zinc-100 text-sm font-semibold">Customer Portal</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 font-mono">
                    New
                  </span>
                </div>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Experience the chat from a customer&apos;s perspective. Select your name, chat with
                  your assigned agent (powered by AI), and ask about your policies.
                  Cerbos enforces that you can only see your own data — even if the AI tries to fetch more.
                </p>
                <div className="flex flex-wrap gap-3 mt-2.5">
                  <div className="flex items-center gap-1.5 text-zinc-600 text-xs">
                    <Users className="w-3 h-3" />
                    <span>20 mock customers across 3 agents</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-600 text-xs">
                    <Shield className="w-3 h-3" />
                    <span>Cerbos role: <code className="font-mono text-zinc-500">customer</code></span>
                  </div>
                </div>
              </div>
              {/* CTA */}
              <a
                href="/customer"
                className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-all shadow-lg shadow-sky-500/20 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Open Customer Portal
                <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* ── Security info strip ──────────────────────────────────────── */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 mb-8">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-zinc-300 text-sm font-medium mb-1">
                  Zero-Trust Security Model Active
                </p>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  Your selection creates an{" "}
                  <code className="bg-zinc-800 px-1 py-0.5 rounded text-zinc-300 font-mono">httpOnly</code>{" "}
                  session cookie. The AI model never sees your identity — Cerbos intercepts
                  every tool call and enforces ABAC policies at the database filter level.
                  Cross-tenant and cross-agent data access is structurally impossible.
                </p>
              </div>
            </div>
          </div>

          {/* ── Tech stack badges ─────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            <TechBadge icon={Shield} label="Cerbos PlanResources" />
            <TechBadge icon={Database} label="MongoDB Atlas Local" />
            <TechBadge icon={Cpu} label="Azure OpenAI gpt-5.6-luna" />
            <TechBadge icon={Lock} label="httpOnly Cookies" />
            <TechBadge icon={FileText} label="Vercel AI SDK v3" />
          </div>

          {/* ── Test scenarios accordion ─────────────────────────────────── */}
          <div className="border border-zinc-800 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowTestCases(!showTestCases)}
              className="w-full flex items-center justify-between px-5 py-4 bg-zinc-900 hover:bg-zinc-800/80 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-400" />
                <span className="text-zinc-300 text-sm font-medium">
                  Test Scenarios ({TEST_SCENARIOS.length} pre-built prompts)
                </span>
              </div>
              <ChevronRight
                className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${showTestCases ? "rotate-90" : ""}`}
              />
            </button>

            {showTestCases && (
              <div className="divide-y divide-zinc-800/60">
                {TEST_SCENARIOS.map((tc) => {
                  const agent = AGENT_REGISTRY[tc.agentId as AgentId];
                  const c = agent.tenantColor;
                  const badgeCls =
                    c === "indigo"  ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/25"
                    : c === "violet"  ? "bg-violet-500/10 text-violet-300 border-violet-500/25"
                    :                   "bg-emerald-500/10 text-emerald-300 border-emerald-500/25";
                  const btnCls =
                    c === "indigo"  ? "border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
                    : c === "violet"  ? "border-violet-500/30 text-violet-300 hover:bg-violet-500/10"
                    :                   "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10";
                  return (
                    <div key={tc.id} className="px-5 py-4 bg-zinc-950">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-zinc-400 text-xs font-mono">{tc.id.toUpperCase()}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${badgeCls}`}>
                              {agent.tenantLabel} / {tc.agentId}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                                tc.expectedCount === 0
                                  ? "bg-zinc-800 text-zinc-500"
                                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              }`}
                            >
                              {tc.expectedCount === 0 ? "∅ empty" : `${tc.expectedCount} result${tc.expectedCount > 1 ? "s" : ""}`}
                            </span>
                          </div>
                          <p className="text-zinc-200 text-sm">&ldquo;{tc.prompt}&rdquo;</p>
                          <p className="text-zinc-500 text-xs mt-1 leading-relaxed">{tc.description}</p>
                        </div>
                        <button
                          onClick={() => handleSelectAgent(tc.agentId as AgentId)}
                          disabled={loadingAgent !== null}
                          className={`flex-shrink-0 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${btnCls}`}
                        >
                          <ChevronRight className="w-3 h-3" />
                          Run
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-900 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-zinc-600">
          <span className="font-mono">SecureInsure Corp — AI Chat Studio</span>
          <span className="font-mono">Cerbos ABAC · Zero-Trust Architecture</span>
        </div>
      </footer>
    </div>
  );
}
