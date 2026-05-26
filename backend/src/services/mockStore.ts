import bcrypt from "bcrypt";
import type { UserRole } from "../types/auth";
import { HttpError } from "../utils/httpError";

type MockUser = {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: "active" | "disabled";
  department?: string;
  location?: string;
};

type MockAsset = {
  id: number;
  assetTag: string;
  assetName: string;
  type: string;
  category: string;
  brand: string;
  model: string;
  serialNumber: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  department: string;
  block: string;
  room: string;
  status: string;
  location: string;
  assignedTo: number | null;
  processor?: string;
  ram?: string;
  storage?: string;
  operatingSystem?: string;
};

type AssetInput = Omit<MockAsset, "id" | "assignedTo" | "location"> & {
  assignedTo?: number | null;
  location?: string;
};

type MockAssetRequest = {
  id: number;
  requesterId: number;
  assetType: string;
  justification: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  decidedAt?: string;
  decidedBy?: number;
};

type MockTicket = {
  id: number;
  title: string;
  description?: string;
  category: string;
  priority: string;
  status: string;
  requesterId: number;
  assignedTo?: number;
  assetId?: number;
  screenshotUrl?: string;
  serviceImageUrl?: string;
  engineerNotes?: string;
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  partsUsed?: string;
  remarks?: string;
  escalated?: boolean;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  timeline: Array<{ action: string; userId: number; timestamp: string; details: string }>;
};

type MockNotification = {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: "assignment" | "sla_warning" | "escalation" | "ticket" | "asset" | "system" | "user";
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  metadata?: Record<string, string | number>;
};

const SLA_HOURS_BY_PRIORITY: Record<string, number> = {
  critical: 1,
  high: 4,
  medium: 8,
  low: 24
};

const ADMIN_USER_ID = 1;

const TEST_PASSWORD_HASH = bcrypt.hashSync("Ops@12345", 12);

const users: MockUser[] = [
  {
    id: 1,
    name: "Admin",
    email: "admin",
    passwordHash: TEST_PASSWORD_HASH,
    role: "admin",
    status: "active",
    department: "IT Administration",
    location: "Head Office"
  },
  ...Array.from({ length: 11 }, (_, index) => {
    const engineerNumber = String(index + 1).padStart(2, "0");
    return {
      id: index + 2,
      name: `Engineer DS${engineerNumber}`,
      email: `ds${engineerNumber}`,
      passwordHash: TEST_PASSWORD_HASH,
      role: "engineer" as const,
      status: "active" as const,
      department: "Support Engineering",
      location: `Service Desk ${engineerNumber}`
    };
  }),
  ...Array.from({ length: 5 }, (_, index) => {
    const staffNumber = String(1001 + index);
    return {
      id: Number(staffNumber),
      name: `Employee ${staffNumber}`,
      email: staffNumber,
      passwordHash: TEST_PASSWORD_HASH,
      role: "employee" as const,
      status: "active" as const,
      department: index % 2 === 0 ? "Operations" : "Finance",
      location: `Floor ${index + 1}`
    };
  })
];
const assets: MockAsset[] = [
  {
    id: 501,
    assetTag: "LAP-OPS-1001",
    assetName: "Operations Laptop 1001",
    category: "Laptop",
    type: "Laptop",
    status: "assigned",
    brand: "Lenovo",
    model: "ThinkPad T14",
    serialNumber: "SN-LAP-1001",
    purchaseDate: "2025-04-01",
    warrantyExpiry: "2028-04-01",
    department: "Operations",
    block: "A",
    room: "101",
    location: "Operations / Block A / Room 101",
    assignedTo: 1001,
    processor: "Intel Core i7",
    ram: "16 GB",
    storage: "512 GB SSD",
    operatingSystem: "Windows 11 Pro"
  },
  {
    id: 502,
    assetTag: "MON-OPS-2104",
    assetName: "Finance Display 2104",
    category: "Monitor",
    type: "Monitor",
    status: "assigned",
    brand: "Dell",
    model: "P2424H",
    serialNumber: "SN-MON-2104",
    purchaseDate: "2024-10-12",
    warrantyExpiry: "2027-10-12",
    department: "Finance",
    block: "B",
    room: "204",
    location: "Finance / Block B / Room 204",
    assignedTo: 1002,
    processor: "N/A",
    ram: "N/A",
    storage: "N/A",
    operatingSystem: "N/A"
  },
  {
    id: 503,
    assetTag: "CPU-OPS-3307",
    assetName: "IT Store Desktop 3307",
    category: "Desktop",
    type: "Desktop",
    status: "available",
    brand: "Dell",
    model: "OptiPlex 7010",
    serialNumber: "SN-CPU-3307",
    purchaseDate: "2025-01-20",
    warrantyExpiry: "2028-01-20",
    department: "IT",
    block: "Store",
    room: "IT-01",
    location: "IT / Block Store / Room IT-01",
    assignedTo: null,
    processor: "Intel Core i5",
    ram: "16 GB",
    storage: "1 TB SSD",
    operatingSystem: "Windows 11 Pro"
  }
];

