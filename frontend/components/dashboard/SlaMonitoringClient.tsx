"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Clock3, Gauge, ShieldCheck } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { KpiCard } from "./KpiCard";
import { StatusBadge } from "@/components/tickets/StatusBadge";

type PriorityMetric = { priority: string; total: number; withinSla?: number; breaches: number; atRisk: number; compliance: number };
type BreachRiskTicket = { id: number; title: string; priority: string; assignedEngineer: string; slaRemaining: string; status: string };
type EngineerPerformance = { engineer: string; assignedTickets: number; resolvedTickets: number; compliance: number };
type TrendPoint = { label: string; value: number };
type SlaReport = {
  stats: {
    slaCompliance: number | null;
    withinSla: number;
    breaches: number;
    atRisk: number;
    averageResolutionTimeMinutes: number | null;
    averageResponseTimeMinutes?: number | null;
    trackableTickets: number;
  };
  priorityMetrics: PriorityMetric[];
  breachRiskQueue: BreachRiskTicket[];
  engineerPerformance: EngineerPerformance[];
  trend: TrendPoint[];
};

const emptyReport: SlaReport = {
  stats: { slaCompliance: null, withinSla: 0, breaches: 0, atRisk: 0, averageResolutionTimeMinutes: null, averageResponseTimeMinutes: null, trackableTickets: 0 },
  priorityMetrics: [],
  breachRiskQueue: [],
  engineerPerformance: [],
  trend: []
};

export function SlaMonitoringClient() {
  const [report, setReport] = useState<SlaReport>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get<{ data?: SlaReport }>("/reports/sla")
      .then(({ data }) => {
        if (!active) return;
        setReport({ ...emptyReport, ...(data.data || {}) });
        setError("");
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "SLA report could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Loading SLA monitoring...</div>;
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-white p-6 text-sm text-red-700 shadow-sm">{error}</div>;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Overall SLA Compliance"
          value={report.stats.trackableTickets ? `${report.stats.slaCompliance ?? 0}%` : "0%"}
          detail={`${report.stats.withinSla} within SLA of ${report.stats.trackableTickets} tickets`}
          icon={ShieldCheck}
          tone="green"
        />
        <KpiCard label="SLA Breaches" value={String(report.stats.breaches)} detail="Tickets past SLA deadline" icon={AlertTriangle} tone="amber" />
        <KpiCard label="Tickets At Risk" value={String(report.stats.atRisk)} detail="Active tickets nearing breach" icon={Gauge} tone="amber" />
        <KpiCard
          label="Average Resolution Time"
          value={report.stats.averageResolutionTimeMinutes === null ? "0m" : `${report.stats.averageResolutionTimeMinutes}m`}
          detail={report.stats.averageResolutionTimeMinutes === null ? "No resolved tickets yet" : "Created to resolved timestamp"}
          icon={Clock3}
          tone="cyan"
        />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Priority SLA Metrics</h2>
            <p className="mt-1 text-sm text-slate-500">Compliance and risk by enterprise priority class.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {report.priorityMetrics.map((metric) => (
            <article key={metric.priority} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold capitalize text-slate-950">{metric.priority}</p>
                <StatusBadge status={metric.priority} />
              </div>
              <p className="mt-3 text-2xl font-semibold text-slate-950">{metric.compliance}%</p>
              <p className="mt-1 text-sm text-slate-600">{metric.total} tickets, {metric.withinSla || 0} within SLA, {metric.breaches} breaches, {metric.atRisk} at risk</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">SLA Trend - Last 7 Days</h2>
        <div className="mt-4 h-72">
          {report.trend.length ? (
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 288 }}>
              <LineChart data={report.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value) => [`${value}%`, "Compliance"]} />
                <Line type="monotone" dataKey="value" stroke="#1d4ed8" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState message="No ticket history is available yet." />}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <SlaRiskQueue tickets={report.breachRiskQueue} />
        <EngineerPerformanceTable engineers={report.engineerPerformance} />
      </div>
    </div>
  );
}

function SlaRiskQueue({ tickets }: { tickets: BreachRiskTicket[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-base font-semibold text-slate-950">Breach Risk Queue</h2>
        <p className="mt-1 text-sm text-slate-500">Active tickets closest to SLA breach.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Ticket ID</th>
              <th className="px-5 py-3">Title</th>
              <th className="px-5 py-3">Priority</th>
              <th className="px-5 py-3">Assigned Engineer</th>
              <th className="px-5 py-3">SLA Remaining</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tickets.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-blue-50/50">
                <td className="px-5 py-4 font-semibold text-slate-950">#{ticket.id}</td>
                <td className="px-5 py-4 text-slate-700">{ticket.title}</td>
                <td className="px-5 py-4"><StatusBadge status={ticket.priority} /></td>
                <td className="px-5 py-4 text-slate-700">{ticket.assignedEngineer}</td>
                <td className="px-5 py-4"><StatusBadge status={ticket.status} /> <span className="ml-2 text-slate-700">{ticket.slaRemaining}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!tickets.length ? <EmptyState message="No tickets are currently at SLA risk." /> : null}
    </section>
  );
}

function EngineerPerformanceTable({ engineers }: { engineers: EngineerPerformance[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-base font-semibold text-slate-950">Engineer SLA Performance</h2>
        <p className="mt-1 text-sm text-slate-500">Assigned workload and SLA compliance by engineer.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Engineer</th>
              <th className="px-5 py-3">Assigned Tickets</th>
              <th className="px-5 py-3">Resolved Tickets</th>
              <th className="px-5 py-3">SLA Compliance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {engineers.map((engineer) => (
              <tr key={engineer.engineer} className="hover:bg-blue-50/50">
                <td className="px-5 py-4 font-semibold text-slate-950">{engineer.engineer}</td>
                <td className="px-5 py-4 text-slate-700">{engineer.assignedTickets}</td>
                <td className="px-5 py-4 text-slate-700">{engineer.resolvedTickets}</td>
                <td className="px-5 py-4"><span className="font-semibold text-slate-950">{engineer.compliance}%</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!engineers.length ? <EmptyState message="No engineer SLA performance data is available yet." /> : null}
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="grid min-h-32 place-items-center p-6 text-center text-sm text-slate-500">
      <div>
        <Activity className="mx-auto mb-2 h-5 w-5 text-slate-400" />
        {message}
      </div>
    </div>
  );
}
