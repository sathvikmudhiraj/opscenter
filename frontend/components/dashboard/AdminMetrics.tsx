"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Bell, Boxes, Clock3, Gauge, ShieldCheck, Tickets, Users } from "lucide-react";
import { api } from "@/lib/api";
import { KpiCard } from "./KpiCard";
import { useNotificationMetrics } from "@/components/notifications/NotificationMetricsProvider";

type ReportStats = {
  totalTickets: number;
  openTickets: number;
  closedTickets: number;
  activeEngineers: number;
  slaCompliance: number | null | { value: number | null; label: string; subtitle: string };
  slaBreached: number;
  slaAtRisk: number;
  averageResolutionTimeMinutes: number | null;
  slaTrackableTickets: number;
  assetCount: number;
  securityAlerts: number;
  notifications: number;
};

const emptyStats: ReportStats = {
  totalTickets: 0,
  openTickets: 0,
  closedTickets: 0,
  activeEngineers: 0,
  slaCompliance: null,
  slaBreached: 0,
  slaAtRisk: 0,
  averageResolutionTimeMinutes: null,
  slaTrackableTickets: 0,
  assetCount: 0,
  securityAlerts: 0,
  notifications: 0
};

export function AdminMetrics() {
  const [stats, setStats] = useState<ReportStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { unreadCount } = useNotificationMetrics();

  useEffect(() => {
    let active = true;
    api.get<{ data?: { stats?: Partial<ReportStats> } }>("/reports")
      .then(({ data }) => {
        if (!active) return;
        setStats({ ...emptyStats, ...(data.data?.stats || {}) });
        setError("");
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "Could not load dashboard metrics.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-lg border border-white/70 bg-white/70" />
        ))}
      </div>
    );
  }

  return (
      <div className="space-y-3">
      {error ? <p className="rounded-lg border border-amber-200 bg-white px-4 py-3 text-sm text-amber-700">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total tickets" value={String(stats.totalTickets)} detail={`${stats.openTickets} open, ${stats.closedTickets} closed`} icon={Tickets} />
        <KpiCard label="Active engineers" value={String(stats.activeEngineers)} detail="Assignable support users" icon={Users} tone="cyan" />
        <KpiCard
          label="SLA compliance"
          value={formatSlaCompliance(stats.slaCompliance)}
          detail={stats.slaTrackableTickets ? `${stats.slaTrackableTickets} SLA-trackable tickets` : "No SLA data"}
          icon={Activity}
          tone="green"
        />
        <KpiCard label="SLA breached" value={String(stats.slaBreached)} detail="Active or resolved after due time" icon={AlertTriangle} tone="amber" />
        <KpiCard label="SLA at risk" value={String(stats.slaAtRisk)} detail="Active tickets inside final SLA window" icon={Gauge} tone="amber" />
        <KpiCard
          label="Avg. resolution"
          value={stats.averageResolutionTimeMinutes === null ? "No SLA data" : `${stats.averageResolutionTimeMinutes}m`}
          detail="Created to resolved timestamp"
          icon={Clock3}
          tone="cyan"
        />
        <KpiCard label="Assets" value={String(stats.assetCount)} detail="Enterprise inventory" icon={Boxes} tone="amber" />
        <KpiCard label="Security events" value={String(stats.securityAlerts)} detail="Audit/security activity" icon={ShieldCheck} tone="amber" />
        <KpiCard label="Notifications" value={String(unreadCount)} detail="Unread Oracle notifications" icon={Bell} tone="blue" />
      </div>
    </div>
  );
}

function formatSlaCompliance(sla: ReportStats["slaCompliance"]) {
  if (sla === null || sla === undefined) return "No SLA data";
  if (typeof sla === "object") return sla.label;
  return `${sla}%`;
}
