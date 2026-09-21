"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, DollarSign, Loader2, Mail, Phone, Shield, UserRound } from "lucide-react";
import type { Customer360Profile } from "@/types";

function Money({ value }: { value: number }) { return <>${value.toLocaleString()}</>; }

export default function CustomerProfilePage() {
  const { customerId } = useParams<{ customerId: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Customer360Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/customers/${encodeURIComponent(customerId)}`).then(async (response) => {
      const data = await response.json();
      if (response.status === 401) return router.replace("/");
      if (!response.ok) throw new Error(data.error || "Customer not found");
      setProfile(data.profile);
    }).catch((err) => setError(err instanceof Error ? err.message : "Unable to load profile."));
  }, [customerId, router]);

  if (error) return <main className="min-h-screen bg-zinc-950 grid place-items-center p-5"><div className="text-center"><p className="text-zinc-300">Customer not found</p><p className="text-sm text-zinc-500 mt-2">The profile may not exist or is outside your authorized scope.</p><Link className="inline-block text-indigo-300 text-sm mt-5" href="/customers">Return to Customer 360</Link></div></main>;
  if (!profile) return <main className="min-h-screen bg-zinc-950 grid place-items-center text-zinc-400"><Loader2 className="w-5 h-5 animate-spin" /></main>;
  const { customer, policies, deals, activities } = profile;
  return <main className="min-h-screen bg-zinc-950 text-zinc-100"><header className="border-b border-zinc-900 px-5 py-4"><div className="max-w-6xl mx-auto"><Link href="/customers" className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-100"><ArrowLeft className="w-3.5 h-3.5" />Customer 360 directory</Link></div></header><section className="max-w-6xl mx-auto px-5 py-8">
    <div className="border border-zinc-800 rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 md:p-8 mb-5"><div className="flex flex-col md:flex-row justify-between gap-6"><div className="flex gap-4"><div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 grid place-items-center"><UserRound className="w-6 h-6 text-indigo-300" /></div><div><p className="text-indigo-300 text-xs font-mono uppercase tracking-wider">Customer 360 profile</p><h1 className="text-3xl font-semibold mt-1">{customer.full_name}</h1><p className="text-zinc-400 text-sm mt-3 max-w-2xl">{customer.profile_summary}</p></div></div><div className="text-xs text-right"><p className="text-zinc-500">Ownership verified by Cerbos</p><p className="font-mono text-emerald-300 mt-1">{customer.agent_name} · {customer.agent_id}</p></div></div><div className="flex flex-wrap gap-4 text-sm mt-7 text-zinc-300"><span className="flex items-center gap-2"><Mail className="w-4 h-4 text-zinc-500" />{customer.email}</span><span className="flex items-center gap-2"><Phone className="w-4 h-4 text-zinc-500" />{customer.phone}</span><span className="border border-zinc-700 rounded-full px-2 py-0.5 text-xs">{customer.lifecycle_stage}</span><span className="border border-zinc-700 rounded-full px-2 py-0.5 text-xs">{customer.segment}</span></div></div>
    <div className="grid lg:grid-cols-3 gap-5"><section className="lg:col-span-2 space-y-5"><Panel title="Policy portfolio"><div className="divide-y divide-zinc-800">{policies.map((policy) => <div key={policy.policy_number} className="py-3 flex justify-between gap-3 text-sm"><div><p className="font-medium">{policy.policy_type} · {policy.policy_number}</p><p className="text-zinc-500 text-xs mt-1">{policy.status} · ${policy.premium_monthly}/month</p></div><p className="font-mono text-zinc-300"><Money value={policy.coverage_amount} /></p></div>)}{!policies.length && <Empty />}</div></Panel><Panel title="Deals"><div className="space-y-3">{deals.map((deal) => <div key={deal.deal_id} className="border border-zinc-800 bg-zinc-950 rounded-xl p-3 flex justify-between gap-4"><div><p className="text-sm font-medium">{deal.title}</p><p className="text-xs text-zinc-500 mt-1">{deal.stage} · {deal.probability}% likely · {deal.next_step}</p></div><p className="font-mono text-sm text-emerald-300"><Money value={deal.amount} /></p></div>)}{!deals.length && <Empty />}</div></Panel></section><aside className="space-y-5"><Panel title="Activity timeline">{activities.map((activity) => <div key={activity.activity_id} className="relative pl-4 pb-4 border-l border-zinc-800 last:pb-0"><span className="absolute -left-1 top-1 w-2 h-2 bg-indigo-400 rounded-full" /><p className="text-xs text-zinc-500">{new Date(activity.occurred_at).toLocaleDateString()} · {activity.type}</p><p className="text-sm text-zinc-300 mt-1">{activity.summary}</p>{activity.follow_up_due_at && <p className="text-xs text-amber-300 mt-2 flex items-center gap-1"><CalendarClock className="w-3 h-3" />Follow-up {new Date(activity.follow_up_due_at).toLocaleDateString()}</p>}</div>)}{!activities.length && <Empty />}</Panel><div className="border border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-4"><div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold"><Shield className="w-4 h-4" />Access boundary</div><p className="text-xs text-zinc-400 leading-relaxed mt-2">This read-only profile was returned only after Cerbos applied its assigned-agent filter. A different agent receives no profile data.</p></div></aside></div>
  </section></main>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border border-zinc-800 bg-zinc-900 rounded-2xl p-5"><h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-4">{title}</h2>{children}</section>; }
function Empty() { return <p className="text-sm text-zinc-500">No records in this view.</p>; }
