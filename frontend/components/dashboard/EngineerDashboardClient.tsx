"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardCheck, Flag, ShieldAlert, Timer, Wrench, type LucideIcon } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { getSlaStatus, normalizeTicket, normalizeTicketDetail, statusLabel } from "@/lib/tickets";
import type { Ticket } from "@/types/ticket";
import { KpiCard } from "./KpiCard";
import { EngineerAssignedTickets } from "@/components/tickets/EngineerAssignedTickets";

type Activity = { id: string; ticketId: number; title: string; action: string; details: string; timestamp: string };
const categoryColors = ["#2563eb", "#0891b2", "#16a34a", "#f59e0b", "#dc2626"];

export function EngineerDashboardClient() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const engineer = getSessionUser();

  async function load() {
    setLoading(true);
    setError("");
    try {
      const currentEngineer = getSessionUser();
      const { data: ticketData } = await api.get<{ data: any[] }>(`/tickets?assignedTo=${currentEngineer?.id ?? ""}`);
      const normalizedTickets = ticketData.data.map(normalizeTicket);
      const engineerTickets = normalizedTickets.filter((ticket) => {
        const belongsToEngineer = currentEngineer?.id ? ticket.assignedToUserId === currentEngineer.id : Boolean(ticket.assignedToUserId);
        return belongsToEngineer;
      });
      const detailResponses = await Promise.allSettled(
        engineerTickets.slice(0, 8).map((ticket) => api.get<{ data: any }>(`/tickets/${ticket.id}`))
      );
      const timelineActivities = detailResponses.flatMap((response) => {
        if (response.status !== "fulfilled") return [];
        const detail = normalizeTicketDetail(response.value.data.data);
        return detail.timeline
          .filter((entry) => ["ticket_assigned", "status_updated", "ticket_escalated", "ticket_resolved"].includes(entry.action))
          .map((entry) => ({
            id: `${detail.id}-${entry.action}-${entry.timestamp}`,
            ticketId: detail.id,
            title: detail.title,
            action: entry.action,
            details: entry.details,
            timestamp: entry.timestamp
          }));
      });
      setTickets(normalizedTickets);
      setActivities(timelineActivities.sort((left, right) => right.timestamp.localeCompare(left.timestamp)).slice(0, 8));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load engineer dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const queue = useMemo(() => {
    return tickets.filter((ticket) => {
      const belongsToEngineer = engineer?.id ? ticket.assignedToUserId === engineer.id : Boolean(ticket.assignedToUserId);
      return belongsToEngineer && ticket.status !== "closed";
    });
  }, [engineer?.id, tickets]);

  const activeQueue = queue.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
  const criticalAssigned = queue.filter((ticket) => ticket.priority === "critical" && !["resolved", "closed"].includes(ticket.status));
  const inProgress = queue.filter((ticket) => ticket.status === "in_progress");
  const resolved = queue.filter((ticket) => ticket.status === "resolved");
  const breached = queue.filter((ticket) => getSlaStatus(ticket) === "breached");
  const atRisk = queue.filter((ticket) => getSlaStatus(ticket) === "at_risk");
  const escalated = queue.filter((ticket) => ticket.status === "escalated");
  const statusChartData = ["assigned", "in_progress", "waiting_for_parts", "escalated", "resolved", "closed"].map((status) => ({
    name: statusLabel(status),
    value: queue.filter((ticket) => ticket.status === status).length
  }));
  const categories = Array.from(new Set(queue.map((ticket) => ticket.category))).filter(Boolean);
  const categoryChartData = (categories.length ? categories : ["No category"]).map((category) => ({
    name: category,
    value: queue.filter((ticket) => ticket.category === category).length
  }));
  const hasStatusData = statusChartData.some((item) => item.value > 0);
  const hasCategoryData = categoryChartData.some((item) => item.value > 0);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
          <button type="button" onClick={load} className="ml-3 underline">Retry</button>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="My Active Queue" value={loading ? "..." : String(activeQueue.length)} detail="Assigned tickets excluding closed work" icon={ClipboardCheck} />
        <KpiCard label="Critical Assigned" value={loading ? "..." : String(criticalAssigned.length)} detail="Critical priority tickets in queue" icon={AlertTriangle} tone={criticalAssigned.length ? "amber" : "green"} />
        <KpiCard label="In Progress" value={loading ? "..." : String(inProgress.length)} detail="Work currently underway" icon={Wrench} tone="cyan" />
        <KpiCard label="Resolved" value={loading ? "..." : String(resolved.length)} detail="Completed and awaiting closure" icon={ClipboardCheck} tone="green" />
        <KpiCard label="SLA Breached" value={loading ? "..." : String(breached.length)} detail="Past target resolution time" icon={ShieldAlert} tone={breached.length ? "amber" : "green"} />
        <KpiCard label="SLA At Risk" value={loading ? "..." : String(atRisk.length)} detail="Inside final SLA window" icon={Timer} tone={atRisk.length ? "amber" : "green"} />
        <KpiCard label="Escalated" value={loading ? "..." : String(escalated.length)} detail="Needs senior review or unblock" icon={Flag} tone={escalated.length ? "amber" : "green"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SlaAlertCard label="SLA Breached" value={loading ? "..." : String(breached.length)} detail="Resolution target has passed" icon={ShieldAlert} tone="red" />
        <SlaAlertCard label="SLA At Risk" value={loading ? "..." : String(atRisk.length)} detail="Tickets nearing target breach" icon={Timer} tone="yellow" />
        <SlaAlertCard label="Escalated" value={loading ? "..." : String(escalated.length)} detail="Tickets requiring escalation handling" icon={Flag} tone="orange" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Tickets by Status" loading={loading} empty={!hasStatusData}>
          <ResponsiveContainer width="100%" height={260} initialDimension={{ width: 480, height: 260 }}>
            <BarChart data={statusChartData} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#eff6ff" }} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
              <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Tickets by Category" loading={loading} empty={!hasCategoryData}>
          <ResponsiveContainer width="100%" height={220} initialDimension={{ width: 480, height: 220 }}>
            <PieChart>
              <Pie data={categoryChartData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={3}>
                {categoryChartData.map((entry, index) => <Cell key={entry.name} fill={categoryColors[index % categoryColors.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {categoryChartData.map((item, index) => (
              <div key={item.name} className="flex items-center gap-2 text-xs text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: categoryColors[index % categoryColors.length] }} />
                {item.name}: {item.value}
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <EngineerAssignedTickets />

      <RecentActivityPanel activities={activities} loading={loading} />
    </div>
  );
}

function ChartCard({ title, loading, empty, children }: { title: string; loading: boolean; empty: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 min-h-[260px]">
        {loading ? <div className="grid h-[260px] place-items-center text-sm text-slate-500">Loading chart data...</div> : null}
        {!loading && empty ? <div className="grid h-[260px] place-items-center text-sm text-slate-500">No ticket data available.</div> : null}
        {!loading && !empty ? children : null}
      </div>
    </section>
  );
}

function SlaAlertCard({ icon: Icon, label, value, detail, tone }: { icon: LucideIcon; label: string; value: string; detail: string; tone: "red" | "yellow" | "orange" }) {
  const tones = {
    red: "border-red-200 bg-red-50 text-red-700",
    yellow: "border-yellow-200 bg-yellow-50 text-yellow-800",
    orange: "border-orange-200 bg-orange-50 text-orange-700"
  };
  return (
    <section className={`rounded-lg border p-5 shadow-sm ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-2 text-3xl font-semibold">{value}</p>
        </div>
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-4 text-sm">{detail}</p>
    </section>
  );
}

function RecentActivityPanel({ activities, loading }: { activities: Activity[]; loading: boolean }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-lg font-semibold text-slate-950">Recent Activity</h2>
        <p className="mt-1 text-sm text-slate-500">Latest assignments, status changes, and escalations from your ticket queue.</p>
      </div>
      <div className="divide-y divide-slate-100">
        {activities.map((activity) => (
          <div key={activity.id} className="flex flex-col gap-2 p-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">#{activity.ticketId} {activity.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{statusLabel(activity.action)}: {activity.details}</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">{new Date(activity.timestamp).toLocaleString()}</span>
          </div>
        ))}
      </div>
      {!loading && !activities.length ? <div className="p-8 text-center text-sm text-slate-500">No recent ticket activity found.</div> : null}
      {loading ? <div className="p-8 text-center text-sm text-slate-500">Loading recent activity...</div> : null}
    </section>
  );
}
