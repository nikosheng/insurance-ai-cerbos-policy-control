"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, MessageCircle, ChevronRight, AlertCircle, Lock, User } from "lucide-react";
import { CUSTOMER_REGISTRY, getCustomerGroups } from "@/lib/customers";

const GROUPS = getCustomerGroups();

// Agent colour per agentId
const AGENT_COLORS: Record<string, { badge: string; dot: string; text: string }> = {
  agent_1: { badge: "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30", dot: "bg-indigo-400", text: "text-indigo-300" },
  agent_2: { badge: "bg-sky-500/15 text-sky-300 border border-sky-500/30",           dot: "bg-sky-400",   text: "text-sky-300"   },
  agent_3: { badge: "bg-violet-500/15 text-violet-300 border border-violet-500/30",  dot: "bg-violet-400",text: "text-violet-300"},
};

const POLICY_TYPE_ICON: Record<string, string> = {
  Auto: "🚗",
  Home: "🏠",
  Life: "💚",
};

export default function CustomerLoginPage() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCustomer = CUSTOMER_REGISTRY.find((c) => c.clientId === selectedId);

  const handleStart = async () => {
    if (!selectedId || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customer-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to start session");
      }
      router.push("/customer/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800/60 px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-slate-100 font-semibold text-sm">InsureAI</span>
              <span className="text-slate-500 text-xs ml-2 font-mono">Customer Portal</span>
            </div>
          </div>
          <a
            href="/"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors font-mono flex items-center gap-1"
          >
            Agent Portal
            <ChevronRight className="w-3 h-3" />
          </a>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sky-600/15 border border-sky-500/25 mb-5 shadow-lg shadow-sky-500/10">
              <MessageCircle className="w-8 h-8 text-sky-400" />
            </div>
            <h1 className="text-3xl font-bold text-slate-100 mb-2 tracking-tight">
              Chat with your agent
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Select your name below to connect with your insurance agent instantly.
              No password required for this demo.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-center gap-3 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Card */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
            <label className="block text-slate-300 text-sm font-medium mb-3">
              <User className="w-3.5 h-3.5 inline mr-1.5 text-slate-500" />
              Who are you?
            </label>

            {/* Grouped select */}
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/20 transition-all appearance-none cursor-pointer mb-5"
            >
              <option value="" disabled className="text-slate-500">
                — Select your name —
              </option>
              {GROUPS.map((group) => (
                <optgroup
                  key={group.agentId}
                  label={`Agent: ${group.agentName} (${group.tenantId})`}
                  className="text-slate-400"
                >
                  {group.customers.map((c) => (
                    <option key={c.clientId} value={c.clientId} className="text-slate-200">
                      {c.clientName} — {POLICY_TYPE_ICON[c.policyType] ?? ""} {c.policyType} ({c.policyNumber})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {/* Preview card — shown when a customer is selected */}
            {selectedCustomer && (
              <div className="mb-5 bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-600/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0 text-sm font-bold text-sky-300">
                    {selectedCustomer.clientName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-200 text-sm font-semibold">{selectedCustomer.clientName}</p>
                    <p className="text-slate-500 text-xs font-mono mt-0.5">{selectedCustomer.policyNumber}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/25 font-medium">
                        {POLICY_TYPE_ICON[selectedCustomer.policyType]} {selectedCustomer.policyType}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AGENT_COLORS[selectedCustomer.agentId]?.badge ?? ""}`}>
                        Agent: {selectedCustomer.agentName}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleStart}
              disabled={!selectedId || loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition-all shadow-lg shadow-sky-500/20 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Starting chat...
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4" />
                  Start Chat
                  {selectedCustomer && ` with ${selectedCustomer.agentName}`}
                </>
              )}
            </button>
          </div>

          {/* Security note */}
          <div className="mt-5 flex items-start gap-2.5 bg-slate-900/40 border border-slate-800/60 rounded-xl px-4 py-3">
            <Lock className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 mt-0.5" />
            <p className="text-slate-600 text-xs leading-relaxed">
              Your session is secured with Cerbos ABAC — you can only access your own
              policy data. Cross-customer data access is structurally prevented.
            </p>
          </div>

          {/* Shield badge */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <Shield className="w-3 h-3 text-slate-700" />
            <span className="text-slate-700 text-xs font-mono">Cerbos Zero-Trust · MongoDB Atlas · Azure OpenAI</span>
          </div>
        </div>
      </main>
    </div>
  );
}
