"use client";

import { useEffect, useState } from "react";
import { Activity, Bell, Boxes, Globe2, Mail, ShieldCheck, Tickets, Users } from "lucide-react";
import { api } from "@/lib/api";
import { KpiCard } from "./KpiCard";

type ReportStats = {
  totalTickets: number;
  openTickets: number;
  closedTickets: number;
  activeEngineers: number;
  slaCompliance: number;
  assetCount: number;
  securityAlerts: number;
  notifications: number;
};

type ServiceHealth = {
  key: "hpep-intranet" | "bhel-webmail";
  serviceName: string;
  status: "healthy" | "online" | "slow" | "offline";
  statusLabel: string;
  responseTimeMs: number | null;
  lastCheckedAt: string;
  lastSuccessfulCheckAt: string | null;
  availability: string;
  message: string;
};

const emptyStats: ReportStats = {
  totalTickets: 0,
  openTickets: 0,
  closedTickets: 0,
  activeEngineers: 0,
  slaCompliance: 100,
  assetCount: 0,
  securityAlerts: 0,
  notifications: 0
};

const serviceIcons = {
  "hpep-intranet": Globe2,
  "bhel-webmail": Mail
};

function formatTime(value: string | null) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function ServiceHealthCard({ service, loading }: { service?: ServiceHealth; loading: boolean }) {
  const Icon = service ? serviceIcons[service.key] : Activity;
  const status = service?.status || "offline";
  const tone = status === "healthy" || status === "online" ? "green" : status === "slow" ? "amber" : "red";
  const toneClasses = {
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700"
  };
  const badgeClasses = {
    green: "border-green-200 bg-green-50 text-green-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700"
  };
  const dotClasses = {
    green: "bg-green-500",
    amber: "bg-amber-500",
    red: "bg-red-500"
  };

  return (
    <article className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{service?.serviceName || "Service Health"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${dotClasses[tone]}`} />
            <p className="text-2xl font-semibold text-slate-950">{loading ? "Checking..." : service?.statusLabel || "Offline"}</p>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeClasses[tone]}`}>
              {loading ? "Checking" : service?.statusLabel || "Offline"}
            </span>
          </div>
        </div>
        <span className={`rounded-md p-3 ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-4 space-y-1 text-sm text-slate-600">
        <div className="flex items-center justify-between gap-3">
          <span>{service?.responseTimeMs === null ? service?.message || "Connection Failed" : "Response Time"}</span>
          <span className="font-semibold text-slate-800">{service?.responseTimeMs === null ? "" : `${service?.responseTimeMs || 0} ms`}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Last Checked</span>
          <span className="font-semibold text-slate-800">{formatTime(service?.lastCheckedAt || null)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Availability</span>
          <span className="font-semibold text-slate-800">{service?.availability || "N/A"}</span>
        </div>
      </div>
    </article>
  );
}

export function AdminMetrics() {
  const [stats, setStats] = useState<ReportStats>(emptyStats);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceLoading, setServiceLoading] = useState(true);
  const [error, setError] = useState("");
  const [serviceError, setServiceError] = useState("");

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

  useEffect(() => {
    let active = true;

    function loadServiceHealth() {
      setServiceLoading(true);
      api.get<{ data: ServiceHealth[] }>("/service-health")
        .then(({ data }) => {
          if (!active) return;
          setServices(data.data || []);
          setServiceError("");
        })
        .catch((requestError) => {
          if (!active) return;
          setServiceError(requestError instanceof Error ? requestError.message : "Could not load service health.");
        })
        .finally(() => {
          if (active) setServiceLoading(false);
        });
    }

    loadServiceHealth();
    const refresh = window.setInterval(loadServiceHealth, 60000);
    return () => {
      active = false;
      window.clearInterval(refresh);
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
      {serviceError ? <p className="rounded-lg border border-amber-200 bg-white px-4 py-3 text-sm text-amber-700">{serviceError}</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total tickets" value={String(stats.totalTickets)} detail={`${stats.openTickets} open, ${stats.closedTickets} closed`} icon={Tickets} />
        <KpiCard label="Active engineers" value={String(stats.activeEngineers)} detail="Assignable support users" icon={Users} tone="cyan" />
        <KpiCard label="SLA compliance" value={`${stats.slaCompliance}%`} detail="Based on Oracle SLA status" icon={Activity} tone="green" />
        <KpiCard label="Assets" value={String(stats.assetCount)} detail={`${stats.notifications} unread alerts`} icon={Boxes} tone="amber" />
        <KpiCard label="Security events" value={String(stats.securityAlerts)} detail="Audit/security activity" icon={ShieldCheck} tone="amber" />
        <KpiCard label="Notifications" value={String(stats.notifications)} detail="Unread Oracle notifications" icon={Bell} tone="blue" />
        <ServiceHealthCard service={services.find((service) => service.key === "hpep-intranet")} loading={serviceLoading} />
        <ServiceHealthCard service={services.find((service) => service.key === "bhel-webmail")} loading={serviceLoading} />
      </div>
    </div>
  );
}
