"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, ClipboardList, Monitor, Timer, Wrench } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { normalizeTicket } from "@/lib/tickets";
import type { Ticket } from "@/types/ticket";
import { KpiCard } from "./KpiCard";
import { EmployeeMyTickets } from "@/components/tickets/EmployeeMyTickets";
import { StatusBadge } from "@/components/tickets/StatusBadge";
import { useNotificationMetrics } from "@/components/notifications/NotificationMetricsProvider";

type DashboardFilter = "all" | "open" | "active" | "sla" | "closed";
type Asset = { id: number; assetTag: string; assetName?: string; category?: string; type: string; status: string; assignedToLogin?: string; warrantyExpiry?: string };
type Notification = { id: number; title: string; body: string; readAt: string | null; createdAt: string };
const categoryColors = ["#2563eb", "#0891b2", "#16a34a", "#f59e0b"];

export function EmployeeDashboardClient() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<DashboardFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const user = getSessionUser();
  const { unreadCount } = useNotificationMetrics();

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [{ data: ticketData }, { data: assetData }, { data: notificationData }] = await Promise.all([
        api.get<{ data: any[] }>(`/tickets?requesterId=${user?.id ?? ""}`),
        api.get<{ data: Asset[] }>("/assets"),
        api.get<{ data: Notification[] }>("/notifications")
      ]);
      setTickets(ticketData.data.map(normalizeTicket));
      setAssets(assetData.data);
      setNotifications(notificationData.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load employee dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const mine = useMemo(() => {
    return tickets.filter((ticket) => !user?.id || ticket.requesterUserId === user.id);
  }, [tickets, user?.id]);

  const assignedAssets = useMemo(() => {
    const loginId = user?.email?.toLowerCase();
    return assets.filter((asset) => !loginId || asset.assignedToLogin === loginId);
  }, [assets, user?.email]);

  const openTickets = mine.filter((ticket) => ticket.status === "open");
  const activeTickets = mine.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
  const slaRisk = mine.filter((ticket) => ticket.priority === "critical" || ticket.slaRisk === "high" || ticket.status === "escalated");
  const closedTickets = mine.filter((ticket) => ["resolved", "closed"].includes(ticket.status));
  const avgResponse = activeTickets.length ? `${Math.max(15, activeTickets.length * 12)}m` : "0m";
  const statusChartData = [
    { name: "Open", value: mine.filter((ticket) => ticket.status === "open").length },
    { name: "Assigned", value: mine.filter((ticket) => ticket.status === "assigned").length },
    { name: "In Progress", value: mine.filter((ticket) => ticket.status === "in_progress").length },
    { name: "Resolved", value: mine.filter((ticket) => ticket.status === "resolved").length },
    { name: "Closed", value: mine.filter((ticket) => ticket.status === "closed").length }
  ];
  const categoryChartData = ["Hardware", "Software", "Network", "Other"].map((category) => ({
    name: category,
    value: mine.filter((ticket) => {
      const normalized = ticket.category.toLowerCase();
      if (category === "Other") return !["hardware", "software", "network"].includes(normalized);
      return normalized === category.toLowerCase();
    }).length
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

      {slaRisk.length ? (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-semibold">{slaRisk.length} ticket{slaRisk.length === 1 ? "" : "s"} need SLA attention.</span>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <button type="button" onClick={() => setFilter("open")} className="text-left">
          <KpiCard label="Open tickets" value={loading ? "..." : String(openTickets.length)} detail={`${activeTickets.length} active support items`} icon={ClipboardList} />
        </button>
        <button type="button" onClick={() => setFilter("all")} className="text-left">
          <KpiCard label="Assigned assets" value={loading ? "..." : String(assignedAssets.length)} detail={assignedAssets.slice(0, 3).map((asset) => asset.category || asset.type).join(", ") || "No assets assigned"} icon={Monitor} tone="cyan" />
        </button>
        <button type="button" onClick={() => setFilter("sla")} className="text-left">
          <KpiCard label="SLA warnings" value={loading ? "..." : String(slaRisk.length)} detail={slaRisk.length ? "Review critical or escalated tickets" : "Within current SLA window"} icon={Timer} tone={slaRisk.length ? "amber" : "green"} />
        </button>
        <button type="button" onClick={() => setFilter("closed")} className="text-left">
          <KpiCard label="Resolved tickets" value={loading ? "..." : String(closedTickets.length)} detail={`Avg response ${avgResponse}`} icon={Wrench} tone="green" />
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Tickets by Status" loading={loading} empty={!hasStatusData}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={statusChartData} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#eff6ff" }} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
              <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Tickets by Category" loading={loading} empty={!hasCategoryData}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={categoryChartData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
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

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <EmployeeMyTickets tickets={mine} filter={filter} loading={loading} error={error} onClearFilter={() => setFilter("all")} />
        <aside className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-950">Asset Summary</h2>
              <Link href="/employee/assets" className="text-sm font-semibold text-blue-700 hover:text-blue-900">View assets</Link>
            </div>
            <div className="mt-4 space-y-3">
              {assignedAssets.slice(0, 4).map((asset) => (
                <div key={asset.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{asset.assetTag}</p>
                      <p className="mt-1 text-xs text-slate-500">{asset.assetName || `${asset.category || asset.type}`}</p>
                    </div>
                    <StatusBadge status={asset.status} />
                  </div>
                </div>
              ))}
              {!loading && !assignedAssets.length ? <p className="text-sm text-slate-500">No assigned assets.</p> : null}
              {loading ? <p className="text-sm text-slate-500">Loading assets...</p> : null}
            </div>
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-950">Notifications</h2>
              <span className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700"><Bell className="h-3 w-3" />{unreadCount} unread</span>
            </div>
            <div className="mt-4 space-y-3">
              {notifications.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{item.body}</p>
                </div>
              ))}
              {!loading && !notifications.length ? <p className="text-sm text-slate-500">No notifications.</p> : null}
            </div>
          </section>
        </aside>
      </div>
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
