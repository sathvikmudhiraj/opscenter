"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { normalizeTicket } from "@/lib/tickets";
import type { Ticket } from "@/types/ticket";
import { StatusBadge } from "./StatusBadge";

export function EmployeeMyTickets({ tickets: providedTickets, filter = "all", loading = false, error = "", onClearFilter }: { tickets?: Ticket[]; filter?: "all" | "open" | "active" | "sla" | "closed"; loading?: boolean; error?: string; onClearFilter?: () => void }) {
  const [localTickets, setLocalTickets] = useState<Ticket[]>([]);
  const [search, setSearch] = useState("");
  const user = getSessionUser();

  useEffect(() => {
    if (providedTickets) return;
    api.get<{ data: any[] }>("/tickets").then(({ data }) => setLocalTickets(data.data.map(normalizeTicket))).catch(() => setLocalTickets([]));
  }, [providedTickets]);

  const tickets = providedTickets || localTickets;

  const mine = useMemo(() => {
    const loginId = user?.email?.toLowerCase();
    return tickets.filter((ticket) => {
      const belongsToUser = loginId ? ticket.requesterId?.toLowerCase() === loginId : true;
      const matchesFilter =
        filter === "all" ||
        (filter === "open" && ticket.status === "open") ||
        (filter === "active" && !["resolved", "closed"].includes(ticket.status)) ||
        (filter === "sla" && (ticket.priority === "critical" || ticket.slaRisk === "high" || ticket.status === "escalated")) ||
        (filter === "closed" && ["resolved", "closed"].includes(ticket.status));
      const haystack = `${ticket.id} ${ticket.title} ${ticket.priority} ${ticket.status} ${ticket.assignedToName || ""}`.toLowerCase();
      return belongsToUser && matchesFilter && haystack.includes(search.toLowerCase());
    });
  }, [filter, search, tickets, user?.email]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">My Tickets</h2>
          <p className="mt-1 text-sm text-slate-500">Track status, assigned engineer, and support history.</p>
          {filter !== "all" ? (
            <button type="button" onClick={onClearFilter} className="mt-2 text-xs font-semibold text-blue-700 hover:text-blue-900">
              Clear dashboard filter
            </button>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/employee/my-tickets" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">View All Tickets</Link>
          <label className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search my tickets" className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
          </label>
        </div>
      </div>
      {error ? <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">{error}</div> : null}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Ticket ID</th>
              <th className="px-5 py-3">Title</th>
              <th className="px-5 py-3">Priority</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Assigned Engineer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && mine.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-blue-50/50">
                <td className="px-5 py-4 font-semibold text-slate-950">#{ticket.id}</td>
                <td className="px-5 py-4"><Link href={`/tickets/${ticket.id}`} className="font-semibold text-blue-700 hover:text-blue-900">{ticket.title}</Link></td>
                <td className="px-5 py-4"><StatusBadge status={ticket.priority} /></td>
                <td className="px-5 py-4"><StatusBadge status={ticket.status} /></td>
                <td className="px-5 py-4 text-slate-700">{ticket.assignedToName || "Awaiting assignment"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading ? <div className="p-8 text-center text-sm text-slate-500">Loading employee tickets...</div> : null}
      {!loading && !mine.length ? <div className="p-8 text-center text-sm text-slate-500">No tickets found for this employee.</div> : null}
    </section>
  );
}
