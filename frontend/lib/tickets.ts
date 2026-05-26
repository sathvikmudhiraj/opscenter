import type { Ticket, TicketDetail } from "@/types/ticket";

type ApiTicket = Record<string, any>;

export function normalizeTicket(ticket: ApiTicket): Ticket {
  return {
    id: ticket.ID,
    title: ticket.TITLE,
    category: ticket.CATEGORY,
    status: ticket.STATUS,
    priority: ticket.PRIORITY,
    requesterName: ticket.REQUESTER_NAME,
    requesterId: ticket.REQUESTER_ID,
    assignedToName: ticket.ASSIGNED_TO_NAME,
    assignedToId: ticket.ASSIGNED_TO_ID,
    slaRisk: ticket.SLA_RISK,
    slaDeadline: ticket.SLA_DEADLINE,
    slaStatus: ticket.SLA_STATUS,
    createdAt: ticket.CREATED_AT,
    assignedAt: ticket.ASSIGNED_AT || ticket.UPDATED_AT || ticket.CREATED_AT,
    updatedAt: ticket.UPDATED_AT
  };
}

export function normalizeTicketDetail(ticket: ApiTicket): TicketDetail {
  return {
    ...normalizeTicket(ticket),
    description: ticket.DESCRIPTION,
    screenshotUrl: ticket.SCREENSHOT_URL,
    serviceImageUrl: ticket.SERVICE_IMAGE_URL,
    engineerNotes: ticket.ENGINEER_NOTES,
    rootCause: ticket.ROOT_CAUSE,
    correctiveAction: ticket.CORRECTIVE_ACTION,
    preventiveAction: ticket.PREVENTIVE_ACTION,
    partsUsed: ticket.PARTS_USED,
    remarks: ticket.REMARKS,
    imageRetentionDays: ticket.IMAGE_RETENTION_DAYS,
    resolvedAt: ticket.RESOLVED_AT,
    employee: ticket.EMPLOYEE,
    engineer: ticket.ENGINEER,
    asset: ticket.ASSET,
    timeline: ticket.TIMELINE || []
  };
}

export function statusLabel(status: string) {
  return status.replaceAll("_", " ");
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
