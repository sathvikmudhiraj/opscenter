"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { normalizeTicket } from "@/lib/tickets";
import type { Ticket } from "@/types/ticket";
import { StatusBadge } from "@/components/tickets/StatusBadge";

type User = { id: number; name: string; loginId: string; role: string; status: string; department?: string; location?: string };

export function EngineerManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    Promise.all([api.get<{ data: User[] }>("/users"), api.get<{ data: any[] }>("/tickets")])
      .then(([userData, ticketData]) => {
        setUsers(userData.data.data);
        setTickets(ticketData.data.data.map(normalizeTicket));
      })
      .catch(() => {
        setUsers([]);
        setTickets([]);
      });
  }, []);

  const engineers = useMemo(() => users.filter((user) => user.role === "engineer"), [users]);

  function workload(loginId: string) {
    const assigned = tickets.filter((ticket) => ticket.assignedToId === loginId);
    const active = assigned.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
    return { assigned: assigned.length, active: active.length, highRisk: active.filter((ticket) => ticket.priority === "critical" || ticket.status === "escalated").length };
  }

  return (
    <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">Engineer</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Location</th>
            <th className="px-5 py-3">Assigned</th>
            <th className="px-5 py-3">Active</th>
            <th className="px-5 py-3">SLA Risk</th>
            <th className="px-5 py-3">Assignable</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {engineers.map((engineer) => {
            const stats = workload(engineer.loginId);
            return (
              <tr key={engineer.id} className="hover:bg-blue-50/50">
                <td className="px-5 py-4">
                  <p className="font-semibold text-slate-950">{engineer.loginId}</p>
                  <p className="mt-1 text-xs text-slate-500">{engineer.name}</p>
                </td>
                <td className="px-5 py-4"><StatusBadge status={engineer.status} /></td>
                <td className="px-5 py-4">{engineer.location || "Service Desk"}</td>
                <td className="px-5 py-4 font-semibold">{stats.assigned}</td>
                <td className="px-5 py-4 font-semibold">{stats.active}</td>
                <td className="px-5 py-4"><StatusBadge status={stats.highRisk ? "critical" : "low"} /></td>
                <td className="px-5 py-4">{engineer.status === "active" ? "Yes" : "No"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