const assetRequests: MockAssetRequest[] = [
  { id: 701, requesterId: 2, assetType: "Replacement SSD", justification: "Need SSD for critical laptop repair.", status: "pending", createdAt: new Date().toISOString() }
];

const tickets: MockTicket[] = [
  {
    id: 1001,
    title: "VPN client reset",
    description: "VPN client fails to connect after password change.",
    category: "Network",
    priority: "high",
    status: "assigned",
    requesterId: 1001,
    assignedTo: 2,
    assetId: 501,
    escalated: false,
    createdAt: new Date().toISOString()
    ,
    updatedAt: new Date().toISOString(),
    timeline: [
      { action: "ticket_created", userId: 1001, timestamp: new Date().toISOString(), details: "Employee raised ticket." },
      { action: "ticket_assigned", userId: 1, timestamp: new Date().toISOString(), details: "Assigned to Engineer DS01." }
    ]
  },
  ...Array.from({ length: 10 }, (_, index) => {
    const engineerId = index + 3;
    const engineerNumber = String(index + 2).padStart(2, "0");
    const ticketId = 1002 + index;
    const requesterId = 1001 + (index % 5);
    return {
      id: ticketId,
      title: `Assigned support case DS${engineerNumber}`,
      description: `Mock enterprise support ticket assigned to Engineer DS${engineerNumber} for workflow testing.`,
      category: index % 2 === 0 ? "Hardware" : "Software",
      priority: index % 3 === 0 ? "critical" : index % 3 === 1 ? "high" : "medium",
      status: "assigned",
      requesterId,
      assignedTo: engineerId,
      assetId: index % 2 === 0 ? 501 : 502,
      escalated: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [
        { action: "ticket_created", userId: requesterId, timestamp: new Date().toISOString(), details: "Employee raised ticket." },
        { action: "ticket_assigned", userId: 1, timestamp: new Date().toISOString(), details: `Assigned to Engineer DS${engineerNumber}.` }
      ]
    };
  })
];

const notifications: MockNotification[] = [
  { id: 3, userId: 2, title: "Ticket assigned", message: "Test tickets are assigned to engineers DS01 through DS11.", type: "assignment", isRead: false, readAt: null, createdAt: new Date().toISOString() },
  { id: 2, userId: ADMIN_USER_ID, title: "Ticket assigned", message: "Ticket #1002 assigned to Engineer DS08.", type: "assignment", isRead: false, readAt: null, createdAt: new Date().toISOString() },
  { id: 1, userId: ADMIN_USER_ID, title: "Mock mode active", message: "Oracle is bypassed for local Postman testing.", type: "system", isRead: false, readAt: null, createdAt: new Date().toISOString() }
];
const auditLogs: Array<{ id: number; userId: number; user: string; action: string; timestamp: string; details: string }> = [
  { id: 1, userId: 1, user: "admin", action: "system_started", timestamp: new Date().toISOString(), details: "Mock enterprise workflow initialized." }
];

function userName(id?: number) {
  return users.find((user) => user.id === id)?.name || "Unassigned";
}

function userLogin(id?: number) {
  return users.find((user) => user.id === id)?.email || "system";
}

function notify(input: { userId: number; title: string; message: string; type?: MockNotification["type"]; metadata?: Record<string, string | number> }) {
  notifications.unshift({
    id: notifications.length + 1,
    userId: input.userId,
    title: input.title,
    message: input.message,
    type: input.type || "ticket",
    isRead: false,
    readAt: null,
    createdAt: new Date().toISOString(),
    metadata: input.metadata
  });
}

