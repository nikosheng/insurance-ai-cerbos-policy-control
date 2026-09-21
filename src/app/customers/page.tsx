"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BrainCircuit, CalendarClock, Loader2, Search, Shield, Users } from "lucide-react";
import type { ActivitySearchResult, AgentSession, Customer } from "@/types";

type SearchCustomer = Customer & { score: number };

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [semanticQuery, setSemanticQuery] = useState("");
  const [semanticResults, setSemanticResults] = useState<SearchCustomer[] | null>(null);
  const [activityQuery, setActivityQuery] = useState("");
  const [activityResults, setActivityResults] = useState<ActivitySearchResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [session, setSession] = useState<AgentSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/session").then((r) => r.json()), fetch("/api/customers").then((r) => r.json())])
      .then(([sessionData, customerData]) => {
        if (!sessionData.session) return router.replace("/");
        setSession(sessionData.session);
        if (customerData.error) throw new Error(customerData.error);
        setCustomers(customerData.customers);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load customers."))
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = customers.filter((customer) =>
    `${customer.full_name} ${customer.email} ${customer.lifecycle_stage}`.toLowerCase().includes(query.toLowerCase())
  );
  const displayed = semanticResults ?? filtered;

  async function semanticSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!semanticQuery.trim()) return setSemanticResults(null);
    setSearching(true);
    setError(null);
    try {
      const response = await fetch("/api/customers/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: semanticQuery, limit: 12 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed");
      setSemanticResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Semantic search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function activitySearch(event: React.FormEvent) {
    event.preventDefault();
    if (!activityQuery.trim()) return setActivityResults(null);
    setSearching(true);
    setError(null);
    try {
      const response = await fetch("/api/activities/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: activityQuery, limit: 8 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed");
      setActivityResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Semantic activity search failed.");
    } finally {
      setSearching(false);
    }
  }

  if (loading) return <main className="min-h-screen bg-zinc-950 grid place-items-center text-zinc-400"><Loader2 className="w-5 h-5 animate-spin" /></main>;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-900 bg-zinc-950/90 backdrop-blur px-5 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 grid place-items-center"><Shield className="w-4 h-4" /></div>
            <div><p className="font-semibold text-sm">InsureAI Customer 360</p><p className="text-xs text-zinc-500 font-mono">Assigned-agent workspace</p></div>
          </div>
          <nav className="flex items-center gap-3 text-xs">
            <Link href="/chat" className="text-zinc-400 hover:text-zinc-100">AI workspace</Link>
            <span className="border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 rounded-full px-2 py-1 font-mono">{session?.id}</span>
          </nav>
        </div>
      </header>
      <section className="max-w-6xl mx-auto px-5 py-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8">
          <div><p className="text-indigo-300 text-xs font-mono uppercase tracking-[.2em] mb-2">Read-only CRM</p><h1 className="text-3xl font-semibold tracking-tight">Your customer portfolio</h1><p className="text-zinc-500 mt-2 max-w-xl text-sm">Profiles, deals, and activities are filtered by the Cerbos ownership policy before they reach this page.</p></div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs"><p className="text-zinc-500">Authorized scope</p><p className="font-mono text-emerald-300 mt-1">tenant_id + agent_id</p></div>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.25fr] gap-4 mb-8">
          <div className="border border-zinc-800 rounded-2xl bg-zinc-900/60 p-4">
            <label className="block text-xs font-semibold text-zinc-300 mb-2">Filter visible customers</label>
            <div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-zinc-500" /><input value={query} onChange={(e) => { setQuery(e.target.value); setSemanticResults(null); }} placeholder="Name, email, lifecycle..." className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500/50" /></div>
          </div>
          <form onSubmit={semanticSearch} className="border border-indigo-500/20 rounded-2xl bg-indigo-500/5 p-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-indigo-200 mb-2"><BrainCircuit className="w-4 h-4" />Semantic profile search</label>
            <div className="flex gap-2"><input value={semanticQuery} onChange={(e) => setSemanticQuery(e.target.value)} placeholder="e.g. customers concerned about renewal cost" className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-sm outline-none focus:border-indigo-500/50" /><button disabled={searching} className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 text-xs font-semibold disabled:opacity-50">{searching ? "Searching" : "Search"}</button></div>
            {semanticResults && <button type="button" onClick={() => { setSemanticResults(null); setSemanticQuery(""); }} className="text-xs text-indigo-300 mt-2 hover:text-indigo-200">Clear semantic results</button>}
          </form>
        </div>
        <form onSubmit={activitySearch} className="border border-amber-500/20 rounded-2xl bg-amber-500/5 p-4 mb-8">
          <label className="flex items-center gap-2 text-xs font-semibold text-amber-200 mb-2"><CalendarClock className="w-4 h-4" />Search customer interaction memory</label>
          <div className="flex gap-2"><input value={activityQuery} onChange={(e) => setActivityQuery(e.target.value)} placeholder="e.g. customers worried about a coverage gap or rental reimbursement" className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500/50" /><button disabled={searching} className="rounded-xl bg-amber-600 hover:bg-amber-500 px-4 text-xs font-semibold disabled:opacity-50">{searching ? "Searching" : "Search activities"}</button></div>
          {activityResults && <button type="button" onClick={() => { setActivityResults(null); setActivityQuery(""); }} className="text-xs text-amber-300 mt-2 hover:text-amber-200">Clear activity results</button>}
          {activityResults && <div className="grid md:grid-cols-2 gap-2 mt-4">{activityResults.map((activity) => <Link key={activity.activity_id} href={`/customers/${activity.customer_id}`} className="border border-amber-500/15 hover:border-amber-400/45 rounded-xl p-3 bg-zinc-950/70 transition-colors"><div className="flex justify-between gap-3"><p className="text-sm font-medium text-zinc-200">{activity.customer_name}</p><span className="text-[10px] font-mono text-amber-300">{Math.round(activity.score * 100)}%</span></div><p className="text-xs text-zinc-500 mt-1">{activity.type} · {new Date(activity.occurred_at).toLocaleDateString()}</p><p className="text-sm text-zinc-400 mt-2 leading-relaxed line-clamp-3">{activity.summary}</p></Link>)}</div>}
          {activityResults?.length === 0 && <p className="text-sm text-zinc-500 mt-4">No matching activity is available within your assigned portfolio.</p>}
        </form>
        {error && <p className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2 text-sm text-zinc-400"><Users className="w-4 h-4" />{displayed.length} accessible customer{displayed.length !== 1 ? "s" : ""}</div>{semanticResults && <span className="text-xs text-amber-300">Vector-ranked results</span>}</div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {displayed.map((customer) => <Link key={customer.customer_id} href={`/customers/${customer.customer_id}`} className="group border border-zinc-800 hover:border-indigo-500/50 bg-zinc-900 rounded-2xl p-5 transition-colors">
            <div className="flex justify-between gap-3"><div><h2 className="font-semibold">{customer.full_name}</h2><p className="text-xs text-zinc-500 mt-1">{customer.email}</p></div><ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-indigo-300" /></div>
            <p className="text-sm text-zinc-400 leading-relaxed mt-5 line-clamp-2">{customer.profile_summary}</p>
            <div className="flex items-center justify-between mt-5 text-xs"><span className="border border-zinc-700 rounded-full px-2 py-1 text-zinc-300">{customer.lifecycle_stage}</span><span className="text-zinc-500">{customer.preferred_contact_method}</span></div>
          </Link>)}
        </div>
        {!displayed.length && <div className="border border-dashed border-zinc-800 rounded-2xl p-10 text-center text-sm text-zinc-500">No customers match within your authorized scope.</div>}
      </section>
    </main>
  );
}
