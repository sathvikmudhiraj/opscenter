"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Download, Globe2, Mail, Network, ShieldCheck, Timer, WifiOff } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";

type ServiceKey = "hpep-intranet" | "bhel-webmail" | "network-health";
type RangeKey = "24h" | "7d" | "30d";
type StatusFilter = "all" | "healthy" | "degraded" | "critical" | "no_data";

type ServiceHealth = {
  key: ServiceKey;
  serviceName: string;
  status: "healthy" | "online" | "slow" | "offline" | "unknown";
  statusLabel: string;
  responseTimeMs: number | null;
  latencyMs: number | null;
  packetLossPercent: number | null;
  dnsStatus: string | null;
  dnsResponseTimeMs: number | null;
  lastCheckedAt: string;
  availabilityPercent: number;
  incidentCount: number;
  message: string;
  internetStatus?: string;
  overallNetworkHealth?: string;
};

type HistoryPoint = {
  id: number;
  serviceKey: ServiceKey;
  serviceName: string;
  checkedAt: string;
  status: string;
  responseTimeMs: number | null;
  latencyMs: number | null;
  packetLossPercent: number | null;
  dnsStatus: string | null;
  dnsResponseTimeMs: number | null;
  availabilityPercent: number;
  errorMessage: string | null;
};

type HeatmapPoint = {
  serviceKey: ServiceKey;
  serviceName: string;
  bucket: string;
  totalChecks: number;
  healthyChecks: number;
  degradedChecks: number;
  criticalChecks: number;
  status: "healthy" | "degraded" | "critical" | "no_data";
};

type Incident = {
  id: number;
  serviceKey: ServiceKey;
  serviceName: string;
  checkedAt: string;
  status: string;
  previousStatus: string | null;
  type: string;
  message: string;
  responseTimeMs: number | null;
  latencyMs: number | null;
  packetLossPercent: number | null;
};

type ReportRow = {
  serviceKey: ServiceKey;
  serviceName: string;
  availabilityPercent: number;
  averageResponseTimeMs: number | null;
  totalDowntimeMinutes: number;
  incidentCount: number;
  totalChecks: number;
};

const ranges: RangeKey[] = ["24h", "7d", "30d"];
const serviceOrder: ServiceKey[] = ["hpep-intranet", "bhel-webmail", "network-health"];
const icons = { "hpep-intranet": Globe2, "bhel-webmail": Mail, "network-health": Network };