function audit(userId: number, action: string, details: string) {
  auditLogs.unshift({ id: auditLogs.length + 1, userId, user: userLogin(userId), action, timestamp: new Date().toISOString(), details });
}

function admins() {
  return users.filter((user) => user.role === "admin" && user.status === "active");
}

function notifyAdmins(title: string, message: string, type: MockNotification["type"], metadata?: Record<string, string | number>) {
  admins().forEach((admin) => notify({ userId: admin.id, title, message, type, metadata }));
}

function notificationView(notification: MockNotification) {
  return {
    id: notification.id,
    user_id: notification.userId,
    userId: notification.userId,
    title: notification.title,
    message: notification.message,
    body: notification.message,
    type: notification.type,
    is_read: notification.isRead,
    isRead: notification.isRead,
    readAt: notification.readAt,
    created_at: notification.createdAt,
    createdAt: notification.createdAt,
    metadata: notification.metadata || {}
  };
}

function slaDeadline(ticket: Pick<MockTicket, "createdAt" | "priority">) {
  const hours = SLA_HOURS_BY_PRIORITY[ticket.priority] || SLA_HOURS_BY_PRIORITY.low;
  return new Date(new Date(ticket.createdAt).getTime() + hours * 60 * 60 * 1000);
}

function slaStatus(ticket: Pick<MockTicket, "createdAt" | "priority" | "status">) {
  if (["resolved", "closed"].includes(ticket.status)) return "Normal";
  const createdAt = new Date(ticket.createdAt).getTime();
  const deadline = slaDeadline(ticket).getTime();
  const now = Date.now();
  if (now >= deadline) return "Breached";
  const window = deadline - createdAt;
  const remaining = deadline - now;
  return remaining <= window * 0.25 ? "Warning" : "Normal";
}

function slaRiskFromStatus(status: string) {
  if (status === "Breached") return "high";
  if (status === "Warning") return "medium";
  return "low";
}

function ensureSlaWarning(ticket: MockTicket) {
  const currentStatus = slaStatus(ticket);
  if (currentStatus !== "Warning") return;
  const recipients = [ADMIN_USER_ID, ticket.assignedTo].filter((id): id is number => Boolean(id));
  recipients.forEach((userId) => {
    const alreadySent = notifications.some((notification) => (
      notification.userId === userId &&
      notification.type === "sla_warning" &&
      notification.metadata?.ticketId === ticket.id
    ));
    if (!alreadySent) {
      notify({
        userId,
        title: "SLA warning",
        message: `Ticket #${ticket.id} is nearing SLA deadline.`,
        type: "sla_warning",
        metadata: { ticketId: ticket.id }
      });
    }
  });
}

function assetLocation(input: { department?: string; block?: string; room?: string; location?: string }) {
  if (input.department || input.block || input.room) {
    return `${input.department || "General"} / Block ${input.block || "N/A"} / Room ${input.room || "N/A"}`;
  }
  return input.location || "Unassigned location";
}

function assertUniqueAssetFields(input: { assetTag?: string; serialNumber?: string; ignoreId?: number }) {
  if (input.assetTag && assets.some((asset) => asset.id !== input.ignoreId && asset.assetTag.toLowerCase() === input.assetTag!.toLowerCase())) {
    throw new HttpError(409, "Asset ID already exists");
  }
  if (input.serialNumber && assets.some((asset) => asset.id !== input.ignoreId && asset.serialNumber.toLowerCase() === input.serialNumber!.toLowerCase())) {
    throw new HttpError(409, "Serial Number already exists");
  }
}

function ticketSummary(ticket: MockTicket) {
  ensureSlaWarning(ticket);
  const requester = users.find((user) => user.id === ticket.requesterId);
  const engineer = users.find((user) => user.id === ticket.assignedTo);
  const currentSlaStatus = slaStatus(ticket);
  const deadline = slaDeadline(ticket).toISOString();
  return {
    ID: ticket.id,
    TITLE: ticket.title,
    CATEGORY: ticket.category,
    STATUS: ticket.status,
    PRIORITY: ticket.priority,
    CREATED_AT: ticket.createdAt,
    UPDATED_AT: ticket.updatedAt,
    ASSIGNED_AT: ticket.updatedAt,
    SLA_DEADLINE: deadline,
    SLA_STATUS: currentSlaStatus,
    REQUESTER_NAME: requester?.name || "Unknown Employee",
    REQUESTER_ID: requester?.email || "",
    ASSIGNED_TO_NAME: engineer?.name || "",
    ASSIGNED_TO_ID: engineer?.email || "",
    SLA_RISK: slaRiskFromStatus(currentSlaStatus)
  };
}

