"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Activity, AlertTriangle, Download, Globe2, Mail, Network, ShieldCheck, Timer, WifiOff } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { getApiBaseUrl } from "@/lib/apiBase";
import { getSessionToken, getSessionUser } from "@/lib/auth";

type ServiceKey = string;
type RangeKey = "24h" | "7d" | "30d";
type StatusFilter = "all" | "healthy" | "degraded" | "critical" | "disabled" | "no_data" | "cannot_verify";
type ViewMode = "server" | "client";

type ServiceHealth = {
  key: ServiceKey;
  serviceName: string;
  status: "healthy" | "online" | "slow" | "offline" | "unknown" | "disabled";
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
  url?: string;
  monitoringEnabled?: boolean;
  isDefault?: boolean;
  supportTeam?: string;
  contactNumber?: string;
  supportEmail?: string;
  escalationNote?: string;
  internetStatus?: string;
  overallNetworkHealth?: string;
  source?: string;
  sourceLabel?: string;
  hostname?: string;
  ipAddress?: string;
  department?: string;
  block?: string;
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
  hostname?: string;
};

type HeatmapPoint = {
  serviceKey: ServiceKey;
  serviceName: string;
  bucket: string;
  bucketStartAt?: string | null;
  bucketEndAt?: string | null;
  totalChecks: number;
  healthyChecks: number;
  degradedChecks: number;
  criticalChecks: number;
  cannotVerifyChecks?: number;
  availableChecks?: number;
  incidentCount?: number;
  status: "healthy" | "degraded" | "critical" | "no_data" | "cannot_verify";
  checkedAt: string | null;
  responseTimeMs: number | null;
  maxResponseTimeMs?: number | null;
  noDataMessage: string | null;
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
  supportTeam?: string;
  contactNumber?: string;
  supportEmail?: string;
  escalationNote?: string;
};

type ReportRow = {
  serviceKey: ServiceKey;
  serviceName: string;
  availabilityPercent: number;
  averageResponseTimeMs: number | null;
  totalDowntimeMinutes: number;
  incidentCount: number;
  totalChecks: number;
  supportTeam?: string;
  contactNumber?: string;
};

type InfrastructureServiceConfig = {
  id: string;
  name: string;
  url: string;
  monitoringEnabled: boolean;
  isDefault: boolean;
  supportTeam?: string;
  contactNumber?: string;
  supportEmail?: string;
  escalationNote?: string;
};

type ClientSample = {
  id: string;
  serviceKey: ServiceKey;
  serviceName: string;
  serviceType: string;
  checkedAt: string;
  status: ServiceHealth["status"];
  statusLabel: string;
  responseTimeMs: number | null;
  message: string;
  url?: string;
  supportTeam?: string;
  contactNumber?: string;
  supportEmail?: string;
  escalationNote?: string;
  source: "BROWSER_CHECK" | "OPSCENTER_AGENT" | "BACKEND_VERIFIED";
  sourceLabel: string;
  hostname?: string;
  ipAddress?: string;
  department?: string;
  block?: string;
  packetLoss?: number | null;
  dnsStatus?: string;
  errorReason?: string;
};

type ClientConnectivityHistoryRow = {
  id: number;
  username: string;
  userRole: string;
  serviceName: string;
  serviceType: string;
  targetUrl: string;
  status: "ONLINE" | "SLOW" | "OFFLINE" | "DNS_FAILED" | "CERTIFICATE_ERROR" | "PROXY_BLOCKED" | "CANNOT_VERIFY";
  responseTimeMs: number | null;
  packetLoss: number | null;
  dnsStatus: string;
  checkedAt: string;
  checkedFrom: string;
  source: "BROWSER_CHECK" | "OPSCENTER_AGENT" | "BACKEND_VERIFIED";
  sourceLabel: string;
  clientId: string;
  hostname: string;
  ipAddress: string;
  department: string;
  block: string;
  browserInfo: string;
  errorMessage: string;
  errorReason: string;
};

type ClientHistoryFilters = {
  user: string;
  role: string;
  status: string;
  serviceName: string;
  source: string;
  department: string;
  block: string;
  serviceType: string;
  range: string;
  dateFrom: string;
  dateTo: string;
};

type ClientConnectivitySummary = {
  totalClientPcs: number;
  agentVerifiedOnline: number;
  slowClients: number;
  offlineClients: number;
  dnsFailed: number;
  cannotVerifyBrowserChecks: number;
  averageClientResponseTimeMs: number | null;
  activeIncidents: number;
};

type ClientAgentServiceHistoryRow = {
  id: number;
  clientId: string;
  hostname: string;
  serviceKey: ServiceKey;
  serviceName: string;
  targetUrl: string;
  status: "online" | "slow" | "offline" | "cannot_verify";
  latencyMs: number | null;
  dnsMs: number | null;
  errorMessage: string;
  checkedAt: string;
};

type ServerPayload = {
  current: ServiceHealth[];
  history: HistoryPoint[];
  heatmap: HeatmapPoint[];
  incidents: Incident[];
  reports: ReportRow[];
  services: InfrastructureServiceConfig[];
};

type ClientPayload = {
  samples?: ClientSample[];
  historyRows?: ClientConnectivityHistoryRow[];
  summary?: ClientConnectivitySummary | null;
  agentHistory?: ClientAgentServiceHistoryRow[];
};

function settledData<T>(
  result: PromiseSettledResult<{ data: { data?: T[] } }>,
  fallback: T[]
) {
  if (result.status !== "fulfilled") return Array.isArray(fallback) ? fallback : [];
  return Array.isArray(result.value.data.data) ? result.value.data.data : [];
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);
  return debounced;
}

const ranges: RangeKey[] = ["24h", "7d", "30d"];
const clientSampleIntervalMs = 30000;
const infrastructureCacheMs = 30000;
const activeViewRefreshMs = 60000;
const browserCannotVerifyMessage = "Browser could not verify this service. This is not confirmed service latency.";
const serviceOrder: ServiceKey[] = ["hpep-intranet", "bhel-webmail", "network-health"];
const clientLocalOrder: ServiceKey[] = ["client-internet", "client-intranet", "client-backend-api"];
const clientInfrastructureOrder: ServiceKey[] = ["hpep-intranet", "bhel-webmail", "google-service", "dynacon-assets", "karexpert", "beams", "digit"];
const clientBaseOrder: ServiceKey[] = [...clientLocalOrder, ...clientInfrastructureOrder];
const clientLocalKeys = new Set<ServiceKey>(clientLocalOrder);
const icons: Record<string, React.ElementType> = { "hpep-intranet": Globe2, "bhel-webmail": Mail, "network-health": Network, "client-internet": Network, "client-intranet": Globe2, "client-backend-api": Activity, "google-service": Globe2, "dynacon-assets": Activity, beams: Activity, karexpert: Activity, digit: Activity };
const browserOnlyServices = new Set(["client-internet", "client-backend-api"]);
const isVerifiedClientStatus = (status?: string) => status === "online" || status === "healthy" || status === "slow" || status === "offline";
const isSuccessfulClientStatus = (status?: string) => status === "online" || status === "healthy" || status === "slow";
const clientStaticServices = [
  { key: "client-internet", serviceName: "Internet", serviceType: "INTERNET", url: "https://www.google.com/generate_204", message: "Browser internet reachability check" },
  { key: "client-intranet", serviceName: "Intranet", serviceType: "INTRANET", url: "", message: "Configure an intranet URL to verify from browser" },
  { key: "client-backend-api", serviceName: "Backend API", serviceType: "BACKEND_API", url: "/health", message: "OpsCenter API checked from this browser" },
  { key: "google-service", serviceName: "Google", serviceType: "CUSTOM_LOCAL_SERVICE", url: "https://www.google.com/generate_204", message: "Google checked from this browser" },
  { key: "dynacon-assets", serviceName: "Dynacon Assets", serviceType: "CUSTOM_LOCAL_SERVICE", url: "", message: "Service URL not configured for browser check" },
  { key: "karexpert", serviceName: "BHEL KAREXPERT", serviceType: "CUSTOM_LOCAL_SERVICE", url: "", message: "Service URL not configured for browser check" },
  { key: "beams", serviceName: "BEAMS", serviceType: "CUSTOM_LOCAL_SERVICE", url: "", message: "Service URL not configured for browser check" },
  { key: "digit", serviceName: "DIGIT", serviceType: "CUSTOM_LOCAL_SERVICE", url: "", message: "Service URL not configured for browser check" }
];

