"use client";

import { Component, type ErrorInfo, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { asArray, normalizeTicket, normalizeTicketDetail, statusLabel } from "@/lib/tickets";
import type { Ticket, TicketDetail } from "@/types/ticket";
import { StatusBadge } from "./StatusBadge";

type ManagedUser = { id: number; name: string; loginId: string; role: string };
const statuses = ["all", "open", "assigned", "in_progress", "waiting_for_parts", "escalated", "resolved", "closed"];
const priorities = ["all", "low", "medium", "high", "critical"];

export function AdminTicketManagement() {
  return (
    <TicketManagementErrorBoundary>
      <AdminTicketManagementContent />
    </TicketManagementErrorBoundary>
  );
}

function AdminTicketManagementContent() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [engineers, setEngineers] = useState<ManagedUser[]>([]);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [filters, setFilters] = useState({ status: "all", priority: "all", category: "all", search: "" });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [{ data: ticketData }, { data: userData }] = await Promise.all([
        api.get<{ data?: any[] }>("/tickets"),
        api.get<{ data?: ManagedUser[] }>("/users")
      ]);
      console.debug("[AdminTicketManagement] fetched ticket data", ticketData);
      console.debug("[AdminTicketManagement] API response shape", {
        ticketsIsArray: Array.isArray(ticketData?.data),
        usersIsArray: Array.isArray(userData?.data),
        ticketCount: asArray(ticketData?.data).length,
        userCount: asArray(userData?.data).length
      });
      setTickets(asArray(ticketData?.data).map(normalizeTicket).filter((ticket) => ticket.id > 0));
      setEngineers(asArray<ManagedUser>(userData?.data).filter((user) => user?.role === "engineer"));
    } catch (requestError) {
      setTickets([]);
      setEngineers([]);
      setError(requestError instanceof Error ? requestError.message : "Could not load tickets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    load().catch((requestError) => {
      if (active) setError(requestError instanceof Error ? requestError.message : "Could not load tickets.");
    });
    return () => {
      active = false;
    };
  }, [load]);

  useEffect(() => {
    console.debug("[AdminTicketManagement] component render state", {
      loading,
      ticketCount: tickets.length,
      engineerCount: engineers.length,
      hasError: Boolean(error),
      hasDetail: Boolean(detail)
    });
  }, [loading, tickets.length, engineers.length, error, detail]);

  const categories = useMemo(() => ["all", ...Array.from(new Set(tickets.map((ticket) => ticket.category).filter(Boolean)))], [tickets]);
  const visible = useMemo(() => tickets.filter((ticket) => {
    const haystack = `${ticket.id ?? ""} ${ticket.title ?? ""} ${ticket.requesterName ?? ""} ${ticket.assignedToName ?? ""}`.toLowerCase();
    return (
      (filters.status === "all" || ticket.status === filters.status) &&
      (filters.priority === "all" || ticket.priority === filters.priority) &&
      (filters.category === "all" || ticket.category === filters.category) &&
      haystack.includes(filters.search.toLowerCase())
    );
  }), [filters, tickets]);

  async function assign(ticketId: number, engineerId: string) {
    if (!engineerId) return;
    setActionLoading(true);
    setError("");
    try {
      await api.patch(`/tickets/${ticketId}/assign`, { engineerId: Number(engineerId) });
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not assign engineer.");
    } finally {
      setActionLoading(false);
    }
  }

  async function updatePriority(ticketId: number, priority: string) {
    setActionLoading(true);
    setError("");
    try {
      await api.patch(`/tickets/${ticketId}/priority`, { priority });
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update priority.");
    } finally {
      setActionLoading(false);
    }
  }

  async function escalate(ticketId: number) {
    setActionLoading(true);
    setError("");
    try {
      await api.patch(`/tickets/${ticketId}/escalate`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not escalate ticket.");
    } finally {
      setActionLoading(false);
    }
  }

  async function openDetail(ticketId: number) {
    setDetailError("");
    try {
      const { data } = await api.get<{ data?: any }>(`/tickets/${ticketId}`);
      console.debug("[AdminTicketManagement] fetched ticket detail", data);
      setDetail(normalizeTicketDetail(data?.data));
    } catch (requestError) {
      setDetail(null);
      setDetailError(requestError instanceof Error ? requestError.message : "Could not open ticket detail.");
    }
  }

  return (
    <section className="space-y-5">
      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-white p-4 text-sm text-red-700 shadow-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Ticket management could not load.</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      ) : null}
      {detailError ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-white p-4 text-sm text-amber-700 shadow-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{detailError}</p>
        </div>
      ) : null}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <input placeholder="Search tickets" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 md:col-span-2" />
          <Filter value={filters.status} options={statuses} onChange={(status) => setFilters((current) => ({ ...current, status }))} />
          <Filter value={filters.priority} options={priorities} onChange={(priority) => setFilters((current) => ({ ...current, priority }))} />
          <Filter value={filters.category} options={categories} onChange={(category) => setFilters((current) => ({ ...current, category }))} />
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
            {!loading && visible.map((ticket) => (
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
                  <select className="w-44 rounded-md border border-slate-300 px-2 py-2 text-sm" defaultValue="" disabled={actionLoading} onChange={(event) => assign(ticket.id, event.target.value)}>
                    <option value="">{ticket.assignedToName || "Assign engineer"}</option>
                    {engineers.map((engineer) => <option key={engineer.id} value={engineer.id}>{engineer.loginId || engineer.id} - {engineer.name || "Engineer"}</option>)}
                  </select>
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <button className="rounded-md border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50" disabled={actionLoading} onClick={() => openDetail(ticket.id)} type="button"><Eye className="h-4 w-4" /></button>
                    <button className="rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50" disabled={actionLoading} onClick={() => escalate(ticket.id)} type="button">Escalate</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? <div className="p-8 text-center text-sm text-slate-500">Loading tickets...</div> : null}
        {!loading && !visible.length ? <div className="p-8 text-center text-sm text-slate-500">No tickets found.</div> : null}
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
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm capitalize outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">{(options || []).map((option) => <option key={option} value={option}>{statusLabel(option)}</option>)}</select>;
}

function PrioritySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <select value={value || "low"} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-slate-300 px-2 py-2 text-sm capitalize">{["low", "medium", "high", "critical"].map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select>;
}

function SlaRisk({ ticket }: { ticket: Ticket }) {
  const risky = ticket.priority === "critical" || ticket.status === "escalated";
  return <span className={risky ? "font-semibold text-red-700" : ticket.priority === "high" ? "font-semibold text-amber-700" : "text-green-700"}>{risky ? "High" : ticket.priority === "high" ? "Medium" : "Low"}</span>;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-md border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><div className="mt-2 text-sm font-semibold text-slate-950">{value}</div></div>;
}

class TicketManagementErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AdminTicketManagement] render error", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-white p-5 text-sm text-red-700 shadow-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Ticket Management could not render.</p>
            <p className="mt-1">{this.state.message || "Please refresh the page."}</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
