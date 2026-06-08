import { lookup } from "dns/promises";
import { getConnection } from "../config/database";
import { writeAuditLog } from "./audit.service";
import { notifyAdmins } from "./notification.service";
import { getSystemSettings, type SystemSettings } from "./settings.service";
import { getCustomInfrastructureServices, getDefaultInfrastructureServicesWithSupport, type InfrastructureService } from "./infrastructureServices.service";

type ServiceKey = string;
type ServiceStatus = "healthy" | "online" | "slow" | "offline" | "unknown" | "disabled";
type RangeKey = "24h" | "7d" | "30d";
type HeatmapStatus = "healthy" | "degraded" | "critical" | "no_data" | "cannot_verify";

type ServiceDefinition = {
  key: ServiceKey;
  name: string;
  url: string;
  onlineLabel: "Healthy" | "Online";
  monitoringEnabled: boolean;
  isDefault: boolean;
  supportTeam: string;
  contactNumber: string;
  supportEmail: string;
  escalationNote: string;
};

export type ServiceHealthSnapshot = {
  key: ServiceKey;
  serviceName: string;
  status: ServiceStatus;
  statusLabel: string;
  responseTimeMs: number | null;
  latencyMs: number | null;
  packetLossPercent: number | null;
  dnsStatus: string | null;
  dnsResponseTimeMs: number | null;
  lastCheckedAt: string;
  lastSuccessfulCheckAt: string | null;
  availability: string;
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
};

export type ServiceHealthHistoryPoint = {
  id: number;
  serviceKey: ServiceKey;
  serviceName: string;
  checkedAt: string;
  status: ServiceStatus;
  responseTimeMs: number | null;
  latencyMs: number | null;
  packetLossPercent: number | null;
  dnsStatus: string | null;
  dnsResponseTimeMs: number | null;
  availabilityPercent: number;
  errorMessage: string | null;
  supportTeam: string;
  contactNumber: string;
  supportEmail: string;
  escalationNote: string;
};

const previousStatus = new Map<ServiceKey, ServiceStatus>();
const lastSuccessfulChecks = new Map<ServiceKey, string>();
const networkProbeUrl = "https://www.google.com/generate_204";
const dnsProbeHost = "google.com";
const defaultServiceOrder = ["hpep-intranet", "bhel-webmail", "network-health"];

function servicesFromSettings(settings: SystemSettings): ServiceDefinition[] {
  return [
    {
      key: "hpep-intranet",
      name: "HPEP Intranet",
      url: settings.infrastructure.hpepIntranetUrl,
      onlineLabel: "Healthy",
      monitoringEnabled: true,
      isDefault: true,
      supportTeam: "IT Network Team",
      contactNumber: "",
      supportEmail: "",
      escalationNote: "Contact IT Network Team if HPEP Intranet is slow, offline, or down."
    },
    {
      key: "bhel-webmail",
      name: "BHEL Webmail",
      url: settings.infrastructure.bhelWebmailUrl,
      onlineLabel: "Online",
      monitoringEnabled: true,
      isDefault: true,
      supportTeam: "Mail/Admin Team",
      contactNumber: "",
      supportEmail: "",
      escalationNote: "Contact Mail/Admin Team if BHEL Webmail is slow, offline, or down."
    }
  ];
}

function customServiceDefinition(service: InfrastructureService): ServiceDefinition {
  const support = knownSupportForService(service.name);
  return {
    key: `custom-${service.id}`,
    name: service.name,
    url: service.url,
    onlineLabel: "Online",
    monitoringEnabled: service.monitoringEnabled,
    isDefault: false,
    supportTeam: support?.supportTeam || service.supportTeam,
    contactNumber: support?.contactNumber || service.contactNumber,
    supportEmail: service.supportEmail,
    escalationNote: support?.escalationNote || service.escalationNote
  };
}

function knownSupportForService(serviceName: string) {
  const normalizedName = serviceName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalizedName.includes("dynacon")) {
    return {
      supportTeam: "Dynacon Support Team",
      contactNumber: "2447",
      escalationNote: "Contact Dynacon team if service is slow/offline/down."
    };
  }
  return null;
}

function defaultServiceDefinition(service: InfrastructureService, settings: SystemSettings): ServiceDefinition {
  const url = service.id === "hpep-intranet"
    ? settings.infrastructure.hpepIntranetUrl
    : service.id === "bhel-webmail"
      ? settings.infrastructure.bhelWebmailUrl
      : service.url;
  return {
    key: service.id,
    name: service.name,
    url,
    onlineLabel: service.id === "bhel-webmail" ? "Online" : "Healthy",
    monitoringEnabled: service.monitoringEnabled,
    isDefault: true,
    supportTeam: service.supportTeam,
    contactNumber: service.contactNumber,
    supportEmail: service.supportEmail,
    escalationNote: service.escalationNote
  };
}

function normalizeRange(range: unknown): RangeKey {
  return range === "7d" || range === "30d" ? range : "24h";
}

function rangeToInterval(range: string) {
  if (range === "7d") return "7";
  if (range === "30d") return "30";
  return "1";
}

