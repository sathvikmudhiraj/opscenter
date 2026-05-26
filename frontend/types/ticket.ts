export interface Ticket {
  id: number;
  title: string;
  category: string;
  status: "open" | "assigned" | "in_progress" | "waiting_for_parts" | "escalated" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "critical";
  requesterName: string;
  requesterId?: string;
  assignedToName?: string;
  assignedToId?: string;
  slaRisk?: "low" | "medium" | "high";
  slaDeadline?: string;
  slaStatus?: "Normal" | "Warning" | "Breached";
  createdAt: string;
  assignedAt?: string;
  updatedAt?: string;
}

export interface TicketDetail extends Ticket {
  description?: string;
  screenshotUrl?: string;
  serviceImageUrl?: string;
  engineerNotes?: string;
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  partsUsed?: string;
  remarks?: string;
  imageRetentionDays?: number;
  resolvedAt?: string;
  employee?: { id: number; loginId: string; name: string; department?: string; location?: string };
  engineer?: { id: number; loginId: string; name: string };
  asset?: {
    id: number;
    assetTag: string;
    assetName?: string;
    category?: string;
    type: string;
    status: string;
    brand?: string;
    model: string;
    serialNumber?: string;
    department?: string;
    block?: string;
    room?: string;
    location: string;
    processor?: string;
    ram?: string;
    storage?: string;
    operatingSystem?: string;
    warrantyExpiry?: string;
  };
  timeline: Array<{ action: string; userId: number; user: string; timestamp: string; details: string }>;
}