function ticketDetail(ticket: MockTicket) {
  const requester = users.find((user) => user.id === ticket.requesterId);
  const engineer = users.find((user) => user.id === ticket.assignedTo);
  const asset = assets.find((candidate) => candidate.id === ticket.assetId);
  return {
    ...ticketSummary(ticket),
    DESCRIPTION: ticket.description,
    SCREENSHOT_URL: ticket.screenshotUrl,
    SERVICE_IMAGE_URL: ticket.serviceImageUrl,
    ENGINEER_NOTES: ticket.engineerNotes,
    ROOT_CAUSE: ticket.rootCause,
    CORRECTIVE_ACTION: ticket.correctiveAction,
    PREVENTIVE_ACTION: ticket.preventiveAction,
    PARTS_USED: ticket.partsUsed,
    REMARKS: ticket.remarks,
    UPDATED_AT: ticket.updatedAt,
    RESOLVED_AT: ticket.resolvedAt,
    IMAGE_RETENTION_DAYS: ticket.priority === "critical" ? 365 : ticket.priority === "high" ? 180 : 60,
    EMPLOYEE: requester ? { id: requester.id, loginId: requester.email, name: requester.name, department: requester.department, location: requester.location } : null,
    ENGINEER: engineer ? { id: engineer.id, loginId: engineer.email, name: engineer.name } : null,
    ASSET: asset || null,
    TIMELINE: ticket.timeline.map((entry) => ({ ...entry, user: userLogin(entry.userId) }))
  };
}