function bucketFor(value: unknown, range: RangeKey) {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "unknown";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (range === "24h") {
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = Math.floor(date.getMinutes() / 5) * 5;
    return `${year}-${month}-${day} ${hour}:${padDatePart(minute)}`;
  }
  if (range === "7d") {
    const hour = String(date.getHours()).padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:00`;
  }
  if (range === "30d") {
    const hour = Math.floor(date.getHours() / 6) * 6;
    return `${year}-${month}-${day} ${padDatePart(hour)}:00`;
  }
  return `${year}-${month}-${day}`;
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function bucketLabel(date: Date, range: RangeKey) {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  if (range === "24h") return `${year}-${month}-${day} ${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
  if (range === "7d") return `${year}-${month}-${day} ${padDatePart(date.getHours())}:00`;
  if (range === "30d") return `${year}-${month}-${day} ${padDatePart(date.getHours())}:00`;
  return `${year}-${month}-${day}`;
}

function buildRangeBuckets(range: RangeKey) {
  const count = range === "24h" ? 288 : range === "7d" ? 168 : 120;
  const now = new Date();
  const anchor = new Date(now);
  if (range === "24h") {
    anchor.setMinutes(Math.floor(anchor.getMinutes() / 5) * 5, 0, 0);
  } else if (range === "7d") {
    anchor.setMinutes(0, 0, 0);
  } else {
    anchor.setHours(Math.floor(anchor.getHours() / 6) * 6, 0, 0, 0);
  }
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(anchor);
    if (range === "24h") date.setMinutes(anchor.getMinutes() - (count - 1 - index) * 5);
    else if (range === "7d") date.setHours(anchor.getHours() - (count - 1 - index));
    else date.setHours(anchor.getHours() - (count - 1 - index) * 6);
    return bucketLabel(date, range);
  });
}

function heatmapBucketFor(value: unknown, range: RangeKey) {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "unknown";
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hour = padDatePart(date.getHours());
  if (range === "24h") return `${year}-${month}-${day} ${hour}:00`;
  return `${year}-${month}-${day}`;
}

function buildHeatmapRangeBuckets(range: RangeKey) {
  const count = range === "24h" ? 24 : range === "7d" ? 7 : 30;
  const anchor = new Date();
  if (range === "24h") anchor.setMinutes(0, 0, 0);
  else anchor.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const start = new Date(anchor);
    if (range === "24h") start.setHours(anchor.getHours() - (count - 1 - index));
    else start.setDate(anchor.getDate() - (count - 1 - index));
    const end = new Date(start);
    if (range === "24h") end.setHours(start.getHours() + 1);
    else end.setDate(start.getDate() + 1);
    return {
      label: range === "24h" ? bucketLabel(start, "7d") : bucketLabel(start, range),
      start: start.toISOString(),
      end: end.toISOString()
    };
  });
}

function statusLabelFor(service: ServiceDefinition, status: ServiceStatus) {
  if (status === "disabled") return "Monitoring Disabled";
  if (status === "healthy" || status === "online") return service.onlineLabel;
  if (status === "slow") return "Slow";
  if (status === "unknown") return "Cannot verify";
  return "Offline";
}

function availabilityFor(status: ServiceStatus) {
  if (status === "disabled") return 0;
  if (status === "offline") return 0;
  if (status === "unknown") return 0;
  return 100;
}

function isIncident(status: ServiceStatus) {
  return status === "offline" || status === "slow" || status === "unknown";
}

async function ensureServiceHealthHistoryTable(connection: any) {
  const result = await connection.execute(
    `SELECT COUNT(*) AS count FROM user_tables WHERE table_name = 'SERVICE_HEALTH_HISTORY'`
  );
  const exists = Number(((result.rows || [])[0] as { COUNT?: number })?.COUNT || 0) > 0;
  if (exists) {
    await ensureServiceHealthHistoryColumns(connection);
    return;
  }

  await connection.execute(
    `CREATE TABLE service_health_history (
      id NUMBER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      service_key VARCHAR2(80) NOT NULL,
      service_name VARCHAR2(160) NOT NULL,
      checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      status VARCHAR2(30) NOT NULL,
      response_time_ms NUMBER,
      latency_ms NUMBER,
      packet_loss_percent NUMBER(5,2),
      dns_status VARCHAR2(40),
      dns_response_time_ms NUMBER,
      availability_percent NUMBER(5,2),
      error_message VARCHAR2(1000),
      support_team VARCHAR2(160),
      contact_number VARCHAR2(80),
      support_email VARCHAR2(160),
      escalation_note VARCHAR2(1000),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`
  );
  await connection.execute(`CREATE INDEX idx_service_health_hist_key_time ON service_health_history(service_key, checked_at)`);
  await connection.commit();
}

