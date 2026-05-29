import type { Ticket, TicketDetail } from "@/types/ticket";

type ApiTicket = Record<string, any>;

export function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.length ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function normalizeTicket(ticket: ApiTicket | null | undefined): Ticket {
  const source = ticket || {};
  return {
    id: numberValue(source.ID),
    title: stringValue(source.TITLE, "Untitled ticket"),
    category: stringValue(source.CATEGORY, "Uncategorized"),
    subcategory: source.SUBCATEGORY || undefined,
    department: source.DEPARTMENT || undefined,
    block: source.BLOCK || undefined,
    roomNumber: source.ROOM_NUMBER || undefined,
    assetTagManual: source.ASSET_TAG_MANUAL || undefined,
    status: stringValue(source.STATUS, "open") as Ticket["status"],
    priority: stringValue(source.PRIORITY, "low") as Ticket["priority"],
    requesterName: stringValue(source.REQUESTER_NAME, "Unknown user"),
    requesterId: source.REQUESTER_ID || undefined,
    assignedToName: source.ASSIGNED_TO_NAME || undefined,
    assignedToId: source.ASSIGNED_TO_ID || undefined,
    slaRisk: source.SLA_RISK || undefined,
    slaDeadline: source.SLA_DEADLINE || undefined,
    slaStatus: source.SLA_STATUS || undefined,
    createdAt: stringValue(source.CREATED_AT, new Date(0).toISOString()),
    assignedAt: source.ASSIGNED_AT || source.UPDATED_AT || source.CREATED_AT || undefined,
    updatedAt: source.UPDATED_AT || undefined
  };
}

export function normalizeTicketDetail(ticket: ApiTicket | null | undefined): TicketDetail {
  const source = ticket || {};
  return {
    ...normalizeTicket(source),
    description: source.DESCRIPTION || "",
    screenshotUrl: source.SCREENSHOT_URL || undefined,
    serviceImageUrl: source.SERVICE_IMAGE_URL || undefined,
    engineerNotes: source.ENGINEER_NOTES || undefined,
    rootCause: source.ROOT_CAUSE || undefined,
    correctiveAction: source.CORRECTIVE_ACTION || undefined,
    preventiveAction: source.PREVENTIVE_ACTION || undefined,
    partsUsed: source.PARTS_USED || undefined,
    remarks: source.REMARKS || undefined,
    imageRetentionDays: numberValue(source.IMAGE_RETENTION_DAYS, 60),
    resolvedAt: source.RESOLVED_AT || undefined,
    employee: source.EMPLOYEE || undefined,
    engineer: source.ENGINEER || undefined,
    asset: source.ASSET || undefined,
    timeline: asArray(source.TIMELINE)
  };
}

export function statusLabel(status?: string | null) {
  return stringValue(status, "unknown").replaceAll("_", " ");
}

const slaHoursByPriority: Record<string, number> = {
  critical: 1,
  high: 4,
  medium: 8,
  low: 24
};

export type SlaStatus = "breached" | "at_risk" | "normal";

export function getSlaDueAt(ticket: Pick<Ticket, "createdAt" | "priority"> & Partial<Pick<Ticket, "slaDeadline">>) {
  if (ticket.slaDeadline) return new Date(ticket.slaDeadline);
  const createdAt = new Date(ticket.createdAt).getTime();
  const hours = slaHoursByPriority[ticket.priority] || slaHoursByPriority.low;
  return new Date(createdAt + hours * 60 * 60 * 1000);
}

export function getSlaStatus(ticket: Pick<Ticket, "createdAt" | "priority" | "status" | "slaRisk"> & Partial<Pick<Ticket, "slaStatus" | "slaDeadline">>): SlaStatus {
  if (["resolved", "closed"].includes(ticket.status)) return "normal";
  if (ticket.slaStatus) {
    if (ticket.slaStatus === "Breached") return "breached";
    if (ticket.slaStatus === "Warning") return "at_risk";
    return "normal";
  }
  if (ticket.slaRisk === "high") return "breached";
  if (ticket.slaRisk === "medium") return "at_risk";

  const createdAt = new Date(ticket.createdAt).getTime();
  const dueAt = getSlaDueAt(ticket).getTime();
  const now = Date.now();
  if (now >= dueAt) return "breached";

  const total = dueAt - createdAt;
  const remaining = dueAt - now;
  return remaining <= total * 0.25 ? "at_risk" : "normal";
}

export function slaStatusLabel(status: SlaStatus) {
  return status === "at_risk" ? "At Risk" : status === "breached" ? "Breached" : "Normal";
}

export function formatSlaRemaining(ticket: Pick<Ticket, "createdAt" | "priority" | "status" | "slaRisk">) {
  const dueAt = getSlaDueAt(ticket).getTime();
  const difference = dueAt - Date.now();
  const absolute = Math.abs(difference);
  const hours = Math.floor(absolute / (60 * 60 * 1000));
  const minutes = Math.max(0, Math.round((absolute % (60 * 60 * 1000)) / (60 * 1000)));
  const value = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return difference < 0 ? `${value} breached` : `${value} left`;
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
