import { env } from "../config/env";
import { getConnection } from "../config/database";
import { writeAuditLog } from "./audit.service";
import { notifyAdmins } from "./notification.service";

type ServiceKey = "hpep-intranet" | "bhel-webmail";
type ServiceStatus = "healthy" | "online" | "slow" | "offline";

type ServiceDefinition = {
  key: ServiceKey;
  name: string;
  url: string;
  onlineLabel: "Healthy" | "Online";
  healthyAvailability: string;
  slowAvailability: string;
};

export type ServiceHealthSnapshot = {
  key: ServiceKey;
  serviceName: string;
  status: ServiceStatus;
  statusLabel: string;
  responseTimeMs: number | null;
  lastCheckedAt: string;
  lastSuccessfulCheckAt: string | null;
  availability: string;
  message: string;
};

const services: ServiceDefinition[] = [
  {
    key: "hpep-intranet",
    name: "HPEP Intranet",
    url: env.serviceHealth.hpepIntranetUrl,
    onlineLabel: "Healthy",
    healthyAvailability: "99.95%",
    slowAvailability: "97.50%"
  },
  {
    key: "bhel-webmail",
    name: "BHEL Webmail",
    url: env.serviceHealth.bhelWebmailUrl,
    onlineLabel: "Online",
    healthyAvailability: "99.98%",
    slowAvailability: "96.80%"
  }
];

const previousStatus = new Map<ServiceKey, ServiceStatus>();
const lastSuccessfulChecks = new Map<ServiceKey, string>();

function availabilityFor(service: ServiceDefinition, status: ServiceStatus) {
  if (status === "offline") return "N/A";
  if (status === "slow") return service.slowAvailability;
  return service.healthyAvailability;
}

async function recordOfflineTransition(service: ServiceDefinition, snapshot: ServiceHealthSnapshot) {
  const priorStatus = previousStatus.get(service.key);
  previousStatus.set(service.key, snapshot.status);
  if (!priorStatus || priorStatus === snapshot.status) return;

  const connection = await getConnection();
  try {
    const details = `${service.name} changed from ${priorStatus} to ${snapshot.status}. ${snapshot.message}`;
    await writeAuditLog({ action: "service_health_status_change", details }, connection);
    if (snapshot.status === "offline") {
      await notifyAdmins({
        title: `${service.name} Offline`,
        body: `${service.name} is unreachable. ${snapshot.message}`
      }, connection);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

async function checkService(service: ServiceDefinition): Promise<ServiceHealthSnapshot> {
  const checkedAt = new Date().toISOString();
  let responseTimeMs: number | null = null;
  let status: ServiceStatus = "offline";
  let message = service.key === "bhel-webmail" ? "Connection Failed" : "Connection Timeout";

  if (!service.url) {
    message = "Service URL not configured";
  } else {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    try {
      let response = await fetch(service.url, { method: "HEAD", signal: controller.signal });
      if (response.status === 405) {
        response = await fetch(service.url, { method: "GET", signal: controller.signal });
      }
      responseTimeMs = Date.now() - started;
      if (response.ok) {
        status = responseTimeMs < 500 ? (service.onlineLabel === "Healthy" ? "healthy" : "online") : "slow";
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

  const snapshot: ServiceHealthSnapshot = {
    key: service.key,
    serviceName: service.name,
    status,
    statusLabel: status === "healthy" || status === "online" ? service.onlineLabel : status === "slow" ? "Slow" : "Offline",
    responseTimeMs,
    lastCheckedAt: checkedAt,
    lastSuccessfulCheckAt: lastSuccessfulChecks.get(service.key) || null,
    availability: availabilityFor(service, status),
    message
  };

  await recordOfflineTransition(service, snapshot);
  return snapshot;
}

export async function getServiceHealth() {
  const data = await Promise.all(services.map(checkService));
  return { data };
}