export function InfrastructureMonitoringPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("server");
  const [range, setRange] = useState<RangeKey>("24h");
  const [serviceFilter, setServiceFilter] = useState<ServiceKey | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [current, setCurrent] = useState<ServiceHealth[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [infrastructureServices, setInfrastructureServices] = useState<InfrastructureServiceConfig[]>([]);
  const [clientSamples, setClientSamples] = useState<ClientSample[]>([]);
  const [clientHistoryLoading, setClientHistoryLoading] = useState(false);
  const [clientHistoryRows, setClientHistoryRows] = useState<ClientConnectivityHistoryRow[]>([]);
  const [clientSummary, setClientSummary] = useState<ClientConnectivitySummary | null>(null);
  const [agentServiceHistory, setAgentServiceHistory] = useState<ClientAgentServiceHistoryRow[]>([]);
  const [clientHistoryFilters, setClientHistoryFilters] = useState<ClientHistoryFilters>({ user: "", role: "", status: "", serviceName: "", source: "", department: "", block: "", serviceType: "", range: "24h", dateFrom: "", dateTo: "" });
  const [clientLoading, setClientLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshMs, setRefreshMs] = useState(60000);
  const inFlightRef = useRef(false);
  const clientCheckInFlightRef = useRef(false);
  const serverCacheRef = useRef(new Map<string, { timestamp: number; data: ServerPayload }>());
  const clientCacheRef = useRef(new Map<string, { timestamp: number; data: ClientPayload }>());
  const serverAbortRef = useRef<AbortController | null>(null);
  const clientMineAbortRef = useRef<AbortController | null>(null);
  const clientAdminAbortRef = useRef<AbortController | null>(null);
  const sessionUser = getSessionUser();
  const isAdmin = sessionUser?.role === "admin";

  const applyServerPayload = useCallback((payload: ServerPayload) => {
    setCurrent(payload.current);
    setHistory(payload.history);
    setHeatmap(payload.heatmap);
    setIncidents(payload.incidents);
    setReports(payload.reports);
    setInfrastructureServices(payload.services);
  }, []);

  const load = useCallback(async (selectedRange = range, options: { force?: boolean } = {}) => {
    if (inFlightRef.current) return;
    if (!getSessionToken()) {
      setError("");
      setLoading(false);
      return;
    }
    const cacheKey = `server:${selectedRange}`;
    const cached = serverCacheRef.current.get(cacheKey);
    if (!options.force && cached && Date.now() - cached.timestamp < infrastructureCacheMs) {
      applyServerPayload(cached.data);
      setLoading(false);
      setError("");
      return;
    }
    inFlightRef.current = true;
    serverAbortRef.current?.abort();
    const controller = new AbortController();
    serverAbortRef.current = controller;
    setLoading((previous) => previous || !cached);
    try {
      const [currentResp, historyResp, heatmapResp, incidentsResp, reportsResp, servicesResp] = await Promise.allSettled([
        api.get<{ data: ServiceHealth[] }>("/infrastructure/current", { signal: controller.signal }),
        api.get<{ data: HistoryPoint[] }>(`/infrastructure/history?range=${selectedRange}`, { signal: controller.signal }),
        api.get<{ data: HeatmapPoint[] }>(`/infrastructure/heatmap?range=${selectedRange}`, { signal: controller.signal }),
        api.get<{ data: Incident[] }>(`/infrastructure/incidents?range=${selectedRange}`, { signal: controller.signal }),
        api.get<{ data: ReportRow[] }>(`/infrastructure/reports?range=${selectedRange}`, { signal: controller.signal }),
        api.get<{ data: InfrastructureServiceConfig[] }>("/infrastructure-services", { signal: controller.signal })
      ]);
      if ([currentResp, historyResp, heatmapResp, incidentsResp, reportsResp, servicesResp].some((result) => result.status === "rejected" && axios.isCancel(result.reason))) return;
      const payload: ServerPayload = {
        current: settledData(currentResp, current),
        history: settledData(historyResp, history),
        heatmap: settledData(heatmapResp, heatmap),
        incidents: settledData(incidentsResp, incidents),
        reports: settledData(reportsResp, reports),
        services: settledData(servicesResp, infrastructureServices)
      };
      serverCacheRef.current.set(cacheKey, { timestamp: Date.now(), data: payload });
      applyServerPayload(payload);
      const failedSections = [currentResp, historyResp, heatmapResp, incidentsResp, reportsResp, servicesResp].filter((result) => result.status === "rejected").length;
      setError(failedSections ? "Some infrastructure sections could not be refreshed. Showing the latest available data." : "");
    } catch (requestError) {
      if (axios.isCancel(requestError)) return;
      setError(requestError instanceof Error ? requestError.message : "Infrastructure monitoring could not be loaded.");
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [applyServerPayload, current, heatmap, history, incidents, infrastructureServices, range, reports]);

  useEffect(() => {
    let active = true;
    api.get<{ data?: { infrastructure?: { monitoringIntervalSeconds?: number } } }>("/settings")
      .then(({ data }) => {
        const seconds = Number(data.data?.infrastructure?.monitoringIntervalSeconds || 60);
        if (active) setRefreshMs(Math.max(activeViewRefreshMs, seconds * 1000));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (viewMode !== "server") return undefined;
    void load(range);
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(range, { force: true });
    }, refreshMs);
    return () => window.clearInterval(refresh);
  }, [load, refreshMs, range, viewMode]);

  const clientServices = useMemo(() => buildClientServices(infrastructureServices, current), [infrastructureServices, current]);

  useEffect(() => {
    if (viewMode !== "client") return;
    loadMyClientConnectivityHistory(range).catch(() => undefined);
    void runClientChecks();
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible") void runClientChecks();
    }, activeViewRefreshMs);
    return () => window.clearInterval(refresh);
  }, [viewMode, clientServices.length, range]);

  async function runClientChecks() {
    if (!clientServices.length || clientCheckInFlightRef.current) return;
    clientCheckInFlightRef.current = true;
    setClientLoading(true);
    try {
      const samples = await Promise.all(clientServices.map((service) => checkFromBrowser(service)));
      setClientSamples((existing) => mergeClientSamples(existing, samples, range));
      Promise.all(samples.map((sample) => saveClientSample(sample)))
        .then(() => {
          void loadMyClientConnectivityHistory(range);
          if (isAdmin) return loadClientConnectivityHistory({ ...clientHistoryFilters, range });
          return undefined;
        })
        .catch(() => undefined);
    } finally {
      clientCheckInFlightRef.current = false;
      setClientLoading(false);
    }
  }

  async function loadMyClientConnectivityHistory(selectedRange = range) {
    if (!getSessionToken()) return;
    const cacheKey = `client:mine:${selectedRange}:${clientServices.map((service) => service.key).join("|")}`;
    const cached = clientCacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < infrastructureCacheMs && cached.data.samples) {
      setClientSamples(cached.data.samples);
      return;
    }
    setClientHistoryLoading(true);
    clientMineAbortRef.current?.abort();
    const controller = new AbortController();
    clientMineAbortRef.current = controller;
    try {
      const response = await axios.get<{ data: ClientConnectivityHistoryRow[] }>(`${getApiBaseUrl()}/client-connectivity/my-history?range=${selectedRange}`, {
        headers: {
          Authorization: `Bearer ${getSessionToken() || ""}`
        },
        signal: controller.signal
      });
      const samples = clientHistoryRowsToSamples(response.data.data || [], clientServices);
      clientCacheRef.current.set(cacheKey, { timestamp: Date.now(), data: { samples } });
      setClientSamples(samples);
    } catch (requestError) {
      if (axios.isCancel(requestError)) return;
      // Saved client history should not interrupt live checks.
    } finally {
      setClientHistoryLoading(false);
    }
  }

  async function loadClientConnectivityHistory(filters = clientHistoryFilters) {
    if (!isAdmin) return;
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const cacheKey = `client:admin:${params.toString() || "default"}`;
    const cached = clientCacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < infrastructureCacheMs) {
      if (cached.data.historyRows) setClientHistoryRows(cached.data.historyRows);
      if (cached.data.summary !== undefined) setClientSummary(cached.data.summary);
      if (cached.data.agentHistory) setAgentServiceHistory(cached.data.agentHistory);
      return;
    }
    clientAdminAbortRef.current?.abort();
    const controller = new AbortController();
    clientAdminAbortRef.current = controller;
    try {
      const [response, summaryResponse, agentHistoryResponse] = await Promise.all([
        axios.get<{ data: ClientConnectivityHistoryRow[] }>(`${getApiBaseUrl()}/client-connectivity/history${params.toString() ? `?${params.toString()}` : ""}`, {
          headers: {
            Authorization: `Bearer ${getSessionToken() || ""}`
          },
          signal: controller.signal
        }),
        axios.get<{ data: ClientConnectivitySummary }>(`${getApiBaseUrl()}/client-agent/summary`, {
          headers: {
            Authorization: `Bearer ${getSessionToken() || ""}`
          },
          signal: controller.signal
        }),
        axios.get<{ data: ClientAgentServiceHistoryRow[] }>(`${getApiBaseUrl()}/client-agent/service-history?range=${filters.range || "24h"}`, {
          headers: {
            Authorization: `Bearer ${getSessionToken() || ""}`
          },
          signal: controller.signal
        })
      ]);
      const payload: ClientPayload = {
        historyRows: Array.isArray(response.data.data) ? response.data.data : [],
        summary: summaryResponse.data.data,
        agentHistory: Array.isArray(agentHistoryResponse.data.data) ? agentHistoryResponse.data.data : []
      };
      clientCacheRef.current.set(cacheKey, { timestamp: Date.now(), data: payload });
      setClientHistoryRows(payload.historyRows || []);
      setClientSummary(payload.summary || null);
      setAgentServiceHistory(payload.agentHistory || []);
    } catch (requestError) {
      if (axios.isCancel(requestError)) return;
      // Background admin history refresh should not interrupt the monitoring UI.
    }
  }

  useEffect(() => {
    if (viewMode === "client" && isAdmin) loadClientConnectivityHistory({ ...clientHistoryFilters, range }).catch(() => undefined);
  }, [isAdmin, range, viewMode]);

  const latestClientByService = useMemo(() => {
    const latest = new Map<ServiceKey, ClientSample>();
    for (const sample of clientSamples) latest.set(sample.serviceKey, sample);
    return latest;
  }, [clientSamples]);

  const clientCurrent = useMemo(() => clientServices.map((service) => {
    const sample = latestClientByService.get(service.key);
    return clientSampleToHealth(service, sample);
  }), [clientServices, latestClientByService]);

  const clientLocalCurrent = useMemo(() => clientCurrent.filter((service) => clientLocalKeys.has(service.key)), [clientCurrent]);
  const clientInfrastructureCurrent = useMemo(() => clientCurrent.filter((service) => !clientLocalKeys.has(service.key)), [clientCurrent]);
  const clientInfrastructureServices = useMemo(() => clientServices.filter((service) => !clientLocalKeys.has(service.key)), [clientServices]);
  const agentVerifiedServices = useMemo(() => buildAgentVerifiedServices(agentServiceHistory), [agentServiceHistory]);
  const agentHistoryByService = useMemo(() => Object.fromEntries(agentVerifiedServices.map((service) => [
    service.key,
    agentServiceHistory.filter((point) => point.serviceKey === service.key).map(agentHistoryToHistoryPoint)
  ])) as Record<ServiceKey, HistoryPoint[]>, [agentServiceHistory, agentVerifiedServices]);

  const activeCurrent = viewMode === "client" ? clientCurrent : current;
  const activeLoading = viewMode === "client" ? clientLoading || clientHistoryLoading : loading;

  const overview = useMemo(() => {
    const summaryItems = viewMode === "client" ? agentVerifiedServices.length ? agentVerifiedServices : clientInfrastructureCurrent : activeCurrent;
    const isVerifiedClientItem = (item: ServiceHealth) => item.status === "online" || item.status === "healthy" || item.status === "slow" || item.status === "offline";
    const isSuccessfulClientItem = (item: ServiceHealth) => item.status === "online" || item.status === "healthy" || item.status === "slow";
    const healthy = summaryItems.filter((item) => item.status === "healthy" || item.status === "online").length;
    const degraded = summaryItems.filter((item) => viewMode === "client" ? item.status === "slow" : item.status === "slow" || item.status === "unknown").length;
    const offline = summaryItems.filter((item) => item.status === "offline").length;
    const cannotVerify = viewMode === "client" ? summaryItems.filter((item) => item.status === "unknown").length : 0;
    const responseValues = summaryItems
      .filter((item) => viewMode !== "client" || isVerifiedClientItem(item))
      .map((item) => item.responseTimeMs ?? item.latencyMs)
      .filter((item): item is number => item !== null && item !== undefined);
    const verifiedClientItems = summaryItems.filter(isVerifiedClientItem);
    const successfulClientItems = verifiedClientItems.filter(isSuccessfulClientItem);
    const network = viewMode === "client" ? clientLocalCurrent.find((item) => item.key === "client-internet") : activeCurrent.find((item) => item.key === "network-health");
    const clientNetworkScore = verifiedClientItems.length ? Math.round((successfulClientItems.length / verifiedClientItems.length) * 100) : null;
    return {
      total: summaryItems.length,
      localChecks: viewMode === "client" ? clientLocalCurrent.length : 0,
      healthy,
      degraded,
      offline,
      cannotVerify,
      incidents: viewMode === "client"
        ? summaryItems.filter((item) => item.status === "slow" || item.status === "offline").length
        : summaryItems.filter((item) => item.status !== "disabled").reduce((sum, item) => sum + item.incidentCount, 0),
      averageResponse: responseValues.length ? Math.round(responseValues.reduce((sum, value) => sum + value, 0) / responseValues.length) : null,
      networkScore: viewMode === "client" ? clientNetworkScore : network ? Math.max(0, Math.round(network.availabilityPercent - (network.packetLossPercent || 0))) : 0
    };
  }, [activeCurrent, agentVerifiedServices, clientInfrastructureCurrent, clientLocalCurrent, viewMode]);

  const orderedServices = useMemo(() => {
    if (viewMode === "client") {
      const orderedKeys = new Set(clientInfrastructureOrder);
      return dedupeServicesByKey([
        ...clientInfrastructureOrder.map((key) => clientInfrastructureCurrent.find((item) => item.key === key)).filter((service): service is ServiceHealth => Boolean(service)),
        ...clientInfrastructureCurrent.filter((item) => !orderedKeys.has(item.key))
      ]);
    }
    const defaults = serviceOrder
      .map((key) => activeCurrent.find((item) => item.key === key) || ({ key, serviceName: labelForService(key), status: "unknown", statusLabel: "Unknown", responseTimeMs: null, latencyMs: null, packetLossPercent: null, dnsStatus: null, dnsResponseTimeMs: null, lastCheckedAt: "", availabilityPercent: 0, incidentCount: 0, message: "Waiting for Oracle monitoring data", isDefault: true, supportTeam: defaultSupportFor(key).supportTeam, contactNumber: defaultSupportFor(key).contactNumber, escalationNote: defaultSupportFor(key).escalationNote } as ServiceHealth));
    const custom = activeCurrent.filter((item) => !serviceOrder.includes(item.key));
    return dedupeServicesByKey([...defaults, ...custom]);
  }, [activeCurrent, clientInfrastructureCurrent, viewMode]);

  const orderedLocalServices = useMemo(() => dedupeServicesByKey(clientLocalOrder
    .map((key) => clientLocalCurrent.find((item) => item.key === key))
    .filter((service): service is ServiceHealth => Boolean(service))), [clientLocalCurrent]);

  const displayServices = useMemo(() => viewMode === "client" ? [...orderedLocalServices, ...orderedServices] : orderedServices, [orderedLocalServices, orderedServices, viewMode]);
  const displayServiceKeySignature = useMemo(() => displayServices.map((service) => service.key).join("|"), [displayServices]);

  const historyByService = useMemo(() => {
    const serviceKeys = new Set(displayServices.map((service) => service.key));
    const grouped = new Map<ServiceKey, HistoryPoint[]>();
    for (const key of serviceKeys) grouped.set(key, []);
    if (viewMode === "client") {
      for (const sample of clientSamples) {
        if (!serviceKeys.has(sample.serviceKey)) continue;
        grouped.get(sample.serviceKey)?.push(clientSampleToHistoryPoint(sample));
      }
    } else {
      for (const point of history) {
        if (!serviceKeys.has(point.serviceKey)) continue;
        grouped.get(point.serviceKey)?.push(point);
      }
    }
    return Object.fromEntries(grouped) as Record<ServiceKey, HistoryPoint[]>;
  }, [history, clientSamples, viewMode, displayServiceKeySignature]);

  const activeHeatmap = useMemo(() => viewMode === "client"
    ? buildClientHeatmap(clientInfrastructureServices, clientSamples, range)
    : Array.isArray(heatmap) ? heatmap : [], [clientInfrastructureServices, clientSamples, heatmap, range, viewMode]);
  const debouncedServiceFilter = useDebouncedValue(serviceFilter, 250);
  const debouncedStatusFilter = useDebouncedValue(statusFilter, 250);
  const handleViewModeChange = useCallback((value: ViewMode) => setViewMode(value), []);
  const handleRangeChange = useCallback((value: RangeKey) => setRange(value), []);
  const handleServiceFilterChange = useCallback((value: ServiceKey | "all") => setServiceFilter(value), []);
  const handleStatusFilterChange = useCallback((value: StatusFilter) => setStatusFilter(value), []);
  const handleClientFilters = useCallback((filters: ClientHistoryFilters) => setClientHistoryFilters(filters), []);
  const handleApplyClientFilters = useCallback(() => {
    void loadClientConnectivityHistory({ ...clientHistoryFilters, range });
  }, [clientHistoryFilters, range]);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-800 bg-slate-950 p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Enterprise NOC</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Infrastructure Monitoring Console</h2>
            <p className="mt-1 text-sm text-slate-400">{viewMode === "server" ? "Server View: checked from backend server and recorded in Oracle official monitoring history." : "Client View: checked from this computer/browser and recorded in CLIENT_CONNECTIVITY_HISTORY."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ViewModeSelector value={viewMode} onChange={handleViewModeChange} />
            <RangeSelector value={range} onChange={handleRangeChange} />
          </div>
        </div>
        {error ? <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}
      </section>

      <div className={`grid gap-4 md:grid-cols-2 ${viewMode === "client" ? "xl:grid-cols-7" : "xl:grid-cols-7"}`}>
        {viewMode === "client" ? <OverviewCard label="Local Checks" value={String(overview.localChecks)} icon={Network} /> : null}
        <OverviewCard label={viewMode === "client" ? "Infrastructure Services" : "Total Services"} value={String(overview.total)} icon={Activity} />
        <OverviewCard label={viewMode === "client" ? "Online" : "Healthy"} value={String(overview.healthy)} icon={ShieldCheck} tone="green" />
        <OverviewCard label={viewMode === "client" ? "Slow" : "Degraded"} value={String(overview.degraded)} icon={AlertTriangle} tone="yellow" />
        <OverviewCard label="Offline" value={String(overview.offline)} icon={WifiOff} tone="red" />
        {viewMode === "client" ? <OverviewCard label="Cannot Verify" value={String(overview.cannotVerify)} icon={AlertTriangle} tone="gray" /> : null}
        <OverviewCard label="Active Incidents" value={String(overview.incidents)} icon={AlertTriangle} tone="yellow" />
        <OverviewCard label="Avg Response" value={overview.averageResponse === null ? "N/A" : `${overview.averageResponse} ms`} icon={Timer} />
        <OverviewCard label="Network Score" value={overview.networkScore === null ? "N/A" : `${overview.networkScore}%`} icon={Network} tone="green" />
      </div>

      {viewMode === "client" && isAdmin && clientSummary ? <EnterpriseClientSummary summary={clientSummary} /> : null}

      {viewMode === "client" ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Agent Verified Service Access</h2>
          {agentVerifiedServices.length ? (
            <div className="grid gap-4 xl:grid-cols-3">
              {agentVerifiedServices.map((service) => (
                <ServiceDashboard
                  key={`agent-service-${service.key}`}
                  serviceKey={service.key}
                  service={service}
                  history={agentHistoryByService[service.key] || []}
                  range={range}
                  loading={activeLoading}
                  checkedFrom="OpsCenter Agent"
                  viewMode={viewMode}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-slate-800 bg-slate-950 px-3 py-3 text-sm font-semibold text-slate-400">
              No agent verified service history available. Run OpsCenter Agent to enable enterprise client monitoring.
            </p>
          )}
        </section>
      ) : null}

      {viewMode === "client" ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Browser Check / Fallback Diagnostic</h2>
          <div className="grid gap-4 xl:grid-cols-3">
            {orderedLocalServices.map((service) => (
              <ServiceDashboard
                key={`local-service-${service.key}`}
                serviceKey={service.key}
                service={service}
                history={historyByService[service.key] || []}
                range={range}
                loading={activeLoading}
                checkedFrom="This Computer"
                viewMode={viewMode}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        {viewMode === "client" ? <h2 className="text-lg font-semibold text-slate-900">Browser Check / Fallback Diagnostic - Service Access</h2> : null}
        <div className="grid gap-4 xl:grid-cols-3">
          {orderedServices.map((service) => (
            <ServiceDashboard
              key={`service-card-${service.key}`}
              serviceKey={service.key}
              service={service}
              history={historyByService[service.key] || []}
              range={range}
              loading={activeLoading}
              checkedFrom={viewMode === "client" ? "This Computer" : "Backend Server"}
              viewMode={viewMode}
            />
          ))}
        </div>
      </section>

      <HeatmapSection
        points={activeHeatmap}
        range={range}
        serviceFilter={debouncedServiceFilter}
        statusFilter={debouncedStatusFilter}
        services={orderedServices}
        sourceLabel={viewMode === "client" ? "current browser session samples from this computer" : "Oracle monitoring history"}
        onServiceFilter={handleServiceFilterChange}
        onStatusFilter={handleStatusFilterChange}
      />

      {viewMode === "server" ? <div className="grid gap-5 xl:grid-cols-[1fr_1.25fr]">
        <IncidentTimeline incidents={incidents} />
        <AvailabilityReports reports={reports} services={orderedServices} />
      </div> : null}

      {isAdmin ? (
        <>
        <AgentVerifiedClients rows={clientHistoryRows.filter((row) => row.source === "OPSCENTER_AGENT")} />
        <ClientConnectivityHistory
          rows={clientHistoryRows}
          filters={clientHistoryFilters}
          onFilters={handleClientFilters}
          onApply={handleApplyClientFilters}
        />
        </>
      ) : null}
    </div>
  );
}

function ViewModeSelector({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded-md border border-slate-700 bg-slate-900 p-1">
      {(["server", "client"] as ViewMode[]).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={`rounded px-3 py-1.5 text-xs font-semibold transition ${value === item ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:bg-slate-800"}`}
        >
          {item === "server" ? "Server View" : "Client View"}
        </button>
      ))}
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

function OverviewCard({ label, value, icon: Icon, tone = "blue" }: { label: string; value: string; icon: React.ElementType; tone?: "blue" | "green" | "yellow" | "red" | "gray" }) {
  const tones = {
    blue: "text-cyan-200 bg-cyan-400/10 border-cyan-400/20",
    green: "text-emerald-200 bg-emerald-400/10 border-emerald-400/20",
    yellow: "text-amber-200 bg-amber-400/10 border-amber-400/20",
    red: "text-red-200 bg-red-400/10 border-red-400/20",
    gray: "text-slate-200 bg-slate-400/10 border-slate-400/20"
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

function EnterpriseClientSummary({ summary }: { summary: ClientConnectivitySummary }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Enterprise Client Agent Summary</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewCard label="Total Client PCs" value={String(summary.totalClientPcs)} icon={Network} />
        <OverviewCard label="Agent Verified Online" value={String(summary.agentVerifiedOnline)} icon={ShieldCheck} tone="green" />
        <OverviewCard label="Slow Clients" value={String(summary.slowClients)} icon={AlertTriangle} tone="yellow" />
        <OverviewCard label="Offline Clients" value={String(summary.offlineClients)} icon={WifiOff} tone="red" />
        <OverviewCard label="DNS Failed" value={String(summary.dnsFailed)} icon={Globe2} tone="red" />
        <OverviewCard label="Browser Cannot Verify" value={String(summary.cannotVerifyBrowserChecks)} icon={AlertTriangle} tone="gray" />
        <OverviewCard label="Avg Client Response" value={formatMs(summary.averageClientResponseTimeMs)} icon={Timer} />
        <OverviewCard label="Active Incidents" value={String(summary.activeIncidents)} icon={AlertTriangle} tone="red" />
      </div>
      {summary.totalClientPcs === 0 ? (
        <p className="mt-3 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-400">
          No client agents registered. Install OpsCenter Agent on client PCs to enable verified client monitoring.
        </p>
      ) : null}
    </section>
  );
}

const ServiceDashboard = memo(function ServiceDashboard({ serviceKey, service, history, range, loading, checkedFrom = "Backend Server", viewMode = "server" }: { serviceKey: ServiceKey; service?: ServiceHealth; history: HistoryPoint[]; range: RangeKey; loading: boolean; checkedFrom?: string; viewMode?: ViewMode }) {
  const key = service?.key || serviceKey;
  const Icon = icons[key] || Globe2;
  const agentVerified = service?.source === "OPSCENTER_AGENT";
  const rawChartData = (Array.isArray(history) ? history : [])
    .map((point) => {
      const checkedAt = validDateIso(point.checkedAt);
      if (!checkedAt) return null;
      return {
        label: formatChartDate(checkedAt, viewMode, range),
        checkedAt,
        value: viewMode === "client" && !agentVerified ? point.responseTimeMs ?? 0 : point.responseTimeMs,
        markerValue: null as number | null,
        status: point.status,
        responseTimeMs: point.responseTimeMs,
        serviceName: point.serviceName,
        hostname: point.hostname || service?.hostname || ""
      };
    })
    .filter((point): point is NonNullable<typeof point> => Boolean(point));
  const chartData = viewMode === "client" && !agentVerified ? rawChartData : withIncidentMarkers(rawChartData);
  const isClientCannotVerify = viewMode === "client" && !agentVerified && service?.status === "unknown";
  const sourceLabel = service?.sourceLabel || (viewMode === "client" ? "Browser Check" : "Backend Verified");
  const responseLabel = isClientCannotVerify ? "Check Attempt Time" : agentVerified ? "Agent Verified Response Time" : "Response Time";
  const needsAction = service ? isActionRequired(service.status, viewMode) : false;
  const hasSupport = !isClientCannotVerify && Boolean(service?.supportTeam || service?.contactNumber || service?.supportEmail || service?.escalationNote);

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
        <div className="flex flex-col items-end gap-2">
          <SourceBadge label={sourceLabel} />
          <StatusBadge status={service?.status || "unknown"} label={loading ? "Checking" : service?.statusLabel || "Unknown"} viewMode={viewMode} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {service?.status === "disabled" ? (
          <>
            <Metric label="Availability" value="N/A" />
            <Metric label="Response Time" value="N/A" />
            <Metric label="Last Checked" value="N/A" />
            <Metric label="Incidents" value="N/A" />
          </>
        ) : key === "network-health" ? (
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
            <Metric label={service?.source === "OPSCENTER_AGENT" ? "Real Availability" : viewMode === "client" ? "Browser Availability" : "Availability"} value={viewMode === "client" ? formatBrowserAvailability(service) : `${service?.availabilityPercent ?? 0}%`} />
            <Metric label={responseLabel} value={formatMs(service?.responseTimeMs)} />
            <Metric label="Last Checked" value={formatDate(service?.lastCheckedAt)} />
            <Metric label="Incidents" value={String(service?.incidentCount ?? 0)} />
            <Metric label="Checked From" value={sourceLabel || checkedFrom} />
            {service?.hostname ? <Metric label="Host / IP" value={`${service.hostname}${service.ipAddress ? ` / ${service.ipAddress}` : ""}`} /> : null}
            {service?.department || service?.block ? <Metric label="Department / Block" value={`${service.department || "N/A"} / ${service.block || "N/A"}`} /> : null}
            {service?.source === "OPSCENTER_AGENT" ? <Metric label="Packet Loss / DNS" value={`${service.packetLossPercent ?? 0}% / ${service.dnsStatus || "N/A"}`} /> : null}
          </>
        )}
      </div>
      {isClientCannotVerify ? (
        <CannotVerifyInfo />
      ) : needsAction ? (
        <ActionRequired service={service} />
      ) : hasSupport ? (
        <p className="mt-4 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-400">
          Support: {service?.supportTeam || "Support contact not configured"}{service?.contactNumber ? ` | Ext: ${service.contactNumber}` : ""}
        </p>
      ) : null}
      <div className="mt-5 h-52">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{responseLabel}</p>
        {chartData.length ? <HistoryChart data={chartData} collecting={viewMode === "client" && chartData.length === 1} viewMode={viewMode} agentVerified={agentVerified} /> : <EmptyChart viewMode={viewMode} />}
      </div>
    </article>
  );
});

function SourceBadge({ label }: { label: string }) {
  const classes = label === "Agent Verified"
    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
    : label === "Backend Verified"
      ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
      : "border-slate-400/40 bg-slate-400/10 text-slate-200";
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>{label}</span>;
}

const HistoryChart = memo(function HistoryChart({ data, collecting = false, viewMode = "server", agentVerified = false }: { data: Array<{ label: string; checkedAt: string; value: number | null; markerValue: number | null; status: string; responseTimeMs: number | null; serviceName?: string; hostname?: string }>; collecting?: boolean; viewMode?: ViewMode; agentVerified?: boolean }) {
  return (
    <div className="relative h-full min-h-0 min-w-0">
      {collecting ? <p className="absolute right-2 top-2 z-10 rounded-md border border-slate-700 bg-slate-950/90 px-2 py-1 text-xs font-semibold text-slate-300">Collecting more samples...</p> : null}
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1} initialDimension={{ width: 320, height: 208 }}>
        <LineChart data={data}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
          {viewMode === "client" && !agentVerified ? (
            <>
              <Tooltip
                contentStyle={{ background: "#020617", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0" }}
                formatter={(value: any, _name: any, item: any) => item.payload?.status === "cannot_verify"
                  ? [`Cannot Verify - browser blocked/timed out after ${value} ms`, "Check Attempt Time"]
                  : [`${value} ms`, "Response Time"]}
              />
              <Line type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2} dot={(props: any) => <ClientOutageDot {...props} single={data.length === 1} />} />
            </>
          ) : (
            <>
              <Tooltip content={agentVerified ? <AgentHistoryTooltip /> : <HistoryTooltip />} />
              <Line type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2} connectNulls dot={false} activeDot={{ r: 4, fill: "#22d3ee", stroke: "#020617", strokeWidth: 2 }} />
              <Line type="monotone" dataKey="markerValue" stroke="transparent" strokeWidth={0} dot={(props: any) => <OutageDot {...props} />} activeDot={false} isAnimationActive={false} />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

function AgentHistoryTooltip({ active, payload }: any) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 shadow-lg">
      <p className="font-semibold text-white">{point.serviceName || "Service"}</p>
      <p className="mt-1">Client hostname: {point.hostname || "N/A"}</p>
      <p>Checked time: {formatDate(point.checkedAt)}</p>
      <p>Latency: {formatMs(point.responseTimeMs)}</p>
      <p>Status: {statusText(point.status)}</p>
      <p>Checked From: OpsCenter Agent</p>
    </div>
  );
}

function HistoryTooltip({ active, payload }: any) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 shadow-lg">
      <p className="font-semibold text-white">{statusText(point.status)}</p>
      <p className="mt-1">Checked time: {formatDate(point.checkedAt)}</p>
      <p>Original response_time_ms: {formatMs(point.responseTimeMs)}</p>
    </div>
  );
}

const HeatmapSection = memo(function HeatmapSection({ points, range, serviceFilter, statusFilter, services, sourceLabel, onServiceFilter, onStatusFilter }: {
  points: HeatmapPoint[];
  range: RangeKey;
  serviceFilter: ServiceKey | "all";
  statusFilter: StatusFilter;
  services: ServiceHealth[];
  sourceLabel: string;
  onServiceFilter: (value: ServiceKey | "all") => void;
  onStatusFilter: (value: StatusFilter) => void;
}) {
  const serverHeatmap = sourceLabel === "Oracle monitoring history";
  const safeServices = useMemo(() => dedupeServicesByKey(Array.isArray(services) ? services : []), [services]);
  const aggregatedPoints = useMemo(() => aggregateHeatmapPoints(Array.isArray(points) ? points : [], safeServices, range), [points, range, safeServices]);
  const buckets = useMemo(() => buildClientRangeBuckets(range), [range]);
  const grouped = useMemo(() => safeServices.map((service) => ({
    key: service.key,
    name: service.serviceName,
    disabled: service.status === "disabled",
    points: service.status === "disabled" ? [] : aggregatedPoints.filter((point) => point.serviceKey === service.key)
  })).filter((item) => serviceFilter === "all" || item.key === serviceFilter).filter((item) => statusFilter !== "disabled" || item.disabled),
  [aggregatedPoints, safeServices, serviceFilter, statusFilter]);

  const visibleGrouped = useMemo(() => statusFilter === "disabled" ? grouped : grouped.map((service) => ({
    ...service,
    points: statusFilter === "all" ? service.points : service.points.map((point) => point.status === statusFilter ? point : {
      ...point,
      status: "no_data" as const,
      totalChecks: 0,
      healthyChecks: 0,
      degradedChecks: 0,
      criticalChecks: 0,
      cannotVerifyChecks: 0,
      incidentCount: 0,
      checkedAt: null,
      responseTimeMs: null,
      maxResponseTimeMs: null,
      noDataMessage: `No ${heatStatusLabel(statusFilter as HeatmapPoint["status"])} data in this bucket`
    })
  })), [grouped, statusFilter]);
  const blockCount = heatmapBlockCount(range);

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Infrastructure Heat Map</h2>
          <p className="mt-1 text-sm text-slate-400">{range} health blocks from {sourceLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={serviceFilter} onChange={(event) => onServiceFilter(event.target.value as ServiceKey | "all")} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100">
            <option value="all">All services</option>
            {safeServices.map((service) => <option key={`heatmap-filter-${service.key}`} value={service.key}>{service.serviceName}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => onStatusFilter(event.target.value as StatusFilter)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100">
            <option value="all">All statuses</option>
            <option value="healthy">Online</option>
            <option value="critical">Offline</option>
            <option value="degraded">Slow</option>
            <option value="cannot_verify">Cannot Verify</option>
            <option value="no_data">No data</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-slate-400">
        <LegendSwatch className="bg-emerald-500" label="Online/Healthy" />
        <LegendSwatch className="bg-amber-400" label="Slow" />
        <LegendSwatch className="bg-red-500" label="Offline/Down" />
        <LegendSwatch className="bg-slate-700" label="No data" />
      </div>
      <div className="mt-5 space-y-4">
        {visibleGrouped.map((service) => (
          <div key={`heatmap-row-${service.key}`}>
            <p className="mb-2 text-sm font-semibold text-slate-200">{service.name}</p>
            <div className="grid w-fit gap-[10px]" style={{ gridTemplateColumns: `repeat(${blockCount}, 12px)` }}>
              {service.disabled ? buckets.map((bucket) => (
                <div key={`${service.key}-disabled-${bucket.start.toISOString()}`} className="h-[24px] rounded-[5px] bg-slate-600" title="Monitoring Disabled" />
              )) : service.points.map((point) => (
                <div key={`${point.serviceKey}-${range}-${point.bucketStartAt}`} title={heatTooltip(point, serverHeatmap)} className={`h-[24px] rounded-[5px] ${heatClass(point.status)}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
});

const heatStatusPriority: Record<HeatmapPoint["status"], number> = {
  no_data: 0,
  healthy: 1,
  degraded: 2,
  cannot_verify: 3,
  critical: 4
};

function normalizeHeatStatus(status: unknown): HeatmapPoint["status"] {
  const normalized = String(status || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "healthy" || normalized === "online") return "healthy";
  if (normalized === "slow" || normalized === "degraded") return "degraded";
  if (normalized === "offline" || normalized === "down" || normalized === "critical") return "critical";
  if (normalized === "unknown" || normalized === "cannot_verify") return "cannot_verify";
  return "no_data";
}

function aggregateHeatmapPoints(points: HeatmapPoint[], services: ServiceHealth[], range: RangeKey) {
  const buckets = buildClientRangeBuckets(range);
  const serviceKeys = new Set(services.map((service) => service.key));
  const byBucket = new Map<string, HeatmapPoint>();
  const duplicateCounts = new Map<string, number>();

  for (const rawPoint of points) {
    if (!rawPoint || !serviceKeys.has(rawPoint.serviceKey)) continue;
    const bucketStart = heatmapPointBucketStart(rawPoint, range);
    if (!bucketStart) continue;
    const bucket = buckets.find((candidate) => bucketStart >= candidate.start.getTime() && bucketStart < candidate.end.getTime());
    if (!bucket) continue;

    const key = `${rawPoint.serviceKey}|${bucket.start.toISOString()}`;
    const point = normalizeHeatmapPoint(rawPoint, bucket);
    const existing = byBucket.get(key);
    if (!existing) {
      byBucket.set(key, point);
      continue;
    }
    duplicateCounts.set(key, (duplicateCounts.get(key) || 1) + 1);
    byBucket.set(key, mergeHeatmapPoints(existing, point));
  }

  if (process.env.NODE_ENV === "development" && duplicateCounts.size) {
    console.warn("[Infrastructure Heat Map] Duplicate service/time buckets merged.", Object.fromEntries(duplicateCounts));
  }

  return services.flatMap((service) => buckets.map((bucket) => byBucket.get(`${service.key}|${bucket.start.toISOString()}`) || emptyHeatmapPoint(service, bucket)));
}

function normalizeHeatmapPoint(point: HeatmapPoint, bucket: { start: Date; end: Date; label: string }): HeatmapPoint {
  const status = normalizeHeatStatus(point.status);
  return {
    ...point,
    serviceName: point.serviceName || point.serviceKey,
    bucket: bucket.label,
    bucketStartAt: bucket.start.toISOString(),
    bucketEndAt: bucket.end.toISOString(),
    status,
    totalChecks: safeCount(point.totalChecks),
    healthyChecks: safeCount(point.healthyChecks),
    degradedChecks: safeCount(point.degradedChecks),
    criticalChecks: safeCount(point.criticalChecks),
    cannotVerifyChecks: safeCount(point.cannotVerifyChecks),
    availableChecks: safeCount(point.availableChecks),
    incidentCount: safeCount(point.incidentCount ?? (safeCount(point.degradedChecks) + safeCount(point.criticalChecks) + safeCount(point.cannotVerifyChecks))),
    checkedAt: validDateIso(point.checkedAt),
    responseTimeMs: safeNumber(point.responseTimeMs),
    maxResponseTimeMs: safeNumber(point.maxResponseTimeMs),
    noDataMessage: point.noDataMessage || null
  };
}

function mergeHeatmapPoints(left: HeatmapPoint, right: HeatmapPoint): HeatmapPoint {
  const totalChecks = left.totalChecks + right.totalChecks;
  const responseTotal = (left.responseTimeMs || 0) * left.totalChecks + (right.responseTimeMs || 0) * right.totalChecks;
  const responseCount = (left.responseTimeMs === null ? 0 : left.totalChecks) + (right.responseTimeMs === null ? 0 : right.totalChecks);
  const checkedAt = latestValidDate(left.checkedAt, right.checkedAt);
  return {
    ...left,
    serviceName: left.serviceName || right.serviceName,
    status: heatStatusPriority[right.status] > heatStatusPriority[left.status] ? right.status : left.status,
    totalChecks,
    healthyChecks: left.healthyChecks + right.healthyChecks,
    degradedChecks: left.degradedChecks + right.degradedChecks,
    criticalChecks: left.criticalChecks + right.criticalChecks,
    cannotVerifyChecks: safeCount(left.cannotVerifyChecks) + safeCount(right.cannotVerifyChecks),
    availableChecks: safeCount(left.availableChecks) + safeCount(right.availableChecks),
    incidentCount: safeCount(left.incidentCount) + safeCount(right.incidentCount),
    checkedAt,
    responseTimeMs: responseCount ? Math.round(responseTotal / responseCount) : null,
    maxResponseTimeMs: maxNullable(left.maxResponseTimeMs, right.maxResponseTimeMs),
    noDataMessage: totalChecks ? null : left.noDataMessage || right.noDataMessage
  };
}

function emptyHeatmapPoint(service: ServiceHealth, bucket: { start: Date; end: Date; label: string }): HeatmapPoint {
  return {
    serviceKey: service.key,
    serviceName: service.serviceName,
    bucket: bucket.label,
    bucketStartAt: bucket.start.toISOString(),
    bucketEndAt: bucket.end.toISOString(),
    totalChecks: 0,
    healthyChecks: 0,
    degradedChecks: 0,
    criticalChecks: 0,
    cannotVerifyChecks: 0,
    availableChecks: 0,
    incidentCount: 0,
    status: "no_data",
    checkedAt: null,
    responseTimeMs: null,
    maxResponseTimeMs: null,
    noDataMessage: "No monitoring data available"
  };
}

function heatmapPointBucketStart(point: HeatmapPoint, range: RangeKey) {
  for (const value of [point.bucketStartAt, point.bucket, point.checkedAt]) {
    const timestamp = safeDateTime(value);
    if (timestamp === null) continue;
    const date = new Date(timestamp);
    if (range === "24h") date.setMinutes(0, 0, 0);
    else date.setHours(0, 0, 0, 0);
    return date.getTime();
  }
  return null;
}

function heatmapBlockCount(range: RangeKey) {
  return range === "24h" ? 24 : range === "7d" ? 7 : 30;
}

function safeCount(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function safeNumber(value: unknown) {
  const number = Number(value);
  return value !== null && value !== undefined && Number.isFinite(number) ? number : null;
}

function maxNullable(left?: number | null, right?: number | null) {
  const values = [safeNumber(left), safeNumber(right)].filter((value): value is number => value !== null);
  return values.length ? Math.max(...values) : null;
}

function latestValidDate(left?: string | null, right?: string | null) {
  const values = [validDateIso(left), validDateIso(right)].filter((value): value is string => Boolean(value));
  return values.sort((a, b) => safeDateTime(b)! - safeDateTime(a)!)[0] || null;
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return <span className="inline-flex items-center gap-2"><span className={`h-3 w-3 rounded-sm ${className}`} />{label}</span>;
}

function AgentVerifiedClients({ rows }: { rows: ClientConnectivityHistoryRow[] }) {
  const grouped = rows.reduce((clients, row) => {
    const key = `${row.clientId || row.hostname || row.username}|${row.serviceName}`;
    clients.set(key, [...(clients.get(key) || []), row]);
    return clients;
  }, new Map<string, ClientConnectivityHistoryRow[]>());
  const services = Array.from(grouped.values()).map((serviceRows) => {
    const latest = serviceRows[0];
    const confirmed = serviceRows.filter((row) => row.status !== "CANNOT_VERIFY");
    const available = confirmed.filter((row) => row.status === "ONLINE" || row.status === "SLOW").length;
    return { latest, availability: confirmed.length ? Math.round(available * 10000 / confirmed.length) / 100 : 0 };
  });
  if (!services.length) return null;
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950 p-5">
      <h2 className="text-lg font-semibold text-white">Agent Verified Client Services</h2>
      <p className="mt-1 text-sm text-slate-400">Confirmed connectivity measurements reported by OpsCenter Agent.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {services.map(({ latest: row, availability }, index) => (
          <article key={`agent-client-${row.clientId || row.hostname || row.username}-${row.serviceName}-${row.checkedAt || row.id}-${index}`} className="rounded-md border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{row.serviceName}</p>
                <p className="mt-1 text-xs text-slate-400">{row.hostname || row.clientId || row.username} {row.ipAddress ? `(${row.ipAddress})` : ""}</p>
              </div>
              <SourceBadge label="Agent Verified" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric label="Status" value={row.status.replaceAll("_", " ")} />
              <Metric label="Real Client Response Time" value={formatMs(row.responseTimeMs)} />
              <Metric label="Real Availability" value={`${availability}%`} />
              <Metric label="Last Checked" value={formatDate(row.checkedAt)} />
              <Metric label="Packet Loss" value={row.packetLoss === null ? "N/A" : `${row.packetLoss}%`} />
              <Metric label="DNS" value={row.dnsStatus || "N/A"} />
              <Metric label="Department" value={row.department || "N/A"} />
              <Metric label="Block" value={row.block || "N/A"} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ClientConnectivityHistory({ rows, filters, onFilters, onApply }: {
  rows: ClientConnectivityHistoryRow[];
  filters: ClientHistoryFilters;
  onFilters: (filters: ClientHistoryFilters) => void;
  onApply: () => void;
}) {
  const update = (key: keyof ClientHistoryFilters, value: string) => onFilters({ ...filters, [key]: value });
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Client Connectivity History</h2>
          <p className="mt-1 text-sm text-slate-400">Local browser/computer connectivity records saved separately from official server monitoring.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={filters.user} onChange={(event) => update("user", event.target.value)} placeholder="User" className="w-32 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
          <input value={filters.serviceName} onChange={(event) => update("serviceName", event.target.value)} placeholder="Service" className="w-36 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
          <input value={filters.department} onChange={(event) => update("department", event.target.value)} placeholder="Department" className="w-36 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
          <input value={filters.block} onChange={(event) => update("block", event.target.value)} placeholder="Block" className="w-28 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
          <select value={filters.role} onChange={(event) => update("role", event.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100">
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="engineer">Engineer</option>
            <option value="employee">Employee</option>
          </select>
          <select value={filters.status} onChange={(event) => update("status", event.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100">
            <option value="">All statuses</option>
            <option value="ONLINE">Online</option>
            <option value="SLOW">Slow</option>
            <option value="OFFLINE">Offline</option>
            <option value="CANNOT_VERIFY">Cannot verify</option>
            <option value="DNS_FAILED">DNS failed</option>
            <option value="CERTIFICATE_ERROR">Certificate error</option>
            <option value="PROXY_BLOCKED">Proxy blocked</option>
          </select>
          <select value={filters.source} onChange={(event) => update("source", event.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100">
            <option value="">All sources</option>
            <option value="BROWSER_CHECK">Browser Check</option>
            <option value="OPSCENTER_AGENT">Agent Verified</option>
            <option value="BACKEND_VERIFIED">Backend Verified</option>
          </select>
          <input value={filters.serviceType} onChange={(event) => update("serviceType", event.target.value)} placeholder="Service type" className="w-32 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
          <select value={filters.range} onChange={(event) => update("range", event.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100">
            <option value="24h">24h</option>
            <option value="7d">7d</option>
            <option value="30d">30d</option>
          </select>
          <input type="date" value={filters.dateFrom} onChange={(event) => update("dateFrom", event.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
          <input type="date" value={filters.dateTo} onChange={(event) => update("dateTo", event.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
          <button type="button" onClick={onApply} className="rounded-md bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950">Apply</button>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-3 pr-4">User</th>
              <th className="py-3 pr-4">Role</th>
              <th className="py-3 pr-4">Service</th>
              <th className="py-3 pr-4">Source</th>
              <th className="py-3 pr-4">Host / Department</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Response</th>
              <th className="py-3 pr-4">Checked At</th>
              <th className="py-3 pr-4">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {rows.map((row, index) => (
              <tr key={`client-history-${row.id}-${row.clientId || row.hostname || row.username}-${row.serviceName}-${row.checkedAt}-${index}`}>
                <td className="py-3 pr-4 font-semibold text-white">{row.username}</td>
                <td className="py-3 pr-4">{row.userRole}</td>
                <td className="py-3 pr-4">{row.serviceName}</td>
                <td className="py-3 pr-4"><SourceBadge label={row.sourceLabel} /></td>
                <td className="py-3 pr-4">{row.hostname || "N/A"}{row.department ? ` / ${row.department}` : ""}</td>
                <td className="py-3 pr-4"><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${clientHistoryStatusClass(row.status)}`}>{row.status.replace("_", " ")}</span></td>
                <td className="py-3 pr-4">{formatMs(row.responseTimeMs)}</td>
                <td className="py-3 pr-4">{formatDate(row.checkedAt)}</td>
                <td className="max-w-xs truncate py-3 pr-4" title={row.errorReason || row.browserInfo}>{row.errorReason || row.browserInfo || "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <p className="py-6 text-sm text-slate-500">No client connectivity history found.</p> : null}
      </div>
    </section>
  );
}

function clientHistoryStatusClass(status: ClientConnectivityHistoryRow["status"]) {
  if (status === "ONLINE") return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
  if (status === "SLOW" || status === "CANNOT_VERIFY") return "border-amber-400/40 bg-amber-400/10 text-amber-200";
  return "border-red-400/40 bg-red-400/10 text-red-200";
}

type ClientServiceDefinition = {
  key: ServiceKey;
  serviceName: string;
  serviceType: string;
  url: string;
  monitoringEnabled: boolean;
  supportTeam?: string;
  contactNumber?: string;
  supportEmail?: string;
  escalationNote?: string;
  message: string;
};

function buildClientServices(configuredServices: InfrastructureServiceConfig[], currentServices: ServiceHealth[]): ClientServiceDefinition[] {
  const configuredById = new Map(configuredServices.map((service) => [service.id, service]));
  const configuredByKnownKey = new Map(configuredServices.map((service) => [knownClientServiceKey(service.name), service]).filter(([key]) => Boolean(key)) as Array<[ServiceKey, InfrastructureServiceConfig]>);
  const currentByKey = new Map(currentServices.map((service) => [service.key, service]));
  const hpep = configuredById.get("hpep-intranet") || currentByKey.get("hpep-intranet");
  const bhel = configuredById.get("bhel-webmail") || currentByKey.get("bhel-webmail");

  const baseServices: ClientServiceDefinition[] = clientStaticServices.map((service) => {
    const configured = service.key === "hpep-intranet"
      ? hpep
      : service.key === "bhel-webmail"
        ? bhel
        : configuredById.get(service.key) || configuredByKnownKey.get(service.key);
    const url = service.key === "client-intranet" ? String(hpep?.url || "") : String(configured?.url || service.url || "");
    return {
      key: service.key,
      serviceName: service.serviceName,
      serviceType: service.serviceType,
      url,
      monitoringEnabled: configured?.monitoringEnabled ?? true,
      supportTeam: configured?.supportTeam,
      contactNumber: configured?.contactNumber,
      supportEmail: configured?.supportEmail,
      escalationNote: configured?.escalationNote,
      message: service.key === "client-intranet" && url ? "Browser intranet reachability check" : service.message
    };
  });

  const defaultConfigured: ClientServiceDefinition[] = [
    {
      key: "hpep-intranet",
      serviceName: "HPEP Intranet",
      serviceType: "INTRANET",
      url: String(hpep?.url || ""),
      monitoringEnabled: hpep?.monitoringEnabled ?? true,
      supportTeam: hpep?.supportTeam,
      contactNumber: hpep?.contactNumber,
      supportEmail: hpep?.supportEmail,
      escalationNote: hpep?.escalationNote,
      message: "HPEP checked from this browser"
    },
    {
      key: "bhel-webmail",
      serviceName: "BHEL Webmail",
      serviceType: "CUSTOM_LOCAL_SERVICE",
      url: String(bhel?.url || ""),
      monitoringEnabled: bhel?.monitoringEnabled ?? true,
      supportTeam: bhel?.supportTeam,
      contactNumber: bhel?.contactNumber,
      supportEmail: bhel?.supportEmail,
      escalationNote: bhel?.escalationNote,
      message: "BHEL Webmail checked from this browser"
    }
  ];

  const customServices = configuredServices
    .filter((service) => !service.isDefault && !knownClientServiceKey(service.name))
    .map((service) => ({
      key: `custom-${service.id}`,
      serviceName: service.name,
      serviceType: "CUSTOM_LOCAL_SERVICE",
      url: service.url,
      monitoringEnabled: service.monitoringEnabled,
      supportTeam: service.supportTeam,
      contactNumber: service.contactNumber,
      supportEmail: service.supportEmail,
      escalationNote: service.escalationNote,
      message: "Custom service checked from this browser"
    }));

  const byKey = new Map<ServiceKey, ClientServiceDefinition>();
  for (const service of [...baseServices, ...defaultConfigured, ...customServices]) {
    byKey.set(service.key, service);
  }
  return [
    ...clientBaseOrder.map((key) => byKey.get(key)).filter((service): service is ClientServiceDefinition => Boolean(service)),
    ...Array.from(byKey.values()).filter((service) => !clientBaseOrder.includes(service.key))
  ];
}

function dedupeServicesByKey<T extends { key: ServiceKey; serviceName?: string }>(services: T[]) {
  const byKey = new Map<ServiceKey, T>();
  for (const service of Array.isArray(services) ? services : []) {
    if (!service?.key) continue;
    if (!byKey.has(service.key)) byKey.set(service.key, service);
  }
  return Array.from(byKey.values());
}

function knownClientServiceKey(name: string): ServiceKey | "" {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized.includes("networkhealth")) return "network-health";
  if (normalized.includes("dynacon")) return "dynacon-assets";
  if (normalized.includes("karexpert")) return "karexpert";
  if (normalized.includes("beams")) return "beams";
  if (normalized.includes("digit")) return "digit";
  if (normalized === "google" || normalized.includes("googleservice")) return "google-service";
  return "";
}

async function checkFromBrowser(service: ClientServiceDefinition): Promise<ClientSample> {
  const checkedAt = new Date().toISOString();
  const started = performance.now();
  const timeoutMs = 8000;
  if (!service.monitoringEnabled) {
    return clientSample(service, checkedAt, "disabled", "Monitoring Disabled", null, "Monitoring disabled");
  }
  if (!service.url) {
    return clientSample(service, checkedAt, "unknown", "Cannot verify", null, "Service URL not configured for browser check");
  }
  if (!/^https?:\/\//i.test(service.url) && !service.url.startsWith("/")) {
    return clientSample(service, checkedAt, "unknown", "Cannot verify", null, "URL cannot be checked from browser");
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    if (service.key === "client-backend-api") {
      await api.get("/health", { signal: controller.signal });
    } else if (service.key === "client-internet") {
      await fetch(service.url, { method: "GET", mode: "no-cors", cache: "no-store", signal: controller.signal });
    } else {
      let response = await fetch(service.url, { method: "HEAD", mode: "cors", cache: "no-store", signal: controller.signal });
      if (response.status === 405) {
        response = await fetch(service.url, { method: "GET", mode: "cors", cache: "no-store", signal: controller.signal });
      }
      if (!response.ok) {
        return clientSample(service, checkedAt, "offline", "Offline", null, `HTTP ${response.status}`);
      }
    }
    const responseTimeMs = Math.round(performance.now() - started);
    const slow = responseTimeMs >= 500;
    return clientSample(service, checkedAt, slow ? "slow" : "online", slow ? "Slow" : "Online", responseTimeMs, slow ? "Slow response from this computer" : "Reachable from this computer");
  } catch (error) {
    const responseTimeMs = Math.round(performance.now() - started);
    if (isBrowserTimeoutError(error)) {
      return clientSample(service, checkedAt, "unknown", "Timed Out", responseTimeMs, browserCannotVerifyMessage);
    }
    if (!browserOnlyServices.has(service.key) && isCrossOriginUrl(service.url)) {
      return clientSample(service, checkedAt, "unknown", "Cannot verify", responseTimeMs, browserCannotVerifyMessage);
    }
    return clientSample(service, checkedAt, "offline", "Offline", responseTimeMs, "Not reachable from this computer");
  } finally {
    window.clearTimeout(timeout);
  }
}

async function saveClientSample(sample: ClientSample) {
  try {
    await axios.post(`${getApiBaseUrl()}/client-connectivity/history`, {
      serviceName: sample.serviceName,
      serviceType: sample.serviceType,
      targetUrl: sample.url || "",
      status: clientStatusToOracleStatus(sample.status),
      responseTimeMs: sample.responseTimeMs,
      checkedAt: sample.checkedAt,
      checkedFrom: "Browser Check",
      source: "BROWSER_CHECK",
      browserInfo: typeof navigator !== "undefined" ? navigator.userAgent : "",
      errorReason: sample.status === "unknown" ? sample.message : sample.status === "offline" ? sample.message : ""
    }, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getSessionToken() || ""}`
      }
    });
  } catch {
    // Background troubleshooting samples must not interrupt the monitoring UI.
  }
}

function clientStatusToOracleStatus(status: ServiceHealth["status"]) {
  if (status === "healthy" || status === "online") return "ONLINE";
  if (status === "slow") return "SLOW";
  if (status === "offline") return "OFFLINE";
  return "CANNOT_VERIFY";
}

function clientSample(service: ClientServiceDefinition, checkedAt: string, status: ServiceHealth["status"], statusLabel: string, responseTimeMs: number | null, message: string): ClientSample {
  return {
    id: `${service.key}-${checkedAt}`,
    serviceKey: service.key,
    serviceName: service.serviceName,
    serviceType: service.serviceType,
    checkedAt,
    status,
    statusLabel,
    responseTimeMs,
    message,
    url: service.url,
    supportTeam: service.supportTeam,
    contactNumber: service.contactNumber,
    supportEmail: service.supportEmail,
    escalationNote: service.escalationNote
    ,
    source: "BROWSER_CHECK",
    sourceLabel: "Browser Check",
    packetLoss: null,
    dnsStatus: "",
    errorReason: status === "unknown" || status === "offline" ? message : ""
  };
}

function clientSampleToHealth(service: ClientServiceDefinition, sample?: ClientSample): ServiceHealth {
  const status = sample?.status || "unknown";
  const verifiedTotal = isVerifiedClientStatus(status) ? 1 : 0;
  const successfulChecks = isSuccessfulClientStatus(status) ? 1 : 0;
  return {
    key: service.key,
    serviceName: service.serviceName,
    status,
    statusLabel: sample?.statusLabel || "Waiting",
    responseTimeMs: sample?.responseTimeMs ?? null,
    latencyMs: null,
    packetLossPercent: sample?.packetLoss ?? null,
    dnsStatus: sample?.dnsStatus || null,
    dnsResponseTimeMs: null,
    lastCheckedAt: sample?.checkedAt || "",
    availabilityPercent: verifiedTotal ? Math.round((successfulChecks / verifiedTotal) * 100) : 0,
    incidentCount: status === "slow" || status === "offline" ? 1 : 0,
    message: sample?.message || service.message,
    url: service.url,
    monitoringEnabled: service.monitoringEnabled,
    supportTeam: service.supportTeam,
    contactNumber: service.contactNumber,
    supportEmail: service.supportEmail,
    escalationNote: service.escalationNote,
    internetStatus: service.key === "client-internet" ? (status === "online" || status === "healthy" || status === "slow" ? "Online" : "Offline") : undefined,
    source: sample?.source || "BROWSER_CHECK",
    sourceLabel: sample?.sourceLabel || "Browser Check",
    hostname: sample?.hostname,
    ipAddress: sample?.ipAddress,
    department: sample?.department,
    block: sample?.block
  };
}

function mergeClientSamples(existing: ClientSample[], incoming: ClientSample[], range: RangeKey) {
  const cutoff = clientRangeCutoff(range);
  const byId = new Map<string, ClientSample>();
  for (const sample of [...existing, ...incoming]) {
    const checkedAt = safeDateTime(sample.checkedAt);
    if (checkedAt !== null && checkedAt >= cutoff) byId.set(sample.id, sample);
  }
  return Array.from(byId.values()).sort((left, right) => (safeDateTime(left.checkedAt) || 0) - (safeDateTime(right.checkedAt) || 0));
}

function clientHistoryRowsToSamples(rows: ClientConnectivityHistoryRow[], services: ClientServiceDefinition[]) {
  const servicesByName = new Map(services.map((service) => [service.serviceName.toLowerCase(), service]));
  return rows.map((row) => {
    const service = servicesByName.get(row.serviceName.toLowerCase());
    const serviceKey = service?.key || knownClientServiceKey(row.serviceName) || `client-history-${row.serviceName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    return {
      id: `client-history-${row.id}`,
      serviceKey,
      serviceName: row.serviceName,
      serviceType: row.serviceType,
      checkedAt: row.checkedAt,
      status: oracleStatusToClientStatus(row.status),
      statusLabel: oracleStatusToLabel(row.status),
      responseTimeMs: row.responseTimeMs,
      message: row.errorReason || row.errorMessage || `${oracleStatusToLabel(row.status)} from ${row.sourceLabel}`,
      url: row.targetUrl,
      supportTeam: service?.supportTeam,
      contactNumber: service?.contactNumber,
      supportEmail: service?.supportEmail,
      escalationNote: service?.escalationNote,
      source: row.source,
      sourceLabel: row.sourceLabel,
      hostname: row.hostname,
      ipAddress: row.ipAddress,
      department: row.department,
      block: row.block,
      packetLoss: row.packetLoss,
      dnsStatus: row.dnsStatus,
      errorReason: row.errorReason
    } satisfies ClientSample;
  }).sort((left, right) => (safeDateTime(left.checkedAt) || 0) - (safeDateTime(right.checkedAt) || 0));
}

function clientRangeCutoff(range: RangeKey) {
  const days = range === "30d" ? 30 : range === "7d" ? 7 : 1;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function oracleStatusToClientStatus(status: ClientConnectivityHistoryRow["status"]): ServiceHealth["status"] {
  if (status === "ONLINE") return "online";
  if (status === "SLOW") return "slow";
  if (status === "OFFLINE") return "offline";
  return "unknown";
}

function oracleStatusToLabel(status: ClientConnectivityHistoryRow["status"]) {
  if (status === "ONLINE") return "Online";
  if (status === "SLOW") return "Slow";
  if (status === "OFFLINE") return "Offline";
  return "Cannot verify";
}

function clientSampleToHistoryPoint(sample: ClientSample): HistoryPoint {
  return {
    id: Number(sample.checkedAt.replace(/\D/g, "").slice(-9)) || 0,
    serviceKey: sample.serviceKey,
    serviceName: sample.serviceName,
    checkedAt: sample.checkedAt,
    status: sample.status === "unknown" ? "cannot_verify" : sample.status,
    responseTimeMs: sample.responseTimeMs,
    latencyMs: null,
    packetLossPercent: null,
    dnsStatus: null,
    dnsResponseTimeMs: null,
    availabilityPercent: sample.status === "online" || sample.status === "healthy" || sample.status === "slow" ? 100 : 0,
    errorMessage: sample.message
  };
}

function buildAgentVerifiedServices(rows: ClientAgentServiceHistoryRow[]): ServiceHealth[] {
  const latestByService = new Map<ServiceKey, ClientAgentServiceHistoryRow>();
  for (const row of rows) {
    const existing = latestByService.get(row.serviceKey);
    if (!existing || (safeDateTime(row.checkedAt) || 0) > (safeDateTime(existing.checkedAt) || 0)) latestByService.set(row.serviceKey, row);
  }
  return Array.from(latestByService.values()).map((latest) => {
    const serviceRows = rows.filter((row) => row.serviceKey === latest.serviceKey);
    const verifiedRows = serviceRows.filter((row) => row.status !== "cannot_verify");
    const availableRows = verifiedRows.filter((row) => row.status === "online" || row.status === "slow");
    const availabilityPercent = verifiedRows.length ? Math.round((availableRows.length / verifiedRows.length) * 10000) / 100 : 0;
    return {
      key: latest.serviceKey,
      serviceName: latest.serviceName,
      status: agentStatusToServiceStatus(latest.status),
      statusLabel: agentStatusLabel(latest.status),
      responseTimeMs: latest.latencyMs,
      latencyMs: null,
      packetLossPercent: null,
      dnsStatus: latest.dnsMs === null || latest.dnsMs === undefined ? null : `${latest.dnsMs} ms`,
      dnsResponseTimeMs: latest.dnsMs,
      lastCheckedAt: latest.checkedAt,
      availabilityPercent,
      incidentCount: serviceRows.filter((row) => row.status === "slow" || row.status === "offline").length,
      message: latest.errorMessage || "Verified by OpsCenter Agent",
      url: latest.targetUrl,
      monitoringEnabled: true,
      source: "OPSCENTER_AGENT",
      sourceLabel: "Agent Verified",
      hostname: latest.hostname,
      ipAddress: latest.clientId
    } satisfies ServiceHealth;
  }).sort((left, right) => left.serviceName.localeCompare(right.serviceName));
}

function agentHistoryToHistoryPoint(row: ClientAgentServiceHistoryRow): HistoryPoint {
  return {
    id: row.id,
    serviceKey: row.serviceKey,
    serviceName: row.serviceName,
    checkedAt: row.checkedAt,
    status: row.status,
    responseTimeMs: row.latencyMs,
    latencyMs: null,
    packetLossPercent: null,
    dnsStatus: null,
    dnsResponseTimeMs: row.dnsMs,
    availabilityPercent: row.status === "online" || row.status === "slow" ? 100 : 0,
    errorMessage: row.errorMessage,
    hostname: row.hostname
  };
}

function agentStatusToServiceStatus(status: ClientAgentServiceHistoryRow["status"]): ServiceHealth["status"] {
  if (status === "online") return "online";
  if (status === "slow") return "slow";
  if (status === "offline") return "offline";
  return "unknown";
}

function agentStatusLabel(status: ClientAgentServiceHistoryRow["status"]) {
  if (status === "online") return "Online";
  if (status === "slow") return "Slow";
  if (status === "offline") return "Offline";
  return "Cannot Verify";
}

function buildClientHeatmap(services: ClientServiceDefinition[], samples: ClientSample[], range: RangeKey): HeatmapPoint[] {
  const buckets = buildClientRangeBuckets(range);
  return dedupeServicesByKey(services).flatMap((service) => buckets.map((bucket) => {
    const bucketSamples = samples.filter((sample) => sample.serviceKey === service.key && sampleInBucket(sample, bucket.start, bucket.end));
    if (!bucketSamples.length) {
      return {
        serviceKey: service.key,
        serviceName: service.serviceName,
        bucket: bucket.label,
        totalChecks: 0,
        healthyChecks: 0,
        degradedChecks: 0,
        criticalChecks: 0,
        status: "no_data" as const,
        checkedAt: null,
        responseTimeMs: null,
        noDataMessage: "No client-side monitoring data available"
      };
    }
    const latest = bucketSamples.reduce((current, sample) => (safeDateTime(sample.checkedAt) || 0) > (safeDateTime(current.checkedAt) || 0) ? sample : current, bucketSamples[0]);
    const status = summarizeClientHeatStatus(bucketSamples);
    const responseTimes = bucketSamples.map((sample) => sample.responseTimeMs).filter((value): value is number => value !== null && value !== undefined);
    return {
      serviceKey: service.key,
      serviceName: service.serviceName,
      bucket: bucket.label,
      totalChecks: bucketSamples.length,
      healthyChecks: bucketSamples.filter((sample) => sample.status === "online" || sample.status === "healthy").length,
      degradedChecks: bucketSamples.filter((sample) => sample.status === "slow").length,
      criticalChecks: bucketSamples.filter((sample) => sample.status === "offline").length,
      status,
      checkedAt: latest.checkedAt,
      responseTimeMs: responseTimes.length ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length) : null,
      noDataMessage: null
    };
  }));
}

function clientStatusToHeatStatus(status: ServiceHealth["status"]): HeatmapPoint["status"] {
  if (status === "healthy" || status === "online") return "healthy";
  if (status === "slow") return "degraded";
  if (status === "unknown") return "cannot_verify";
  if (status === "offline") return "critical";
  return "no_data";
}

function summarizeClientHeatStatus(samples: ClientSample[]): HeatmapPoint["status"] {
  if (samples.some((sample) => sample.status === "offline")) return "critical";
  if (samples.some((sample) => sample.status === "slow")) return "degraded";
  if (samples.some((sample) => sample.status === "unknown")) return "cannot_verify";
  if (samples.some((sample) => sample.status === "online" || sample.status === "healthy")) return "healthy";
  return "no_data";
}

function buildClientRangeBuckets(range: RangeKey) {
  const count = range === "24h" ? 24 : range === "7d" ? 7 : 30;
  const now = new Date();
  if (range === "24h") {
    const anchor = new Date(now);
    anchor.setMinutes(0, 0, 0);
    return Array.from({ length: count }).map((_, index) => {
      const start = new Date(anchor);
      start.setHours(anchor.getHours() - (count - 1 - index));
      const end = new Date(start);
      end.setHours(start.getHours() + 1);
      return { start, end, label: `${start.toISOString().slice(0, 13)}:00` };
    });
  }
  const anchor = new Date(now);
  anchor.setHours(0, 0, 0, 0);
  return Array.from({ length: count }).map((_, index) => {
    const start = new Date(anchor);
    start.setDate(anchor.getDate() - (count - 1 - index));
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    return { start, end, label: start.toISOString().slice(0, 10) };
  });
}

function sampleInBucket(sample: ClientSample, start: Date, end: Date) {
  const checkedAt = safeDateTime(sample.checkedAt);
  if (checkedAt === null) return false;
  return Number.isFinite(checkedAt) && checkedAt >= start.getTime() && checkedAt < end.getTime();
}

function isCrossOriginUrl(value: string) {
  try {
    const url = new URL(value, window.location.origin);
    const apiUrl = new URL(getApiBaseUrl(), window.location.origin);
    return url.origin !== window.location.origin && url.origin !== apiUrl.origin;
  } catch {
    return true;
  }
}

function isBrowserTimeoutError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const namedError = error as Error & { code?: string };
  return namedError.name === "AbortError" || namedError.name === "CanceledError" || namedError.code === "ERR_CANCELED";
}

const IncidentTimeline = memo(function IncidentTimeline({ incidents }: { incidents: Incident[] }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950 p-5">
      <h2 className="text-lg font-semibold text-white">Incident Timeline</h2>
      <div className="mt-4 max-h-96 space-y-3 overflow-auto">
        {incidents.map((incident, index) => (
          <div key={`incident-${incident.id}-${incident.serviceKey}-${incident.checkedAt}-${index}`} className="rounded-md border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-100">{incident.type}</p>
                <p className="mt-1 text-sm text-slate-400">{incident.serviceName} - {incident.message}</p>
                {isActionRequired(incident.status) ? (
                  <p className="mt-2 text-xs font-semibold text-amber-200">{supportLine(incident)}</p>
                ) : null}
              </div>
              <span className="text-xs text-slate-500">{formatDate(incident.checkedAt)}</span>
            </div>
          </div>
        ))}
        {!incidents.length ? <p className="text-sm text-slate-500">No incidents in this range.</p> : null}
      </div>
    </section>
  );
});

const AvailabilityReports = memo(function AvailabilityReports({ reports, services }: { reports: ReportRow[]; services: ServiceHealth[] }) {
  const rows = useMemo(() => services.map((service) => {
    const report = reports.find((row) => row.serviceKey === service.key);
    return {
      serviceKey: service.key,
      serviceName: service.serviceName,
      disabled: service.status === "disabled",
      availabilityPercent: report?.availabilityPercent ?? service.availabilityPercent ?? 0,
      averageResponseTimeMs: report?.averageResponseTimeMs ?? service.responseTimeMs ?? service.latencyMs ?? null,
      totalDowntimeMinutes: report?.totalDowntimeMinutes ?? 0,
      incidentCount: report?.incidentCount ?? 0,
      totalChecks: report?.totalChecks ?? 0,
      supportTeam: report?.supportTeam || service.supportTeam || "",
      contactNumber: report?.contactNumber || service.contactNumber || ""
    };
  }), [reports, services]);

  const exportCsv = useCallback(() => {
    const header = "Service,Support Team,Contact Number,Availability %,Average Response ms,Total Downtime Minutes,Incident Count,Checks";
    const csvRows = rows.map((row) => [
      row.serviceName,
      row.supportTeam,
      row.contactNumber,
      row.disabled ? "Disabled" : row.availabilityPercent,
      row.disabled ? "" : row.averageResponseTimeMs ?? "",
      row.disabled ? "" : row.totalDowntimeMinutes,
      row.disabled ? "" : row.incidentCount,
      row.totalChecks
    ].join(","));
    const blob = new Blob([[header, ...csvRows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "infrastructure-availability.csv";
    link.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  const exportPdf = useCallback(() => {
    window.print();
  }, []);

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
              <th className="py-3 pr-4">Support Team</th>
              <th className="py-3 pr-4">Contact</th>
              <th className="py-3 pr-4">Availability</th>
              <th className="py-3 pr-4">Avg Response</th>
              <th className="py-3 pr-4">Downtime</th>
              <th className="py-3 pr-4">Incidents</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {rows.map((row, index) => (
              <tr key={`availability-${row.serviceKey}-${index}`}>
                <td className="py-3 pr-4 font-semibold text-white">{row.serviceName}</td>
                <td className="py-3 pr-4">{row.supportTeam || "Not configured"}</td>
                <td className="py-3 pr-4">{row.contactNumber || "Not configured"}</td>
                <td className="py-3 pr-4">{row.disabled ? "Monitoring Disabled" : `${row.availabilityPercent}%`}</td>
                <td className="py-3 pr-4">{row.disabled ? "N/A" : formatMs(row.averageResponseTimeMs)}</td>
                <td className="py-3 pr-4">{row.disabled ? "N/A" : `${row.totalDowntimeMinutes}m`}</td>
                <td className="py-3 pr-4">{row.disabled ? "N/A" : row.incidentCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
});

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2"><p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 truncate text-sm font-semibold text-slate-100">{value}</p></div>;
}

function ActionRequired({ service }: { service?: Partial<ServiceHealth> }) {
  const configured = Boolean(service?.supportTeam || service?.contactNumber || service?.supportEmail || service?.escalationNote);
  return (
    <div className="mt-4 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-3 text-sm">
      <p className="font-semibold text-amber-100">Action Required</p>
      {configured ? (
        <div className="mt-2 space-y-1 text-xs font-semibold text-amber-50/90">
          <p>Contact: {service?.supportTeam || "Support contact not configured"}</p>
          <p>Phone/Ext: {service?.contactNumber || "Support contact not configured"}</p>
          {service?.supportEmail ? <p>Email: {service.supportEmail}</p> : null}
          {service?.escalationNote ? <p>Note: {service.escalationNote}</p> : null}
        </div>
      ) : (
        <p className="mt-2 text-xs font-semibold text-amber-100">Support contact not configured</p>
      )}
    </div>
  );
}

function CannotVerifyInfo() {
  return (
    <div className="mt-4 rounded-md border border-slate-700 bg-slate-900 px-3 py-3 text-sm">
      <p className="font-semibold text-slate-100">Browser Check Cannot Verify</p>
      <p className="mt-1 text-xs font-semibold text-slate-400">{browserCannotVerifyMessage}</p>
      <p className="mt-1 text-xs font-semibold text-slate-400">Browser security may block verification. Use OpsCenter Agent for real enterprise client status.</p>
    </div>
  );
}

function StatusBadge({ status, label, viewMode = "server" }: { status: string; label: string; viewMode?: ViewMode }) {
  const classes = status === "disabled" || (viewMode === "client" && status === "unknown") ? "border-slate-400/40 bg-slate-400/10 text-slate-200" : status === "healthy" || status === "online" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : status === "slow" || status === "unknown" ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : "border-red-400/40 bg-red-400/10 text-red-200";
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>{label}</span>;
}

function OutageDot(props: any) {
  const status = props.payload?.status;
  if (props.value === null || props.value === undefined) return null;
  if (status === "slow") return <circle cx={props.cx} cy={props.cy} r={4} fill="#f97316" stroke="#020617" strokeWidth={1.5} />;
  if (status === "offline" || status === "unknown" || status === "cannot_verify") return <circle cx={props.cx} cy={props.cy} r={4} fill="#ef4444" stroke="#020617" strokeWidth={1.5} />;
  return null;
}

function ClientOutageDot(props: any) {
  const status = props.payload?.status;
  const incident = status === "offline" || status === "slow";
  const fill = status === "offline" ? "#ef4444" : status === "slow" ? "#f97316" : status === "cannot_verify" ? "#94a3b8" : "#22d3ee";
  return <circle cx={props.cx} cy={props.cy} r={props.single ? 5 : incident ? 4 : 3} fill={fill} />;
}

function withIncidentMarkers<T extends { value: number | null; markerValue: number | null; status: string }>(points: T[]) {
  return points.map((point, index) => {
    if (point.status !== "slow" && point.status !== "offline" && point.status !== "unknown" && point.status !== "cannot_verify") return point;
    return { ...point, markerValue: point.value ?? nearestValidValue(points, index) };
  });
}

function nearestValidValue(points: Array<{ value: number | null }>, index: number) {
  for (let offset = 1; offset < points.length; offset += 1) {
    const previous = points[index - offset]?.value;
    if (previous !== null && previous !== undefined) return previous;
    const next = points[index + offset]?.value;
    if (next !== null && next !== undefined) return next;
  }
  return null;
}

function statusText(status: string) {
  if (status === "healthy" || status === "online") return "Online";
  if (status === "slow") return "Slow";
  if (status === "offline") return "Offline";
  if (status === "unknown" || status === "cannot_verify") return "Cannot Verify";
  return status || "Unknown";
}

function EmptyChart({ viewMode = "server" }: { viewMode?: ViewMode }) {
  return <div className="grid h-full place-items-center rounded-md border border-slate-800 text-xs text-slate-500">{viewMode === "client" ? "No Data. Waiting for first browser check." : "Waiting for Oracle history"}</div>;
}

function heatClass(status: string) {
  if (status === "healthy") return "bg-emerald-500";
  if (status === "degraded") return "bg-amber-400";
  if (status === "critical") return "bg-red-500";
  if (status === "cannot_verify") return "bg-slate-500";
  return "bg-slate-700";
}

function heatStatusLabel(status: HeatmapPoint["status"]) {
  if (status === "healthy") return "Online/Healthy";
  if (status === "degraded") return "Slow";
  if (status === "critical") return "Offline/Down";
  if (status === "cannot_verify") return "Cannot Verify";
  return "No data";
}

function heatTooltip(point: HeatmapPoint, backendVerified = false) {
  if (backendVerified) {
    return [
      `Service: ${point.serviceName}`,
      `Time range: ${formatTimeRange(point.bucketStartAt, point.bucketEndAt, point.bucket)}`,
      `Final block status: ${heatStatusLabel(point.status)}`,
      `Total checks: ${point.totalChecks}`,
      `Average response time: ${formatMs(point.responseTimeMs)}`,
      `Max response time: ${formatMs(point.maxResponseTimeMs)}`,
      `Incident count: ${point.incidentCount ?? point.degradedChecks + point.criticalChecks + (point.cannotVerifyChecks || 0)}`,
      "Checked From: Backend Verified"
    ].join("\n");
  }
  const lines = [
    `Service: ${point.serviceName}`,
    `Time range: ${formatTimeRange(point.bucketStartAt, point.bucketEndAt, point.bucket)}`,
    `Status: ${heatStatusLabel(point.status)}`,
    `Total checks: ${point.totalChecks}`,
    `Average response time: ${formatMs(point.responseTimeMs)}`,
    `Incident count: ${point.incidentCount ?? point.degradedChecks + point.criticalChecks + (point.cannotVerifyChecks || 0)}`,
    `Checked time: ${point.checkedAt ? formatDate(point.checkedAt) : "No record"}`,
    "Checked From: Browser Check"
  ];
  if (point.status === "no_data") lines.push(point.noDataMessage || "No monitoring data available");
  return lines.join("\n");
}

function formatTimeRange(start?: string | null, end?: string | null, fallback?: string) {
  const startTime = safeDateTime(start);
  const endTime = safeDateTime(end);
  if (startTime !== null && endTime !== null) {
    if (endTime - startTime >= 24 * 60 * 60 * 1000) {
      return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(startTime));
    }
    return `${formatHour(new Date(startTime))} - ${formatHour(new Date(endTime))}`;
  }
  if (!fallback) return "N/A";
  const bucketStart = new Date(fallback.replace(" ", "T"));
  if (Number.isNaN(bucketStart.getTime())) return fallback;
  const bucketEnd = new Date(bucketStart);
  bucketEnd.setHours(bucketStart.getHours() + 1);
  return `${formatHour(bucketStart)} - ${formatHour(bucketEnd)}`;
}

function formatHour(value: string | Date) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(value instanceof Date ? value : new Date(value));
}

function labelForService(key: ServiceKey) {
  if (key === "hpep-intranet") return "HPEP Intranet";
  if (key === "bhel-webmail") return "BHEL Webmail";
  if (key === "network-health") return "Network Health";
  return key;
}

function defaultSupportFor(key: ServiceKey) {
  if (key === "hpep-intranet") return { supportTeam: "IT Network Team", contactNumber: "", escalationNote: "Contact IT Network Team if HPEP Intranet is slow, offline, or down." };
  if (key === "bhel-webmail") return { supportTeam: "Mail/Admin Team", contactNumber: "", escalationNote: "Contact Mail/Admin Team if BHEL Webmail is slow, offline, or down." };
  return { supportTeam: "Network Team", contactNumber: "", escalationNote: "Contact Network Team if network health is degraded or critical." };
}

function isActionRequired(status?: string, viewMode: ViewMode = "server") {
  if (viewMode === "client") return status === "slow" || status === "offline";
  return status === "slow" || status === "offline";
}

function supportLine(item: { supportTeam?: string; contactNumber?: string }) {
  if (item.supportTeam && item.contactNumber) return `Contact ${item.supportTeam} at ${item.contactNumber}.`;
  if (item.supportTeam) return `Contact ${item.supportTeam}.`;
  if (item.contactNumber) return `Phone/Ext: ${item.contactNumber}.`;
  return "Support contact not configured";
}

function formatMs(value?: number | null) {
  return value === null || value === undefined ? "N/A" : `${value} ms`;
}

function formatBrowserAvailability(service?: ServiceHealth) {
  if (!service || !isVerifiedClientStatus(service.status)) return "N/A";
  return `${service.availabilityPercent}%`;
}

function formatDate(value?: string | null) {
  const timestamp = safeDateTime(value);
  if (timestamp === null) return "N/A";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}

function formatChartDate(value: string, viewMode: ViewMode, range: RangeKey) {
  const timestamp = safeDateTime(value);
  if (timestamp === null) return "N/A";
  return new Date(timestamp).toLocaleDateString([], viewMode === "client" || range === "24h" ? { hour: "2-digit", minute: "2-digit" } : { month: "short", day: "numeric" });
}

function safeDateTime(value?: string | null) {
  if (!value) return null;
  const heatmapHourKey = value.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})$/);
  if (heatmapHourKey) {
    const [, year, month, day, hour] = heatmapHourKey;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), 0, 0, 0).getTime();
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function validDateIso(value?: string | null) {
  const timestamp = safeDateTime(value);
  return timestamp === null ? null : new Date(timestamp).toISOString();
}
