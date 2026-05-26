"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, RefreshCw, Search } from "lucide-react";
import { api } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { getSlaStatus, normalizeTicket, slaStatusLabel, statusLabel } from "@/lib/tickets";
import type { Ticket } from "@/types/ticket";
import { StatusBadge } from "./StatusBadge";

export function EngineerAssignedTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const engineer = getSessionUser();

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get<{ data: any[] }>("/tickets");
      setTickets(data.data.map(normalizeTicket));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load assigned tickets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const assigned = useMemo(() => {
    const loginId = engineer?.email?.toLowerCase();
    return tickets.filter((ticket) => {
      const belongsToEngineer = loginId ? ticket.assignedToId?.toLowerCase() === loginId : Boolean(ticket.assignedToId);
      const haystack = `${ticket.id} ${ticket.title} ${ticket.category} ${ticket.requesterName}`.toLowerCase();
      return belongsToEngineer && (status === "all" || ticket.status === status) && haystack.includes(search.toLowerCase());
    });
  }, [engineer?.email, search, status, tickets]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Assigned Tickets</h2>
          <p className="mt-1 text-sm text-slate-500">Open each ticket to record diagnostics, service evidence, and resolution status.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assigned queue" className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm capitalize outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
            {["all", "assigned", "in_progress", "waiting_for_parts", "escalated", "resolved", "closed"].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
          </select>
          <button type="button" onClick={load} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>
      {error ? (
        <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">
          {error}
          <button type="button" onClick={load} className="ml-3 underline">Retry</button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">ID</th>
              <th className="px-5 py-3">Title</th>
              <th className="px-5 py-3">Priority</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">SLA Status</th>
              <th className="px-5 py-3">Assigned Time</th>
              <th className="px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assigned.map((ticket) => {
              const slaStatus = getSlaStatus(ticket);
              return (
              <tr key={ticket.id} onClick={() => router.push(`/engineer/tickets/${ticket.id}`)} className="cursor-pointer hover:bg-blue-50/50">
                <td className="px-5 py-4 font-semibold text-slate-950">#{ticket.id}</td>
                <td className="px-5 py-4 text-slate-700">{ticket.title}</td>
                <td className="px-5 py-4"><StatusBadge status={ticket.priority} /></td>
                <td className="px-5 py-4"><StatusBadge status={ticket.status} /></td>
                <td className="px-5 py-4" title={slaStatusLabel(slaStatus)}><StatusBadge status={slaStatus} /></td>
                <td className="px-5 py-4">{new Date(ticket.assignedAt || ticket.createdAt).toLocaleString()}</td>
                <td className="px-5 py-4" onClick={(event) => event.stopPropagation()}>
                  <Link href={`/engineer/tickets/${ticket.id}`} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800">
                    Open
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>
      {!loading && assigned.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No assigned tickets match this view.</div> : null}
      {loading ? <div className="p-8 text-center text-sm text-slate-500">Loading assigned tickets...</div> : null}
    </section>
  );
}