export function InfrastructureMonitoringPage() {
  const [range, setRange] = useState<RangeKey>("24h");
  const [serviceFilter, setServiceFilter] = useState<ServiceKey | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [current, setCurrent] = useState<ServiceHealth[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshMs, setRefreshMs] = useState(60000);

  async function load(selectedRange = range) {
    if (!getSessionToken()) {
      setError("");
      setLoading(false);
      return;
    }
    try {
      const [currentResp, historyResp, heatmapResp, incidentsResp, reportsResp] = await Promise.all([
        api.get<{ data: ServiceHealth[] }>("/infrastructure/current"),
        api.get<{ data: HistoryPoint[] }>(`/infrastructure/history?range=${selectedRange}`),
        api.get<{ data: HeatmapPoint[] }>(`/infrastructure/heatmap?range=${selectedRange}`),
        api.get<{ data: Incident[] }>(`/infrastructure/incidents?range=${selectedRange}`),
        api.get<{ data: ReportRow[] }>(`/infrastructure/reports?range=${selectedRange}`)
      ]);
      setCurrent(currentResp.data.data || []);
      setHistory(historyResp.data.data || []);
      setHeatmap(heatmapResp.data.data || []);
      setIncidents(incidentsResp.data.data || []);
      setReports(reportsResp.data.data || []);
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Infrastructure monitoring could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function guardedLoad() {
      if (active) await load();
    }
    api.get<{ data?: { infrastructure?: { monitoringIntervalSeconds?: number } } }>("/settings")
      .then(({ data }) => {
        const seconds = Number(data.data?.infrastructure?.monitoringIntervalSeconds || 60);
        if (active) setRefreshMs(Math.max(10000, seconds * 1000));
      })
      .catch(() => undefined);
    guardedLoad();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const refresh = window.setInterval(() => load(range), refreshMs);
    return () => window.clearInterval(refresh);
  }, [refreshMs, range]);

  useEffect(() => {
    setLoading(true);
    load(range);
  }, [range]);

  const overview = useMemo(() => {
    const healthy = current.filter((item) => item.status === "healthy" || item.status === "online").length;
    const degraded = current.filter((item) => item.status === "slow" || item.status === "unknown").length;
    const offline = current.filter((item) => item.status === "offline").length;
    const responseValues = current.map((item) => item.responseTimeMs ?? item.latencyMs).filter((item): item is number => item !== null && item !== undefined);
    const network = current.find((item) => item.key === "network-health");
    return {
      total: current.length,
      healthy,
      degraded,
      offline,
      incidents: current.reduce((sum, item) => sum + item.incidentCount, 0),
      averageResponse: responseValues.length ? Math.round(responseValues.reduce((sum, value) => sum + value, 0) / responseValues.length) : 0,
      networkScore: network ? Math.max(0, Math.round(network.availabilityPercent - (network.packetLossPercent || 0))) : 0
    };
  }, [current]);

  const historyByService = useMemo(() => Object.fromEntries(serviceOrder.map((key) => [
    key,
    history.filter((point) => point.serviceKey === key)
  ])) as Record<ServiceKey, HistoryPoint[]>, [history]);

  const filteredHeatmap = heatmap.filter((point) => {
    if (serviceFilter !== "all" && point.serviceKey !== serviceFilter) return false;
    if (statusFilter !== "all" && point.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-800 bg-slate-950 p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Enterprise NOC</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Infrastructure Monitoring Console</h2>
          </div>
          <RangeSelector value={range} onChange={setRange} />
        </div>
        {error ? <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        <OverviewCard label="Total Services" value={String(overview.total)} icon={Activity} />
        <OverviewCard label="Healthy" value={String(overview.healthy)} icon={ShieldCheck} tone="green" />
        <OverviewCard label="Degraded" value={String(overview.degraded)} icon={AlertTriangle} tone="yellow" />
        <OverviewCard label="Offline" value={String(overview.offline)} icon={WifiOff} tone="red" />
        <OverviewCard label="Active Incidents" value={String(overview.incidents)} icon={AlertTriangle} tone="yellow" />
        <OverviewCard label="Avg Response" value={`${overview.averageResponse} ms`} icon={Timer} />
        <OverviewCard label="Network Score" value={`${overview.networkScore}%`} icon={Network} tone="green" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {serviceOrder.map((key) => (
          <ServiceDashboard
            key={key}
            serviceKey={key}
            service={current.find((item) => item.key === key)}
            history={historyByService[key] || []}
            range={range}
            loading={loading}
          />
        ))}
      </div>

      <HeatmapSection
        points={filteredHeatmap}
        range={range}
        serviceFilter={serviceFilter}
        statusFilter={statusFilter}
        onServiceFilter={setServiceFilter}
        onStatusFilter={setStatusFilter}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_1.25fr]">
        <IncidentTimeline incidents={incidents} />
        <AvailabilityReports reports={reports} />
      </div>
    </div>
  );
}

function RangeSelector({ value, onChange }: { value: RangeKey; onChange: (value: RangeKey) => void }) {
  return (
    <div className="inline-flex rounded-md border border-slate-700 bg-slate-900 p-1">
      {ranges.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={`rounded px-3 py-1.5 text-xs font-semibold transition ${value === item ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:bg-slate-800"}`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function OverviewCard({ label, value, icon: Icon, tone = "blue" }: { label: string; value: string; icon: React.ElementType; tone?: "blue" | "green" | "yellow" | "red" }) {
  const tones = {
    blue: "text-cyan-200 bg-cyan-400/10 border-cyan-400/20",
    green: "text-emerald-200 bg-emerald-400/10 border-emerald-400/20",
    yellow: "text-amber-200 bg-amber-400/10 border-amber-400/20",
    red: "text-red-200 bg-red-400/10 border-red-400/20"
  };
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <span className={`rounded-md border p-2 ${tones[tone]}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </article>
  );
}

function ServiceDashboard({ serviceKey, service, history, range, loading }: { serviceKey: ServiceKey; service?: ServiceHealth; history: HistoryPoint[]; range: RangeKey; loading: boolean }) {
  const key = service?.key || serviceKey;
  const Icon = icons[key];
  const chartData = history.map((point) => ({
    label: new Date(point.checkedAt).toLocaleDateString([], range === "24h" ? { hour: "2-digit", minute: "2-digit" } : { month: "short", day: "numeric" }),
    value: key === "network-health" ? point.latencyMs ?? point.responseTimeMs ?? 0 : point.responseTimeMs ?? 0,
    status: point.status
  }));

  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-cyan-300" />
            <h3 className="font-semibold text-white">{service?.serviceName || "Loading service"}</h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">{service?.message || "Waiting for Oracle monitoring data"}</p>
        </div>
        <StatusBadge status={service?.status || "unknown"} label={loading ? "Checking" : service?.statusLabel || "Unknown"} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {key === "network-health" ? (
          <>
            <Metric label="Internet" value={service?.internetStatus || "N/A"} />
            <Metric label="Latency" value={formatMs(service?.latencyMs)} />
            <Metric label="Packet Loss" value={`${service?.packetLossPercent ?? 0}%`} />
            <Metric label="DNS" value={service?.dnsStatus || "N/A"} />
            <Metric label="DNS Time" value={formatMs(service?.dnsResponseTimeMs)} />
            <Metric label="Health Score" value={`${service ? Math.max(0, Math.round(service.availabilityPercent - (service.packetLossPercent || 0))) : 0}%`} />
          </>
        ) : (
          <>
            <Metric label="Availability" value={`${service?.availabilityPercent ?? 0}%`} />
            <Metric label="Response Time" value={formatMs(service?.responseTimeMs)} />
            <Metric label="Last Checked" value={formatDate(service?.lastCheckedAt)} />
            <Metric label="Incidents" value={String(service?.incidentCount ?? 0)} />
          </>
        )}
      </div>
      <div className="mt-5 h-52">
        {chartData.length ? <HistoryChart data={chartData} /> : <EmptyChart />}
      </div>
    </article>
  );
}

function HistoryChart({ data }: { data: Array<{ label: string; value: number; status: string }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
        <Tooltip contentStyle={{ background: "#020617", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0" }} />
        <Line type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2} dot={(props: any) => <OutageDot {...props} />} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function HeatmapSection({ points, range, serviceFilter, statusFilter, onServiceFilter, onStatusFilter }: {
  points: HeatmapPoint[];
  range: RangeKey;
  serviceFilter: ServiceKey | "all";
  statusFilter: StatusFilter;
  onServiceFilter: (value: ServiceKey | "all") => void;
  onStatusFilter: (value: StatusFilter) => void;
}) {
  const grouped = serviceOrder.map((key) => ({
    key,
    name: points.find((point) => point.serviceKey === key)?.serviceName || labelForService(key),
    points: points.filter((point) => point.serviceKey === key)
  })).filter((item) => serviceFilter === "all" || item.key === serviceFilter);

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Infrastructure Heat Map</h2>
          <p className="mt-1 text-sm text-slate-400">{range} health blocks from Oracle monitoring history</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={serviceFilter} onChange={(event) => onServiceFilter(event.target.value as ServiceKey | "all")} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100">
            <option value="all">All services</option>
            {serviceOrder.map((key) => <option key={key} value={key}>{labelForService(key)}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => onStatusFilter(event.target.value as StatusFilter)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100">
            <option value="all">All statuses</option>
            <option value="healthy">Healthy / Online</option>
            <option value="degraded">Slow / Degraded</option>
            <option value="critical">Offline / Critical</option>
            <option value="no_data">No data</option>
          </select>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {grouped.map((service) => (
          <div key={service.key}>
            <p className="mb-2 text-sm font-semibold text-slate-200">{service.name}</p>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${range === "24h" ? 24 : range === "7d" ? 7 : 30}, minmax(0, 1fr))` }}>
              {service.points.length ? service.points.map((point) => (
                <div key={`${point.serviceKey}-${point.bucket}`} title={`${point.bucket}: ${point.status}`} className={`h-5 rounded-sm ${heatClass(point.status)}`} />
              )) : Array.from({ length: range === "24h" ? 24 : range === "7d" ? 7 : 30 }).map((_, index) => (
                <div key={index} className="h-5 rounded-sm bg-slate-700" title="No data" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function IncidentTimeline({ incidents }: { incidents: Incident[] }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950 p-5">
      <h2 className="text-lg font-semibold text-white">Incident Timeline</h2>
      <div className="mt-4 max-h-96 space-y-3 overflow-auto">
        {incidents.map((incident) => (
          <div key={incident.id} className="rounded-md border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-100">{incident.type}</p>
                <p className="mt-1 text-sm text-slate-400">{incident.serviceName} - {incident.message}</p>
              </div>
              <span className="text-xs text-slate-500">{formatDate(incident.checkedAt)}</span>
            </div>
          </div>
        ))}
        {!incidents.length ? <p className="text-sm text-slate-500">No incidents in this range.</p> : null}
      </div>
    </section>
  );
}

function AvailabilityReports({ reports }: { reports: ReportRow[] }) {
  function exportCsv() {
    const header = "Service,Availability %,Average Response ms,Total Downtime Minutes,Incident Count,Checks";
    const rows = reports.map((row) => [
      row.serviceName,
      row.availabilityPercent,
      row.averageResponseTimeMs ?? "",
      row.totalDowntimeMinutes,
      row.incidentCount,
      row.totalChecks
    ].join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "infrastructure-availability.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    window.print();
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-white">Availability Reports</h2>
        <div className="flex gap-2">
          <button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-md bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950"><Download className="h-4 w-4" /> CSV</button>
          <button type="button" onClick={exportPdf} className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100"><Download className="h-4 w-4" /> PDF</button>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-3 pr-4">Service</th>
              <th className="py-3 pr-4">Availability</th>
              <th className="py-3 pr-4">Avg Response</th>
              <th className="py-3 pr-4">Downtime</th>
              <th className="py-3 pr-4">Incidents</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {reports.map((row) => (
              <tr key={row.serviceKey}>
                <td className="py-3 pr-4 font-semibold text-white">{row.serviceName}</td>
                <td className="py-3 pr-4">{row.availabilityPercent}%</td>
                <td className="py-3 pr-4">{formatMs(row.averageResponseTimeMs)}</td>
                <td className="py-3 pr-4">{row.totalDowntimeMinutes}m</td>
                <td className="py-3 pr-4">{row.incidentCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2"><p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 truncate text-sm font-semibold text-slate-100">{value}</p></div>;
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const classes = status === "healthy" || status === "online" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : status === "slow" || status === "unknown" ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : "border-red-400/40 bg-red-400/10 text-red-200";
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>{label}</span>;
}

function OutageDot(props: any) {
  const incident = props.payload?.status === "offline" || props.payload?.status === "slow" || props.payload?.status === "unknown";
  return <circle cx={props.cx} cy={props.cy} r={incident ? 4 : 2} fill={incident ? "#f97316" : "#22d3ee"} />;
}

function EmptyChart() {
  return <div className="grid h-full place-items-center rounded-md border border-slate-800 text-xs text-slate-500">Waiting for Oracle history</div>;
}

function heatClass(status: string) {
  if (status === "healthy") return "bg-emerald-500";
  if (status === "degraded") return "bg-amber-400";
  if (status === "critical") return "bg-red-500";
  return "bg-slate-700";
}

function labelForService(key: ServiceKey) {
  if (key === "hpep-intranet") return "HPEP Intranet";
  if (key === "bhel-webmail") return "BHEL Webmail";
  return "Network Health";
}

function formatMs(value?: number | null) {
  return value === null || value === undefined ? "N/A" : `${value} ms`;
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