async function ensureServiceHealthHistoryColumns(connection: any) {
  const result = await connection.execute(
    `SELECT column_name FROM user_tab_columns WHERE table_name = 'SERVICE_HEALTH_HISTORY'`
  );
  const columns = new Set(((result.rows || []) as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME));
  const additions: Array<[string, string]> = [
    ["SUPPORT_TEAM", "support_team VARCHAR2(160)"],
    ["CONTACT_NUMBER", "contact_number VARCHAR2(80)"],
    ["SUPPORT_EMAIL", "support_email VARCHAR2(160)"],
    ["ESCALATION_NOTE", "escalation_note VARCHAR2(1000)"]
  ];
  for (const [column, ddl] of additions) {
    if (!columns.has(column)) {
      await connection.execute(`ALTER TABLE service_health_history ADD (${ddl})`);
    }
  }
}

function supportSummary(input: { supportTeam?: string; contactNumber?: string }) {
  if (!input.supportTeam && !input.contactNumber) return "";
  if (input.supportTeam && input.contactNumber) return `Contact ${input.supportTeam} at ${input.contactNumber}.`;
  if (input.supportTeam) return `Contact ${input.supportTeam}.`;
  return `Phone/Ext: ${input.contactNumber}.`;
}

async function recordOfflineTransition(connection: any, snapshot: ServiceHealthSnapshot) {
  const priorStatus = previousStatus.get(snapshot.key);
  previousStatus.set(snapshot.key, snapshot.status);
  if (!priorStatus || priorStatus === snapshot.status) return;

  const support = supportSummary(snapshot);
  const details = `${snapshot.serviceName} changed from ${priorStatus} to ${snapshot.status}. ${snapshot.message}${support ? ` ${support}` : ""}`;
  await writeAuditLog({ action: "service_health_status_change", details }, connection);
  if (snapshot.status === "offline") {
    await notifyAdmins({
      title: `${snapshot.serviceName} Offline`,
      body: `${snapshot.serviceName} is unreachable. ${snapshot.message}${support ? ` ${support}` : ""}`,
      category: "serviceOutage"
    }, connection);
  }
}

async function saveSnapshot(connection: any, snapshot: ServiceHealthSnapshot) {
  if (snapshot.status === "disabled") return;
  await ensureServiceHealthHistoryTable(connection);
  await connection.execute(
    `INSERT INTO service_health_history (
      service_key, service_name, checked_at, status, response_time_ms,
      latency_ms, packet_loss_percent, dns_status, dns_response_time_ms,
      availability_percent, error_message, support_team, contact_number,
      support_email, escalation_note
    ) VALUES (
      :serviceKey, :serviceName, SYSTIMESTAMP, :status, :responseTimeMs,
      :latencyMs, :packetLossPercent, :dnsStatus, :dnsResponseTimeMs,
      :availabilityPercent, :errorMessage, :supportTeam, :contactNumber,
      :supportEmail, :escalationNote
    )`,
    {
      serviceKey: snapshot.key,
      serviceName: snapshot.serviceName,
      status: snapshot.status,
      responseTimeMs: snapshot.responseTimeMs,
      latencyMs: snapshot.latencyMs,
      packetLossPercent: snapshot.packetLossPercent,
      dnsStatus: snapshot.dnsStatus,
      dnsResponseTimeMs: snapshot.dnsResponseTimeMs,
      availabilityPercent: snapshot.availabilityPercent,
      errorMessage: snapshot.message || null,
      supportTeam: snapshot.supportTeam || null,
      contactNumber: snapshot.contactNumber || null,
      supportEmail: snapshot.supportEmail || null,
      escalationNote: snapshot.escalationNote || null
    }
  );
  await recordOfflineTransition(connection, snapshot);
}

