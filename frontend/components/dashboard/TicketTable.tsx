"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import type { Ticket } from "@/types/ticket";
import { asArray, normalizeTicket as normalizeApiTicket } from "@/lib/tickets";

type ApiTicket = {
  ID: number;
  TITLE: string;
  CATEGORY: string;
  STATUS: Ticket["status"];
  PRIORITY: Ticket["priority"];
  CREATED_AT: string;
  REQUESTER_NAME: string;
  ASSIGNED_TO_NAME?: string;
};

const fallbackTickets: Ticket[] = [
  { id: 1048, title: "Laptop boot failure", category: "Hardware", status: "open", priority: "critical", requesterName: "Asha Mehta", assignedToName: "R. Singh", createdAt: "2026-05-25" },
  { id: 1047, title: "VPN client reset", category: "Network", status: "in_progress", priority: "high", requesterName: "Daniel Cho", assignedToName: "M. Rao", createdAt: "2026-05-25" }
];

export function TicketTable() {
  const [tickets, setTickets] = useState<Ticket[]>(fallbackTickets);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Hardware",
    priority: "medium" as Ticket["priority"]
  });

  async function loadTickets() {
    try {
      const { data } = await api.get<{ data: ApiTicket[] }>("/tickets");
      console.debug("[TicketTable] fetched ticket data", data);
      console.debug("[TicketTable] API response shape", {
        ticketsIsArray: Array.isArray(data?.data),
        ticketCount: asArray(data?.data).length
      });
      setTickets(asArray(data?.data).map(normalizeApiTicket));
    } catch (requestError) {
      console.debug("[TicketTable] ticket load failed", requestError);
      setTickets(fallbackTickets);
    }
  }

  useEffect(() => {
    loadTickets();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const title = form.title.trim();
    const description = form.description.trim();
    if (title.length < 3) {
      setError("Issue title must be at least 3 characters.");
      return;
    }
    if (description.length < 3) {
      setError("Description must be at least 3 characters.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await api.post("/tickets", {
        ...form,
        title,
        description,
        subcategory: form.category
      });
      setForm({ title: "", description: "", category: "Hardware", priority: "medium" });
      setOpen(false);
      await loadTickets();
    } catch (requestError) {
      console.debug("[TicketTable] ticket create failed", requestError);
      setError(requestError instanceof Error ? requestError.message : "Could not create ticket.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="tickets" className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950">Active Ticket Queue</h2>
        <button
          className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Plus className="h-4 w-4" />
          New ticket
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">ID</th>
              <th className="px-5 py-3">Issue</th>
              <th className="px-5 py-3">Requester</th>
              <th className="px-5 py-3">Priority</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Assigned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tickets.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-blue-50/50">
                <td className="px-5 py-4 font-semibold text-slate-900">#{ticket.id}</td>
                <td className="px-5 py-4">
                  <p className="font-medium text-slate-900">{ticket.title}</p>
                  <p className="text-xs text-slate-500">{ticket.category}</p>
                </td>
                <td className="px-5 py-4 text-slate-700">{ticket.requesterName}</td>
                <td className="px-5 py-4 capitalize text-slate-700">{ticket.priority}</td>
                <td className="px-5 py-4 capitalize text-slate-700">{ticket.status.replace("_", " ")}</td>
                <td className="px-5 py-4 text-slate-700">{ticket.assignedToName || "Unassigned"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 px-4">
          <form className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl" onSubmit={onSubmit}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-950">New Ticket</h3>
              <button className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={() => setOpen(false)} type="button" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Issue title</span>
                <input
                  required
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Description</span>
                <textarea
                  required
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Category</span>
                  <select
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  >
                    <option>Hardware</option>
                    <option>Network</option>
                    <option>Software</option>
                    <option>Assets</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Priority</span>
                  <select
                    value={form.priority}
                    onChange={(event) => setForm({ ...form, priority: event.target.value as Ticket["priority"] })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm capitalize outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
              </div>
              {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setOpen(false)} type="button">
                Cancel
              </button>
              <button className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60" disabled={loading} type="submit">
                {loading ? "Creating..." : "Create ticket"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
