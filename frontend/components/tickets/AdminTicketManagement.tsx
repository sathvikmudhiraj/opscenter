"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { normalizeTicket, normalizeTicketDetail, statusLabel } from "@/lib/tickets";
import type { Ticket, TicketDetail } from "@/types/ticket";
import { StatusBadge } from "./StatusBadge";

type ManagedUser = { id: number; name: string; loginId: string; role: string };
const statuses = ["all", "open", "assigned", "in_progress", "waiting_for_parts", "escalated", "resolved", "closed"];
const priorities = ["all", "low", "medium", "high", "critical"];

export function AdminTicketManagement() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [engineers, setEngineers] = useState<ManagedUser[]>([]);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [filters, setFilters] = useState({ status: "all", priority: "all", category: "all", search: "" });

  async function load() {
    const [{ data: ticketData }, { data: userData }] = await Promise.all([
      api.get<{ data: any[] }>("/tickets"),
      api.get<{ data: ManagedUser[] }>("/users")
    ]);
    setTickets(ticketData.data.map(normalizeTicket));
    setEngineers(userData.data.filter((user) => user.role === "engineer"));
  }

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => ["all", ...Array.from(new Set(tickets.map((ticket) => ticket.category)))], [tickets]);
  const visible = tickets.filter((ticket) => {
    const haystack = `${ticket.id} ${ticket.title} ${ticket.requesterName} ${ticket.assignedToName || ""}`.toLowerCase();
    return (
      (filters.status === "all" || ticket.status === filters.status) &&
      (filters.priority === "all" || ticket.priority === filters.priority) &&
      (filters.category === "all" || ticket.category === filters.category) &&
      haystack.includes(filters.search.toLowerCase())
    );
  });

  async function assign(ticketId: number, engineerId: string) {
    if (!engineerId) return;
    await api.patch(`/tickets/${ticketId}/assign`, { engineerId: Number(engineerId) });
    await load();
  }

  async function updatePriority(ticketId: number, priority: string) {
    await api.patch(`/tickets/${ticketId}/priority`, { priority });
    await load();
  }

  async function escalate(ticketId: number) {
    await api.patch(`/tickets/${ticketId}/escalate`);
    await load();
  }

  async function openDetail(ticketId: number) {
    const { data } = await api.get<{ data: any }>(`/tickets/${ticketId}`);
    setDetail(normalizeTicketDetail(data.data));
  }

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <input placeholder="Search tickets" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 md:col-span-2" />
          <Filter value={filters.status} options={statuses} onChange={(status) => setFilters({ ...filters, status })} />
          <Filter value={filters.priority} options={priorities} onChange={(priority) => setFilters({ ...filters, priority })} />
          <Filter value={filters.category} options={categories} onChange={(category) => setFilters({ ...filters, category })} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">ID</th>
              <th className="px-5 py-3">Title</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Priority</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Employee</th>
              <th className="px-5 py-3">Assigned Engineer</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-blue-50/50">
                <td className="px-5 py-4 font-semibold">#{ticket.id}</td>
                <td className="px-5 py-4">
                  <Link className="font-semibold text-blue-700 hover:text-blue-900" href={`/tickets/${ticket.id}`}>{ticket.title}</Link>
                  <p className="mt-1 text-xs text-slate-500">SLA risk: <SlaRisk ticket={ticket} /></p>
                </td>
                <td className="px-5 py-4">{ticket.category}</td>
                <td className="px-5 py-4"><PrioritySelect value={ticket.priority} onChange={(priority) => updatePriority(ticket.id, priority)} /></td>
                <td className="px-5 py-4"><StatusBadge status={ticket.status} /></td>
                <td className="px-5 py-4">{ticket.requesterName}</td>
                <td className="px-5 py-4">
                  <select className="w-44 rounded-md border border-slate-300 px-2 py-2 text-sm" defaultValue="" onChange={(event) => assign(ticket.id, event.target.value)}>
                    <option value="">{ticket.assignedToName || "Assign engineer"}</option>
                    {engineers.map((engineer) => <option key={engineer.id} value={engineer.id}>{engineer.loginId} - {engineer.name}</option>)}
                  </select>
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <button className="rounded-md border border-slate-300 p-2 text-slate-700 hover:bg-slate-50" onClick={() => openDetail(ticket.id)} type="button"><Eye className="h-4 w-4" /></button>
                    <button className="rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700" onClick={() => escalate(ticket.id)} type="button">Escalate</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detail ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">#{detail.id} {detail.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{detail.description}</p>
              </div>
              <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={() => setDetail(null)}>Close</button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <Info label="Status" value={<StatusBadge status={detail.status} />} />
              <Info label="Priority" value={<StatusBadge status={detail.priority} />} />
              <Info label="Retention" value={`${detail.imageRetentionDays} days`} />
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {detail.screenshotUrl ? <img src={detail.screenshotUrl} alt="Issue screenshot" className="max-h-64 rounded-md object-cover" /> : null}
              {detail.serviceImageUrl ? <img src={detail.serviceImageUrl} alt="Service image" className="max-h-64 rounded-md object-cover" /> : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Filter({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm capitalize outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">{options.map((option) => <option key={option} value={option}>{statusLabel(option)}</option>)}</select>;
}

function PrioritySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-slate-300 px-2 py-2 text-sm capitalize">{["low", "medium", "high", "critical"].map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select>;
}

function SlaRisk({ ticket }: { ticket: Ticket }) {
  const risky = ticket.priority === "critical" || ticket.status === "escalated";
  return <span className={risky ? "font-semibold text-red-700" : ticket.priority === "high" ? "font-semibold text-amber-700" : "text-green-700"}>{risky ? "High" : ticket.priority === "high" ? "Medium" : "Low"}</span>;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-md border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><div className="mt-2 text-sm font-semibold text-slate-950">{value}</div></div>;
}
