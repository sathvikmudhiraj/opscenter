"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, Globe2, Mail, Network } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { getSessionToken } from "@/lib/auth";

type ServiceKey = "hpep-intranet" | "bhel-webmail" | "network-health";
type RangeKey = "24h" | "7d" | "30d";

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
  availability: string;
  availabilityPercent: number;
  incidentCount: number;
  message: string;
  supportTeam?: string;
  contactNumber?: string;
  supportEmail?: string;
  escalationNote?: string;
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

const serviceOrder: ServiceKey[] = ["hpep-intranet", "bhel-webmail", "network-health"];
const ranges: RangeKey[] = ["24h", "7d", "30d"];
const icons = {
  "hpep-intranet": Globe2,
  "bhel-webmail": Mail,
  "network-health": Network
};

export function InfrastructureMonitoring() {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [range, setRange] = useState<RangeKey>("24h");
  const [refreshMs, setRefreshMs] = useState(60000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const inFlightRef = useRef(false);
  const initialLoadRef = useRef(false);

  async function load(selectedRange = range) {
    if (inFlightRef.current) return;
    if (!getSessionToken()) {
      setError("");
      setLoading(false);
      return;
    }
    inFlightRef.current = true;
    try {
      const [{ data: currentData }, { data: historyData }] = await Promise.all([
        api.get<{ data: ServiceHealth[] }>("/service-health/current"),
        api.get<{ data: HistoryPoint[] }>(`/service-health/history?range=${selectedRange}`)
      ]);
      setServices(currentData.data || []);
      setHistory(historyData.data || []);
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Infrastructure monitoring could not be loaded.");
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }

  useEffect(() => {
    let active = true;

    async function guardedLoad() {
      if (!active) return;
      await load();
    }

    api.get<{ data?: { infrastructure?: { monitoringIntervalSeconds?: number } } }>("/settings")
      .then(({ data }) => {
        const seconds = Number(data.data?.infrastructure?.monitoringIntervalSeconds || 60);
        if (active) setRefreshMs(Math.max(10000, seconds * 1000));
      })
      .catch(() => undefined);
    initialLoadRef.current = true;
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
    if (!getSessionToken()) return;
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
    setLoading(true);
    load(range);
  }, [range]);

  const groupedHistory = useMemo(() => {
    return Object.fromEntries(serviceOrder.map((key) => [
      key,
      history.filter((point) => point.serviceKey === key)
    ])) as Record<ServiceKey, HistoryPoint[]>;
  }, [history]);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 shadow-sm">
      <div className="border-b border-slate-800 px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Infrastructure Monitoring</p>
            <h2 className="mt-1 text-lg font-semibold text-white">NOC Service Health</h2>
          </div>
          <div className="inline-flex rounded-md border border-slate-700 bg-slate-900 p-1">
            {ranges.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRange(item)}
                className={`rounded px-3 py-1.5 text-xs font-semibold transition ${range === item ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:bg-slate-800"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        {error ? <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}
      </div>
      <div className="grid gap-4 p-5 xl:grid-cols-3">
        {serviceOrder.map((key) => (
          <MonitoringPanel
            key={key}
            serviceKey={key}
            service={services.find((item) => item.key === key)}
            history={groupedHistory[key] || []}
            loading={loading}
          />
        ))}
      </div>
    </section>
  );
}

function MonitoringPanel({ serviceKey, service, history, loading }: { serviceKey: ServiceKey; service?: ServiceHealth; history: HistoryPoint[]; loading: boolean }) {
  const key = service?.key || serviceKey;
  const Icon = icons[key];
  const status = service?.status || "unknown";
  const chartData = history.map((point) => ({
    label: new Date(point.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    value: key === "network-health" ? point.latencyMs ?? point.responseTimeMs ?? 0 : point.responseTimeMs ?? 0,
    status: point.status
  }));

  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-cyan-300" />
            <h3 className="font-semibold text-white">{service?.serviceName || "Checking service"}</h3>
          </div>
          <p className="mt-1 text-xs text-slate-400">{service?.message || "Waiting for current status"}</p>
        </div>
        <StatusBadge status={status} label={loading ? "Checking" : service?.statusLabel || "Unknown"} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        {key === "network-health" ? (
          <>
            <Metric label="Internet" value={service?.internetStatus || "N/A"} />
            <Metric label="Latency" value={formatMs(service?.latencyMs)} />
            <Metric label="Packet Loss" value={`${service?.packetLossPercent ?? 0}%`} />
            <Metric label="DNS" value={service?.dnsStatus || "N/A"} />
            <Metric label="DNS Time" value={formatMs(service?.dnsResponseTimeMs)} />
            <Metric label="Overall" value={service?.overallNetworkHealth || service?.statusLabel || "Unknown"} />
          </>
        ) : (
          <>
            <Metric label="Availability" value={`${service?.availabilityPercent ?? 0}%`} />
            <Metric label="Response" value={formatMs(service?.responseTimeMs)} />
            <Metric label="Last Checked" value={formatTime(service?.lastCheckedAt)} />
            <Metric label="Incidents" value={String(service?.incidentCount ?? 0)} />
          </>
        )}
      </div>

      {isActionRequired(status) ? (
        <ActionRequired service={service} serviceKey={key} />
      ) : service?.supportTeam || defaultSupportFor(key).supportTeam ? (
        <p className="mt-4 rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-400">
          Support: {service?.supportTeam || defaultSupportFor(key).supportTeam}{service?.contactNumber ? ` | Ext: ${service.contactNumber}` : ""}
        </p>
      ) : null}

      <div className="mt-4 h-32">
        {chartData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} width={34} />
              <Tooltip contentStyle={{ background: "#020617", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0" }} />
              <Line type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2} dot={(props: any) => <OutageDot {...props} />} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center rounded-md border border-slate-800 text-xs text-slate-500">Waiting for Oracle history</div>
        )}
      </div>
    </article>
  );
}

function OutageDot(props: any) {
  const status = props.payload?.status;
  const incident = status === "offline" || status === "slow" || status === "unknown";
  return <circle cx={props.cx} cy={props.cy} r={incident ? 4 : 2} fill={incident ? "#f97316" : "#22d3ee"} />;
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const classes = status === "healthy" || status === "online"
    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
    : status === "slow" || status === "unknown"
      ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
      : "border-red-400/40 bg-red-400/10 text-red-200";
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>{label}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function ActionRequired({ service, serviceKey }: { service?: Partial<ServiceHealth>; serviceKey: ServiceKey }) {
  const fallback = defaultSupportFor(serviceKey);
  const supportTeam = service?.supportTeam || fallback.supportTeam;
  const contactNumber = service?.contactNumber || fallback.contactNumber;
  const supportEmail = service?.supportEmail || "";
  const escalationNote = service?.escalationNote || fallback.escalationNote;
  const configured = Boolean(supportTeam || contactNumber || supportEmail || escalationNote);
  return (
    <div className="mt-4 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-3 text-sm">
      <p className="font-semibold text-amber-100">Action Required</p>
      {configured ? (
        <div className="mt-2 space-y-1 text-xs font-semibold text-amber-50/90">
          <p>Contact: {supportTeam || "Support contact not configured"}</p>
          <p>Phone/Ext: {contactNumber || "Support contact not configured"}</p>
          {supportEmail ? <p>Email: {supportEmail}</p> : null}
          {escalationNote ? <p>Note: {escalationNote}</p> : null}
        </div>
      ) : (
        <p className="mt-2 text-xs font-semibold text-amber-100">Support contact not configured</p>
      )}
    </div>
  );
}

function defaultSupportFor(key: ServiceKey) {
  if (key === "hpep-intranet") return { supportTeam: "IT Network Team", contactNumber: "", escalationNote: "Contact IT Network Team if HPEP Intranet is slow, offline, or down." };
  if (key === "bhel-webmail") return { supportTeam: "Mail/Admin Team", contactNumber: "", escalationNote: "Contact Mail/Admin Team if BHEL Webmail is slow, offline, or down." };
  return { supportTeam: "Network Team", contactNumber: "", escalationNote: "Contact Network Team if network health is degraded or critical." };
}

function isActionRequired(status?: string) {
  return status === "slow" || status === "offline" || status === "unknown";
}

function formatMs(value?: number | null) {
  return value === null || value === undefined ? "N/A" : `${value} ms`;
}

function formatTime(value?: string | null) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