async function getHistoryStats(connection: any, serviceKey: ServiceKey, range: RangeKey = "24h") {
  await ensureServiceHealthHistoryTable(connection);
  const result = await connection.execute(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status IN ('offline', 'slow', 'unknown') THEN 1 ELSE 0 END) AS incidents,
       AVG(CASE WHEN status IN ('healthy', 'online', 'slow') THEN 100 ELSE 0 END) AS availability
     FROM service_health_history
     WHERE service_key = :serviceKey
       AND checked_at >= SYSTIMESTAMP - INTERVAL '${rangeToInterval(range)}' DAY`,
    { serviceKey }
  );
  const row = ((result.rows || [])[0] || {}) as Record<string, unknown>;
  const total = Number(row.TOTAL || 0);
  return {
    incidentCount: Number(row.INCIDENTS || 0),
    availabilityPercent: total ? Math.round(Number(row.AVAILABILITY || 0) * 100) / 100 : 100
  };
}

async function checkNetworkHealth(settings: SystemSettings): Promise<ServiceHealthSnapshot> {
  const checkedAt = new Date().toISOString();
  let dnsStatus = "Failed";
  let dnsResponseTimeMs: number | null = null;
  let internetStatus = "Offline";
  let status: ServiceStatus = "offline";
  let message = "Network unreachable";
  let latencyMs: number | null = null;

  const dnsStarted = Date.now();
  try {
    await lookup(dnsProbeHost);
    dnsResponseTimeMs = Date.now() - dnsStarted;
    dnsStatus = "Resolved";
  } catch {
    dnsResponseTimeMs = null;
  }

  const probes = await Promise.all(Array.from({ length: 4 }).map(async () => {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), settings.infrastructure.timeoutThresholdMs);
    try {
      const response = await fetch(networkProbeUrl, { method: "GET", signal: controller.signal });
      return response.ok ? Date.now() - started : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }));

  const successfulProbes = probes.filter((probe): probe is number => probe !== null);
  const packetLossPercent = Math.round(((probes.length - successfulProbes.length) / probes.length) * 100);

  if (successfulProbes.length) {
    latencyMs = Math.round(successfulProbes.reduce((sum, probe) => sum + probe, 0) / successfulProbes.length);
    internetStatus = "Online";
    if (packetLossPercent === 0 && dnsStatus === "Resolved" && latencyMs < settings.infrastructure.slowResponseThresholdMs) {
      status = "healthy";
      message = "Network operating normally";
      lastSuccessfulChecks.set("network-health", checkedAt);
    } else if (packetLossPercent < settings.infrastructure.packetLossThresholdPercent && dnsStatus === "Resolved") {
      status = "slow";
      message = "Network degradation detected";
    } else {
      status = "offline";
      message = "Unstable network connectivity";
    }
  }

  return {
    key: "network-health",
    serviceName: "Network Health",
    status,
    statusLabel: status === "healthy" ? "Healthy" : status === "slow" ? "Degraded" : "Critical",
    responseTimeMs: latencyMs,
    latencyMs,
    packetLossPercent,
    dnsStatus,
    dnsResponseTimeMs,
    lastCheckedAt: checkedAt,
    lastSuccessfulCheckAt: lastSuccessfulChecks.get("network-health") || null,
    availability: `${availabilityFor(status)}%`,
    availabilityPercent: availabilityFor(status),
    incidentCount: 0,
    message,
    url: "internal://network-health",
    monitoringEnabled: true,
    isDefault: true,
    supportTeam: "Network Team",
    contactNumber: "",
    supportEmail: "",
    escalationNote: "Contact Network Team if network health is degraded or critical.",
    internetStatus,
    overallNetworkHealth: status === "healthy" ? "Healthy" : status === "slow" ? "Degraded" : "Critical"
  };
}

async function checkService(service: ServiceDefinition, network: ServiceHealthSnapshot, settings: SystemSettings): Promise<ServiceHealthSnapshot> {
  const checkedAt = new Date().toISOString();
  let responseTimeMs: number | null = null;
  let status: ServiceStatus = service.monitoringEnabled ? "offline" : "disabled";
  let message = service.monitoringEnabled ? (service.key === "bhel-webmail" ? "Connection Failed" : "Connection Timeout") : "Monitoring Disabled";

  if (!service.monitoringEnabled) {
    responseTimeMs = null;
  } else if (network.status === "offline") {
    status = "unknown";
    message = "Cannot verify - network unavailable";
  } else if (!service.url) {
    message = "Service URL not configured";
  } else {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), settings.infrastructure.timeoutThresholdMs);
    try {
      let response = await fetch(service.url, { method: "HEAD", signal: controller.signal });
      if (response.status === 405) {
        response = await fetch(service.url, { method: "GET", signal: controller.signal });
      }
      responseTimeMs = Date.now() - started;
      if (response.ok) {
        status = responseTimeMs < settings.infrastructure.slowResponseThresholdMs ? (service.onlineLabel === "Healthy" ? "healthy" : "online") : "slow";
        message = status === "slow" ? "Slow response detected" : "Service reachable";
        lastSuccessfulChecks.set(service.key, checkedAt);
      } else {
        message = `HTTP ${response.status}`;
      }
    } catch (error) {
      responseTimeMs = null;
      message = error instanceof Error && error.name === "AbortError"
        ? "Connection Timeout"
        : service.key === "bhel-webmail" ? "Connection Failed" : "Connection Timeout";
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    key: service.key,
    serviceName: service.name,
    status,
    statusLabel: statusLabelFor(service, status),
    responseTimeMs,
    latencyMs: null,
    packetLossPercent: null,
    dnsStatus: null,
    dnsResponseTimeMs: null,
    lastCheckedAt: checkedAt,
    lastSuccessfulCheckAt: lastSuccessfulChecks.get(service.key) || null,
    availability: `${availabilityFor(status)}%`,
    availabilityPercent: availabilityFor(status),
    incidentCount: 0,
    message,
    url: service.url,
    monitoringEnabled: service.monitoringEnabled,
    isDefault: service.isDefault,
    supportTeam: service.supportTeam,
    contactNumber: service.contactNumber,
    supportEmail: service.supportEmail,
    escalationNote: service.escalationNote
  };
}

function mapHistoryRow(row: Record<string, any>): ServiceHealthHistoryPoint {
  return {
    id: Number(row.ID),
    serviceKey: row.SERVICE_KEY,
    serviceName: row.SERVICE_NAME,
    checkedAt: row.CHECKED_AT,
    status: row.STATUS,
    responseTimeMs: row.RESPONSE_TIME_MS === null || row.RESPONSE_TIME_MS === undefined ? null : Number(row.RESPONSE_TIME_MS),
    latencyMs: row.LATENCY_MS === null || row.LATENCY_MS === undefined ? null : Number(row.LATENCY_MS),
    packetLossPercent: row.PACKET_LOSS_PERCENT === null || row.PACKET_LOSS_PERCENT === undefined ? null : Number(row.PACKET_LOSS_PERCENT),
    dnsStatus: row.DNS_STATUS || null,
    dnsResponseTimeMs: row.DNS_RESPONSE_TIME_MS === null || row.DNS_RESPONSE_TIME_MS === undefined ? null : Number(row.DNS_RESPONSE_TIME_MS),
    availabilityPercent: row.AVAILABILITY_PERCENT === null || row.AVAILABILITY_PERCENT === undefined ? 0 : Number(row.AVAILABILITY_PERCENT),
    errorMessage: row.ERROR_MESSAGE || null,
    supportTeam: row.SUPPORT_TEAM || "",
    contactNumber: row.CONTACT_NUMBER || "",
    supportEmail: row.SUPPORT_EMAIL || "",
    escalationNote: row.ESCALATION_NOTE || ""
  };
}

function statusSeverity(status: string) {
  if (status === "offline" || status === "unknown") return 3;
  if (status === "slow") return 2;
  if (status === "healthy" || status === "online") return 1;
  return 0;
}

function downsampleHistoryRows(rows: Array<Record<string, any>>, range: RangeKey) {
  const buckets = new Map<string, {
    latest: Record<string, any>;
    status: string;
    totalChecks: number;
    availableChecks: number;
    responseTimeTotal: number;
    responseTimeCount: number;
    latencyTotal: number;
    latencyCount: number;
  }>();

  for (const row of rows) {
    const bucket = bucketFor(row.CHECKED_AT, range);
    const key = `${row.SERVICE_KEY}:${bucket}`;
    const current = buckets.get(key) || {
      latest: row,
      status: String(row.STATUS || ""),
      totalChecks: 0,
      availableChecks: 0,
      responseTimeTotal: 0,
      responseTimeCount: 0,
      latencyTotal: 0,
      latencyCount: 0
    };
    const status = String(row.STATUS || "");
    current.totalChecks += 1;
    if (status === "healthy" || status === "online" || status === "slow") current.availableChecks += 1;
    if (statusSeverity(status) > statusSeverity(current.status)) current.status = status;
    if (new Date(row.CHECKED_AT).getTime() >= new Date(current.latest.CHECKED_AT).getTime()) current.latest = row;
    if (row.RESPONSE_TIME_MS !== null && row.RESPONSE_TIME_MS !== undefined) {
      current.responseTimeTotal += Number(row.RESPONSE_TIME_MS);
      current.responseTimeCount += 1;
    }
    if (row.LATENCY_MS !== null && row.LATENCY_MS !== undefined) {
      current.latencyTotal += Number(row.LATENCY_MS);
      current.latencyCount += 1;
    }
    buckets.set(key, current);
  }

  return Array.from(buckets.values())
    .map((bucket) => ({
      ...bucket.latest,
      CHECKED_AT: bucket.latest.CHECKED_AT,
      STATUS: bucket.status,
      RESPONSE_TIME_MS: bucket.responseTimeCount ? Math.round(bucket.responseTimeTotal / bucket.responseTimeCount) : null,
      LATENCY_MS: bucket.latencyCount ? Math.round(bucket.latencyTotal / bucket.latencyCount) : null,
      AVAILABILITY_PERCENT: bucket.totalChecks ? Math.round((bucket.availableChecks / bucket.totalChecks) * 10000) / 100 : 100
    }))
    .sort((left, right) => new Date(left.CHECKED_AT).getTime() - new Date(right.CHECKED_AT).getTime());
}

export async function getCurrentServiceHealth() {
  const connection = await getConnection();
  try {
    const settings = await getSystemSettings();
    await ensureServiceHealthHistoryTable(connection);
    const defaultSupport = await getDefaultInfrastructureServicesWithSupport(connection);
    const networkSupport = defaultSupport.find((service) => service.id === "network-health");
    const network = { ...(await checkNetworkHealth(settings)), ...(networkSupport ? {
      supportTeam: networkSupport.supportTeam,
      contactNumber: networkSupport.contactNumber,
      supportEmail: networkSupport.supportEmail,
      escalationNote: networkSupport.escalationNote
    } : {}) };
    const defaultDefinitions = defaultSupport
      .filter((service) => service.id !== "network-health")
      .map((service) => defaultServiceDefinition(service, settings));
    const serviceSnapshots = await Promise.all(defaultDefinitions.map((service) => checkService(service, network, settings)));
    const snapshots = [...serviceSnapshots, network];

    for (const snapshot of snapshots) {
      await saveSnapshot(connection, snapshot);
    }
    await connection.commit();

    for (const snapshot of snapshots) {
      const stats = await getHistoryStats(connection, snapshot.key, "24h");
      snapshot.incidentCount = stats.incidentCount;
      snapshot.availabilityPercent = stats.availabilityPercent;
      snapshot.availability = `${stats.availabilityPercent}%`;
    }

    return { data: snapshots };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

export async function getServiceHealthHistory(range: RangeKey = "24h") {
  const connection = await getConnection();
  try {
    await ensureServiceHealthHistoryTable(connection);
    const result = await connection.execute(
      `SELECT id, service_key, service_name, checked_at, status, response_time_ms,
              latency_ms, packet_loss_percent, dns_status, dns_response_time_ms,
              availability_percent, error_message, support_team, contact_number,
              support_email, escalation_note
       FROM service_health_history
       WHERE checked_at >= SYSTIMESTAMP - INTERVAL '${rangeToInterval(range)}' DAY
       ORDER BY checked_at ASC`
    );
    const rows = ((result.rows || []) as Array<Record<string, any>>).filter((row) => defaultServiceOrder.includes(row.SERVICE_KEY));
    return { data: downsampleHistoryRows(rows, range).map(mapHistoryRow) };
  } finally {
    await connection.close();
  }
}

export async function getServiceHealth() {
  return getCurrentServiceHealth();
}

export async function getInfrastructureCurrent(options: { persist?: boolean } = {}) {
  const persist = options.persist !== false;
  const connection = await getConnection();
  try {
    const settings = await getSystemSettings();
    await ensureServiceHealthHistoryTable(connection);
    const defaultSupport = await getDefaultInfrastructureServicesWithSupport(connection);
    const networkSupport = defaultSupport.find((service) => service.id === "network-health");
    const network = { ...(await checkNetworkHealth(settings)), ...(networkSupport ? {
      supportTeam: networkSupport.supportTeam,
      contactNumber: networkSupport.contactNumber,
      supportEmail: networkSupport.supportEmail,
      escalationNote: networkSupport.escalationNote
    } : {}) };
    const customDefinitions = (await getCustomInfrastructureServices(connection)).map(customServiceDefinition);
    const defaultDefinitions = defaultSupport
      .filter((service) => service.id !== "network-health")
      .map((service) => defaultServiceDefinition(service, settings));
    const serviceDefinitions = [...defaultDefinitions, ...customDefinitions];
    const serviceSnapshots = await Promise.all(serviceDefinitions.map((service) => checkService(service, network, settings)));
    const snapshots = [...serviceSnapshots.slice(0, 2), network, ...serviceSnapshots.slice(2)];

    if (persist) {
      for (const snapshot of snapshots) {
        await saveSnapshot(connection, snapshot);
      }
      await connection.commit();
    }

    for (const snapshot of snapshots) {
      if (snapshot.status === "disabled") continue;
      const stats = await getHistoryStats(connection, snapshot.key, "24h");
      snapshot.incidentCount = stats.incidentCount;
      snapshot.availabilityPercent = stats.availabilityPercent;
      snapshot.availability = `${stats.availabilityPercent}%`;
    }

    return { data: snapshots };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

export async function getInfrastructureHistory(inputRange: unknown = "24h") {
  const range = normalizeRange(inputRange);
  const connection = await getConnection();
  try {
    await ensureServiceHealthHistoryTable(connection);
    const serviceKeys = await getActiveInfrastructureServiceKeys(connection);
    const result = await connection.execute(
      `SELECT id, service_key, service_name, checked_at, status, response_time_ms,
              latency_ms, packet_loss_percent, dns_status, dns_response_time_ms,
              availability_percent, error_message, support_team, contact_number,
              support_email, escalation_note
       FROM service_health_history
       WHERE checked_at >= SYSTIMESTAMP - INTERVAL '${rangeToInterval(range)}' DAY
       ORDER BY checked_at ASC`
    );
    const rows = ((result.rows || []) as Array<Record<string, any>>).filter((row) => serviceKeys.has(row.SERVICE_KEY));
    return { data: downsampleHistoryRows(rows, range).map(mapHistoryRow) };
  } finally {
    await connection.close();
  }
}

async function getActiveInfrastructureServiceKeys(connection: any) {
  const customKeys = (await getCustomInfrastructureServices(connection)).map((service) => `custom-${service.id}`);
  return new Set([...defaultServiceOrder, ...customKeys]);
}

async function getActiveInfrastructureServiceSummaries(connection: any) {
  const defaultSupport = await getDefaultInfrastructureServicesWithSupport(connection);
  const customServices = await getCustomInfrastructureServices(connection);
  const byKey = new Map<ServiceKey, { serviceKey: ServiceKey; serviceName: string; monitoringEnabled: boolean }>();
  for (const service of defaultSupport) {
    byKey.set(service.id, {
      serviceKey: service.id,
      serviceName: service.name,
      monitoringEnabled: service.monitoringEnabled
    });
  }
  for (const service of customServices) {
    byKey.set(`custom-${service.id}`, {
      serviceKey: `custom-${service.id}`,
      serviceName: service.name,
      monitoringEnabled: service.monitoringEnabled
    });
  }
  return [
    ...defaultServiceOrder.map((key) => byKey.get(key)).filter((service): service is { serviceKey: ServiceKey; serviceName: string; monitoringEnabled: boolean } => Boolean(service)),
    ...Array.from(byKey.values()).filter((service) => !defaultServiceOrder.includes(service.serviceKey))
  ];
}

export async function getInfrastructureHeatmap(inputRange: unknown = "24h") {
  const range = normalizeRange(inputRange);
  const connection = await getConnection();
  try {
    await ensureServiceHealthHistoryTable(connection);
    const services = await getActiveInfrastructureServiceSummaries(connection);
    const serviceKeys = new Set(services.map((service) => service.serviceKey));
    const result = await connection.execute(
      `SELECT service_key, service_name, checked_at, status, response_time_ms, latency_ms
       FROM service_health_history
       WHERE checked_at >= SYSTIMESTAMP - INTERVAL '${rangeToInterval(range)}' DAY
       ORDER BY service_key, checked_at`
    );

    const buckets = new Map<string, {
      serviceKey: ServiceKey;
      serviceName: string;
      bucket: string;
      totalChecks: number;
      healthyChecks: number;
      degradedChecks: number;
      criticalChecks: number;
      cannotVerifyChecks: number;
      availableChecks: number;
      responseTimeTotal: number;
      responseTimeCount: number;
      maxResponseTimeMs: number | null;
      latestCheckedAt: string | null;
    }>();

    for (const row of (result.rows || []) as Array<Record<string, any>>) {
      if (!serviceKeys.has(row.SERVICE_KEY)) continue;
      const serviceKey = row.SERVICE_KEY as ServiceKey;
      const bucket = heatmapBucketFor(row.CHECKED_AT, range);
      const key = `${serviceKey}:${bucket}`;
      const current = buckets.get(key) || {
        serviceKey,
        serviceName: String(row.SERVICE_NAME || serviceKey),
        bucket,
        totalChecks: 0,
        healthyChecks: 0,
        degradedChecks: 0,
        criticalChecks: 0,
        cannotVerifyChecks: 0,
        availableChecks: 0,
        responseTimeTotal: 0,
        responseTimeCount: 0,
        maxResponseTimeMs: null,
        latestCheckedAt: null
      };
      const status = String(row.STATUS || "");
      const responseTime = row.RESPONSE_TIME_MS;
      current.totalChecks += 1;
      if (status === "healthy" || status === "online") {
        current.healthyChecks += 1;
        current.availableChecks += 1;
      } else if (status === "slow") {
        current.degradedChecks += 1;
        current.availableChecks += 1;
      } else if (status === "offline") {
        current.criticalChecks += 1;
      } else if (status === "unknown") {
        current.cannotVerifyChecks += 1;
      }
      if (responseTime !== null && responseTime !== undefined) {
        const responseTimeMs = Number(responseTime);
        current.responseTimeTotal += responseTimeMs;
        current.responseTimeCount += 1;
        current.maxResponseTimeMs = current.maxResponseTimeMs === null ? responseTimeMs : Math.max(current.maxResponseTimeMs, responseTimeMs);
      }
      current.latestCheckedAt = row.CHECKED_AT;
      buckets.set(key, current);
    }

    const rangeBuckets = buildHeatmapRangeBuckets(range);
    const data = services.flatMap((service) => rangeBuckets.map((bucket) => {
      const row = buckets.get(`${service.serviceKey}:${bucket.label}`);
      let status: HeatmapStatus = "no_data";
      if (row?.criticalChecks) status = "critical";
      else if (row?.cannotVerifyChecks) status = "cannot_verify";
      else if (row?.degradedChecks) status = "degraded";
      else if (row?.healthyChecks) status = "healthy";
      return {
        serviceKey: service.serviceKey,
        serviceName: row?.serviceName || service.serviceName,
        bucket: bucket.label,
        bucketStartAt: bucket.start,
        bucketEndAt: bucket.end,
        totalChecks: row?.totalChecks || 0,
        healthyChecks: row?.healthyChecks || 0,
        degradedChecks: row?.degradedChecks || 0,
        criticalChecks: row?.criticalChecks || 0,
        cannotVerifyChecks: row?.cannotVerifyChecks || 0,
        availableChecks: row?.availableChecks || 0,
        incidentCount: row ? row.criticalChecks + row.cannotVerifyChecks + row.degradedChecks : 0,
        status,
        checkedAt: row?.latestCheckedAt || null,
        responseTimeMs: row?.responseTimeCount ? Math.round(row.responseTimeTotal / row.responseTimeCount) : null,
        maxResponseTimeMs: row?.maxResponseTimeMs === null || row?.maxResponseTimeMs === undefined ? null : Math.round(row.maxResponseTimeMs),
        noDataMessage: row ? null : "No monitoring data available"
      };
    }));

    return { data };
  } finally {
    await connection.close();
  }
}

export async function recordScheduledInfrastructureHealthCheck() {
  await getInfrastructureCurrent();
}

export async function getInfrastructureIncidents(inputRange: unknown = "30d") {
  const range = normalizeRange(inputRange);
  const connection = await getConnection();
  try {
    await ensureServiceHealthHistoryTable(connection);
    const serviceKeys = await getActiveInfrastructureServiceKeys(connection);
    const result = await connection.execute(
      `SELECT id, service_key, service_name, checked_at, status, response_time_ms,
              latency_ms, packet_loss_percent, dns_status, dns_response_time_ms,
              availability_percent, error_message, support_team, contact_number,
              support_email, escalation_note,
              LAG(status) OVER (PARTITION BY service_key ORDER BY checked_at) AS previous_status
       FROM service_health_history
       WHERE checked_at >= SYSTIMESTAMP - INTERVAL '${rangeToInterval(range)}' DAY
       ORDER BY checked_at DESC`
    );

    const data = ((result.rows || []) as Array<Record<string, any>>)
      .filter((row) => serviceKeys.has(row.SERVICE_KEY))
      .filter((row) => {
        const status = String(row.STATUS || "");
        const previous = row.PREVIOUS_STATUS ? String(row.PREVIOUS_STATUS) : "";
        return isIncident(status as ServiceStatus) || (isIncident(previous as ServiceStatus) && (status === "healthy" || status === "online"));
      })
      .map((row) => {
        const status = String(row.STATUS || "");
        const previous = row.PREVIOUS_STATUS ? String(row.PREVIOUS_STATUS) : "";
        const recovered = isIncident(previous as ServiceStatus) && (status === "healthy" || status === "online");
        const type = recovered
          ? "Recovery"
          : status === "offline" || status === "unknown"
            ? "Service offline"
            : row.DNS_STATUS && String(row.DNS_STATUS).toLowerCase() !== "resolved"
              ? "DNS failure"
              : row.SERVICE_KEY === "network-health"
                ? "Network degraded"
                : "Slow response";
        return {
          id: Number(row.ID),
          serviceKey: row.SERVICE_KEY,
          serviceName: row.SERVICE_NAME,
          checkedAt: row.CHECKED_AT,
          status,
          previousStatus: previous || null,
          type,
          message: row.ERROR_MESSAGE || type,
          responseTimeMs: row.RESPONSE_TIME_MS === null || row.RESPONSE_TIME_MS === undefined ? null : Number(row.RESPONSE_TIME_MS),
          latencyMs: row.LATENCY_MS === null || row.LATENCY_MS === undefined ? null : Number(row.LATENCY_MS),
          packetLossPercent: row.PACKET_LOSS_PERCENT === null || row.PACKET_LOSS_PERCENT === undefined ? null : Number(row.PACKET_LOSS_PERCENT),
          supportTeam: row.SUPPORT_TEAM || "",
          contactNumber: row.CONTACT_NUMBER || "",
          supportEmail: row.SUPPORT_EMAIL || "",
          escalationNote: row.ESCALATION_NOTE || ""
        };
      });

    return { data };
  } finally {
    await connection.close();
  }
}

export async function getInfrastructureReports(inputRange: unknown = "30d") {
  const range = normalizeRange(inputRange);
  const connection = await getConnection();
  try {
    await ensureServiceHealthHistoryTable(connection);
    const serviceKeys = await getActiveInfrastructureServiceKeys(connection);
    const result = await connection.execute(
      `SELECT service_key, service_name,
              MAX(support_team) AS support_team,
              MAX(contact_number) AS contact_number,
              COUNT(*) AS total_checks,
              AVG(CASE WHEN status IN ('healthy', 'online', 'slow') THEN 100 ELSE 0 END) AS availability_percent,
              AVG(response_time_ms) AS average_response_time_ms,
              SUM(CASE WHEN status IN ('offline', 'unknown') THEN 1 ELSE 0 END) AS downtime_checks,
              SUM(CASE WHEN status IN ('offline', 'slow', 'unknown') THEN 1 ELSE 0 END) AS incident_count
       FROM service_health_history
       WHERE checked_at >= SYSTIMESTAMP - INTERVAL '${rangeToInterval(range)}' DAY
       GROUP BY service_key, service_name
       ORDER BY service_name`
    );

    const data = ((result.rows || []) as Array<Record<string, any>>).filter((row) => serviceKeys.has(row.SERVICE_KEY)).map((row) => {
      const downtimeChecks = Number(row.DOWNTIME_CHECKS || 0);
      return {
        serviceKey: row.SERVICE_KEY,
        serviceName: row.SERVICE_NAME,
        availabilityPercent: Math.round(Number(row.AVAILABILITY_PERCENT || 0) * 100) / 100,
        averageResponseTimeMs: row.AVERAGE_RESPONSE_TIME_MS === null || row.AVERAGE_RESPONSE_TIME_MS === undefined ? null : Math.round(Number(row.AVERAGE_RESPONSE_TIME_MS)),
        totalDowntimeMinutes: downtimeChecks,
        incidentCount: Number(row.INCIDENT_COUNT || 0),
        totalChecks: Number(row.TOTAL_CHECKS || 0),
        supportTeam: row.SUPPORT_TEAM || "",
        contactNumber: row.CONTACT_NUMBER || ""
      };
    });

    return { data };
  } finally {
    await connection.close();
  }
}