export const mockStore = {
  hasUsers() {
    return users.length > 0;
  },

  async createFirstAdmin(input: { name: string; email: string; password: string }) {
    if (users.some((user) => user.role === "admin")) {
      throw new HttpError(409, "Initial admin setup has already been completed");
    }

    const user: MockUser = {
      id: 1,
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: await bcrypt.hash(input.password, 12),
      role: "admin",
      status: "active"
    };
    users.push(user);
    audit(user.id, "user_created", `${user.email} created.`);

    return user;
  },

  async findActiveUserByCredentials(input: { email: string; password: string }) {
    const user = users.find((candidate) => candidate.email === input.email.toLowerCase() && candidate.status === "active");
    if (!user) return null;
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (valid) audit(user.id, "login", `${user.email} signed in.`);
    return valid ? user : null;
  },

  listUsers() {
    return users.map((user) => ({
      id: user.id,
      name: user.name,
      loginId: user.email,
      role: user.role,
      status: user.status,
      department: user.department,
      location: user.location
    }));
  },

  updateUserRole(input: { id: number; role: UserRole; actorId?: number }) {
    const user = users.find((candidate) => candidate.id === input.id);
    if (!user) throw new HttpError(404, "User not found");
    if (user.email === "admin") {
      throw new HttpError(400, "The built-in admin account role cannot be changed");
    }
    user.role = input.role;
    notify({ userId: user.id, title: "Role updated", message: `${user.email} is now ${input.role}.`, type: "user" });
    audit(input.actorId || user.id, "role_changed", `${user.email} role changed to ${input.role}.`);
    return user;
  },

  updateUserStatus(input: { id: number; status: "active" | "disabled"; actorId: number }) {
    const user = users.find((candidate) => candidate.id === input.id);
    if (!user) throw new HttpError(404, "User not found");
    if (user.email === "admin") throw new HttpError(400, "The built-in admin account cannot be disabled");
    user.status = input.status;
    notify({ userId: user.id, title: "User status updated", message: `${user.email} is now ${input.status}.`, type: "user" });
    audit(input.actorId, "user_status_updated", `${user.email} set to ${input.status}.`);
    return user;
  },

  resetUserPassword(input: { id: number; actorId: number }) {
    const user = users.find((candidate) => candidate.id === input.id);
    if (!user) throw new HttpError(404, "User not found");
    user.passwordHash = TEST_PASSWORD_HASH;
    notify({ userId: user.id, title: "Password reset", message: `${user.email} password reset to test credential.`, type: "user" });
    audit(input.actorId, "password_reset", `${user.email} password reset.`);
  },

  listTickets() {
    return tickets
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(ticketSummary);
  },

  getTicket(id: number) {
    const ticket = tickets.find((candidate) => candidate.id === id);
    if (!ticket) throw new HttpError(404, "Ticket not found");
    return ticketDetail(ticket);
  },

  createTicket(input: { title: string; description?: string; category: string; priority: string; requesterId: number; assetId?: number; screenshotUrl?: string }) {
    const id = Math.max(...tickets.map((ticket) => ticket.id), 1000) + 1;
    const now = new Date().toISOString();
    const ticket: MockTicket = {
      id,
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      status: "open",
      requesterId: input.requesterId,
      assetId: input.assetId,
      screenshotUrl: input.screenshotUrl,
      escalated: false,
      createdAt: now,
      updatedAt: now,
      timeline: [{ action: "ticket_created", userId: input.requesterId, timestamp: now, details: "Ticket created by employee." }]
    };
    tickets.unshift(ticket);
    notifyAdmins("New ticket", `Ticket #${id} requires admin triage.`, "ticket", { ticketId: id });
    audit(input.requesterId, "ticket_created", `Ticket #${id} created.`);
    return ticketSummary(ticket);
  },

  assignTicketToEngineer(input: { ticketId: number; engineerId: number; adminId: number }) {
    const ticket = tickets.find((candidate) => candidate.id === input.ticketId);
    if (!ticket) throw new HttpError(404, "Ticket not found");

    const engineer = users.find((candidate) => candidate.id === input.engineerId && candidate.role === "engineer" && candidate.status === "active");
    if (!engineer) throw new HttpError(400, "Active engineer not found");

    ticket.assignedTo = engineer.id;
    ticket.status = "assigned";
    ticket.updatedAt = new Date().toISOString();
    ticket.timeline.push({ action: "ticket_assigned", userId: input.adminId, timestamp: ticket.updatedAt, details: `Assigned to ${engineer.name}.` });
    notify({ userId: ticket.requesterId, title: "Ticket assigned", message: `Ticket #${ticket.id} assigned to ${engineer.name}.`, type: "assignment", metadata: { ticketId: ticket.id } });
    notify({ userId: engineer.id, title: "Ticket assigned", message: `Ticket #${ticket.id} assigned to you.`, type: "assignment", metadata: { ticketId: ticket.id } });
    audit(input.adminId, "ticket_assigned", `Ticket #${ticket.id} assigned to ${engineer.email}.`);
  },

  updateTicketStatus(input: { ticketId: number; status: string; message?: string; actorId: number }) {
    const ticket = tickets.find((candidate) => candidate.id === input.ticketId);
    if (!ticket) throw new HttpError(404, "Ticket not found");

    ticket.status = input.status;
    ticket.updatedAt = new Date().toISOString();
    if (input.status === "resolved" || input.status === "closed") ticket.resolvedAt = ticket.updatedAt;
    ticket.timeline.push({ action: input.status === "resolved" ? "ticket_resolved" : "status_updated", userId: input.actorId, timestamp: ticket.updatedAt, details: input.message || `Status changed to ${input.status}.` });
    const title = input.status === "resolved" ? "Ticket resolved" : "Ticket updated";
    const action = input.status === "resolved" ? "ticket_resolved" : "status_updated";
    notify({ userId: ticket.requesterId, title, message: input.message || `Ticket #${ticket.id} moved to ${input.status}.`, type: "ticket", metadata: { ticketId: ticket.id } });
    notifyAdmins(title, input.message || `Ticket #${ticket.id} moved to ${input.status}.`, "ticket", { ticketId: ticket.id });
    audit(input.actorId, action, `Ticket #${ticket.id} moved to ${input.status}.`);
  },

  updatePriority(input: { ticketId: number; priority: string; actorId: number }) {
    const ticket = tickets.find((candidate) => candidate.id === input.ticketId);
    if (!ticket) throw new HttpError(404, "Ticket not found");
    ticket.priority = input.priority;
    ticket.updatedAt = new Date().toISOString();
    ticket.timeline.push({ action: "priority_updated", userId: input.actorId, timestamp: ticket.updatedAt, details: `Priority changed to ${input.priority}.` });
    audit(input.actorId, "priority_updated", `Ticket #${ticket.id} priority changed to ${input.priority}.`);
  },

  escalateTicket(input: { ticketId: number; actorId: number }) {
    const ticket = tickets.find((candidate) => candidate.id === input.ticketId);
    if (!ticket) throw new HttpError(404, "Ticket not found");
    ticket.escalated = true;
    ticket.status = "escalated";
    ticket.updatedAt = new Date().toISOString();
    ticket.timeline.push({ action: "ticket_escalated", userId: input.actorId, timestamp: ticket.updatedAt, details: `Ticket escalated by ${userName(input.actorId)}.` });
    notifyAdmins("Ticket escalated", `Ticket #${ticket.id} is escalated.`, "escalation", { ticketId: ticket.id });
    audit(input.actorId, "ticket_escalated", `Ticket #${ticket.id} escalated.`);
  },

  engineerAction(input: {
    ticketId: number;
    actorId: number;
    engineerNotes?: string;
    rootCause?: string;
    correctiveAction?: string;
    preventiveAction?: string;
    partsUsed?: string;
    serviceImageUrl?: string;
    status: string;
    remarks?: string;
  }) {
    const ticket = tickets.find((candidate) => candidate.id === input.ticketId);
    if (!ticket) throw new HttpError(404, "Ticket not found");
    Object.assign(ticket, {
      engineerNotes: input.engineerNotes,
      rootCause: input.rootCause,
      correctiveAction: input.correctiveAction,
      preventiveAction: input.preventiveAction,
      partsUsed: input.partsUsed,
      serviceImageUrl: input.serviceImageUrl,
      remarks: input.remarks,
      status: input.status,
      updatedAt: new Date().toISOString(),
      resolvedAt: input.status === "resolved" || input.status === "closed" ? new Date().toISOString() : ticket.resolvedAt
    });
    ticket.timeline.push({ action: input.status === "resolved" ? "ticket_resolved" : "status_updated", userId: input.actorId, timestamp: ticket.updatedAt, details: input.remarks || "Engineer updated service action." });
    const title = input.status === "resolved" ? "Ticket resolved" : "Ticket updated";
    const action = input.status === "resolved" ? "ticket_resolved" : "status_updated";
    notify({ userId: ticket.requesterId, title, message: `Ticket #${ticket.id} updated by ${userName(input.actorId)}.`, type: "ticket", metadata: { ticketId: ticket.id } });
    notifyAdmins(title, `Ticket #${ticket.id} updated by ${userName(input.actorId)}.`, "ticket", { ticketId: ticket.id });
    audit(input.actorId, action, `Engineer action saved for ticket #${ticket.id}.`);
  },

  listAssets() {
    return assets.map((asset) => ({ ...asset, assignedToName: userName(asset.assignedTo || undefined), assignedToLogin: userLogin(asset.assignedTo || undefined) }));
  },

  createAsset(input: AssetInput & { actorId: number }) {
    assertUniqueAssetFields({ assetTag: input.assetTag, serialNumber: input.serialNumber });
    const asset: MockAsset = {
      id: Math.max(...assets.map((candidate) => candidate.id), 500) + 1,
      assetTag: input.assetTag,
      assetName: input.assetName,
      type: input.type || input.category,
      category: input.category || input.type,
      brand: input.brand,
      model: input.model,
      serialNumber: input.serialNumber,
      purchaseDate: input.purchaseDate,
      warrantyExpiry: input.warrantyExpiry,
      department: input.department,
      block: input.block,
      room: input.room,
      location: assetLocation(input),
      status: input.status || "available",
      assignedTo: input.assignedTo || null,
      processor: input.processor,
      ram: input.ram,
      storage: input.storage,
      operatingSystem: input.operatingSystem
    };
    assets.unshift(asset);
    audit(input.actorId, "asset_created", `${asset.assetTag} created.`);
    return asset;
  },

  updateAsset(input: Partial<AssetInput> & { id: number; actorId: number }) {
    const asset = assets.find((candidate) => candidate.id === input.id);
    if (!asset) throw new HttpError(404, "Asset not found");
    assertUniqueAssetFields({ assetTag: input.assetTag, serialNumber: input.serialNumber, ignoreId: asset.id });
    Object.assign(asset, {
      assetTag: input.assetTag || asset.assetTag,
      assetName: input.assetName || asset.assetName,
      type: input.type || asset.type,
      category: input.category || asset.category,
      brand: input.brand || asset.brand,
      model: input.model || asset.model,
      serialNumber: input.serialNumber || asset.serialNumber,
      purchaseDate: input.purchaseDate || asset.purchaseDate,
      warrantyExpiry: input.warrantyExpiry || asset.warrantyExpiry,
      department: input.department || asset.department,
      block: input.block || asset.block,
      room: input.room || asset.room,
      location: assetLocation({ ...asset, ...input }),
      status: input.status || asset.status,
      assignedTo: input.assignedTo !== undefined ? input.assignedTo : asset.assignedTo,
      processor: input.processor || asset.processor,
      ram: input.ram || asset.ram,
      storage: input.storage || asset.storage,
      operatingSystem: input.operatingSystem || asset.operatingSystem
    });
    audit(input.actorId, "asset_updated", `${asset.assetTag} updated.`);
    return asset;
  },

  assignAsset(input: { id: number; employeeId: number; actorId: number }) {
    const asset = assets.find((candidate) => candidate.id === input.id);
    if (!asset) throw new HttpError(404, "Asset not found");
    const employee = users.find((candidate) => candidate.id === input.employeeId && candidate.role === "employee");
    if (!employee) throw new HttpError(400, "Employee not found");
    asset.assignedTo = employee.id;
    asset.status = "assigned";
    notify({ userId: employee.id, title: "Asset assigned", message: `${asset.assetTag} assigned to ${employee.email}.`, type: "asset", metadata: { assetId: asset.id } });
    audit(input.actorId, "asset_assigned", `${asset.assetTag} assigned to ${employee.email}.`);
    return asset;
  },

  listAuditLogs() {
    return auditLogs;
  },

  listNotifications(input: { userId: number }) {
    return notifications
      .filter((notification) => notification.userId === input.userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(notificationView);
  },

  markNotificationRead(input: { id: number; userId: number }) {
    const notification = notifications.find((candidate) => candidate.id === input.id && candidate.userId === input.userId);
    if (!notification) throw new HttpError(404, "Notification not found");
    notification.isRead = true;
    notification.readAt = new Date().toISOString();
    return notificationView(notification);
  },

  markAllNotificationsRead(input: { userId: number }) {
    notifications.forEach((notification) => {
      if (notification.userId === input.userId) {
        notification.isRead = true;
        notification.readAt = notification.readAt || new Date().toISOString();
      }
    });
  },

  listAssetRequests() {
    return assetRequests.map((request) => ({
      ...request,
      requesterName: userName(request.requesterId),
      requesterLogin: userLogin(request.requesterId),
      decidedByLogin: request.decidedBy ? userLogin(request.decidedBy) : ""
    }));
  },

  createAssetRequest(input: { requesterId: number; assetType?: string; justification?: string }) {
    const request: MockAssetRequest = {
      id: Math.max(...assetRequests.map((candidate) => candidate.id), 700) + 1,
      requesterId: input.requesterId,
      assetType: input.assetType || "General Asset",
      justification: input.justification || "No justification provided.",
      status: "pending",
      createdAt: new Date().toISOString()
    };
    assetRequests.unshift(request);
    notifyAdmins("Asset request submitted", `${userLogin(input.requesterId)} requested ${request.assetType}.`, "asset", { requestId: request.id });
    audit(input.requesterId, "asset_request_created", `${request.assetType} requested.`);
    return request;
  },

  decideAssetRequest(input: { id: number; status: "approved" | "rejected"; actorId: number }) {
    const request = assetRequests.find((candidate) => candidate.id === input.id);
    if (!request) throw new HttpError(404, "Asset request not found");
    request.status = input.status;
    request.decidedAt = new Date().toISOString();
    request.decidedBy = input.actorId;
    notify({ userId: request.requesterId, title: "Asset request updated", message: `Request #${request.id} ${input.status}.`, type: "asset", metadata: { requestId: request.id } });
    audit(input.actorId, `asset_request_${input.status}`, `Request #${request.id} ${input.status}.`);
    return request;
  }
};
