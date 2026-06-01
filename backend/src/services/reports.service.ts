import { getConnection } from "../config/database";
import { getUnreadNotificationCount } from "./notification.service";

async function tableExists(connection: any, tableName: string) {
  const result = await connection.execute(
    `SELECT COUNT(*) AS count FROM user_tables WHERE table_name = :tableName`,
    { tableName }
  );
  return Number(((result.rows || [])[0] as { COUNT?: number })?.COUNT || 0) > 0;
}

async function scalar(connection: any, sql: string, binds: Record<string, unknown> = {}) {
  const result = await connection.execute(sql, binds);
  const row = (result.rows || [])[0] as Record<string, unknown> | undefined;
  return Number(row?.VALUE || 0);
}

async function tableColumns(connection: any, tableName: string) {
  const result = await connection.execute(
    `SELECT column_name FROM user_tab_columns WHERE table_name = :tableName`,
    { tableName }
  );
  return new Set(((result.rows || []) as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME));
}

function asDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function priorityHours(priority: string) {
  if (priority === "critical") return 1;
  if (priority === "high") return 4;
  if (priority === "medium") return 8;
  return 24;
}

function formatRemaining(dueAt: Date, now = new Date()) {
  const diff = dueAt.getTime() - now.getTime();
  const absolute = Math.abs(diff);
  const hours = Math.floor(absolute / (60 * 60 * 1000));
  const minutes = Math.max(0, Math.round((absolute % (60 * 60 * 1000)) / (60 * 1000)));
  const value = hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  return diff < 0 ? `${value} breached` : `${value} left`;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

const resolvedStatuses = new Set(["resolved", "closed"]);

type SlaTicket = {
  id: number;
  title: string;
  priority: string;
  status: string;
  createdAt: Date;
  updatedAt: Date | null;
  resolvedAt: Date | null;
  dueAt: Date;
  assignedEngineer: string;
  breached: boolean;
  atRisk: boolean;
  compliant: boolean;
  resolutionMinutes: number | null;
  remaining: string;
};

type SlaSummary = {
  slaCompliance: number | null;
  withinSla: number;
  breaches: number;
  atRisk: number;
  averageResolutionTimeMinutes: number | null;
  trackableTickets: number;
};

function isResolvedStatus(status: string) {
  return resolvedStatuses.has(status);
}

function evaluateSla(row: Record<string, any>, now: Date): SlaTicket | null {
  const createdAt = asDate(row.CREATED_AT);
  const priority = String(row.PRIORITY || "low").toLowerCase();
  const dueAt = asDate(row.SLA_DUE_AT) || asDate(row.SLA_DEADLINE) || (createdAt ? addHours(createdAt, priorityHours(priority)) : null);
  if (!createdAt || !dueAt) return null;

  const status = String(row.STATUS || "open").toLowerCase();
  const updatedAt = asDate(row.UPDATED_AT);
  const resolvedAt = asDate(row.RESOLVED_AT);
  const resolved = isResolvedStatus(status);
  const active = !resolved;
  const resolvedWithinSla = Boolean(resolvedAt && resolvedAt.getTime() <= dueAt.getTime());
  const activeWithinSla = active && now.getTime() <= dueAt.getTime();
  const breached = resolved
    ? Boolean(resolvedAt && resolvedAt.getTime() > dueAt.getTime())
    : now.getTime() > dueAt.getTime();
  const totalWindow = dueAt.getTime() - createdAt.getTime();
  const remainingMs = dueAt.getTime() - now.getTime();
  const atRisk = active && !breached && totalWindow > 0 && remainingMs <= totalWindow * 0.25;
  const resolutionMinutes = resolvedAt
    ? Math.max(0, Math.round((resolvedAt.getTime() - createdAt.getTime()) / 60000))
    : null;

  return {
    id: Number(row.ID),
    title: String(row.TITLE || "Untitled ticket"),
    priority,
    status,
    createdAt,
    updatedAt,
    resolvedAt,
    dueAt,
    assignedEngineer: String(row.ASSIGNED_ENGINEER || "Unassigned"),
    breached,
    atRisk,
    compliant: resolvedWithinSla || activeWithinSla,
    resolutionMinutes,
    remaining: formatRemaining(dueAt, now)
  };
}

function summarizeSla(rows: SlaTicket[]): SlaSummary {
  const resolvedWithResolution = rows.filter((ticket) => ticket.resolutionMinutes !== null);
  const withinSla = rows.filter((ticket) => ticket.compliant).length;
  return {
    slaCompliance: rows.length
      ? Math.round((withinSla / rows.length) * 100)
      : null,
    withinSla,
    breaches: rows.filter((ticket) => ticket.breached).length,
    atRisk: rows.filter((ticket) => ticket.atRisk).length,
    averageResolutionTimeMinutes: resolvedWithResolution.length
      ? Math.round(resolvedWithResolution.reduce((sum, ticket) => sum + (ticket.resolutionMinutes || 0), 0) / resolvedWithResolution.length)
      : null,
    trackableTickets: rows.length
  };
}

async function getSlaRows(connection: any, includeAssignee = false) {
  const ticketColumns = await tableColumns(connection, "TICKETS");
  const userColumns = await tableColumns(connection, "USERS");
  const hasAssignedTo = includeAssignee && ticketColumns.has("ASSIGNED_TO") && userColumns.size > 0;
  const nameColumn = userColumns.has("NAME") ? "name" : userColumns.has("USERNAME") ? "username" : userColumns.has("EMAIL") ? "email" : "login_id";
  const assignedJoin = hasAssignedTo ? "LEFT JOIN users assignee ON assignee.id = t.assigned_to" : "";
  const assignedNameSelect = hasAssignedTo ? `assignee.${nameColumn}` : "NULL";

  const result = await connection.execute(
    `SELECT t.id, t.title, t.priority, t.status, t.created_at,
            ${ticketColumns.has("UPDATED_AT") ? "t.updated_at" : "NULL"} AS updated_at,
            ${ticketColumns.has("RESOLVED_AT") ? "t.resolved_at" : "NULL"} AS resolved_at,
            ${ticketColumns.has("SLA_DUE_AT") ? "t.sla_due_at" : "NULL"} AS sla_due_at,
            ${ticketColumns.has("SLA_DEADLINE") ? "t.sla_deadline" : "NULL"} AS sla_deadline,
            ${assignedNameSelect} AS assigned_engineer
     FROM tickets t
     ${assignedJoin}`
  );

  const now = new Date();
  const rawRows = (result.rows || []) as Array<Record<string, any>>;
  const slaRows = rawRows
    .map((row) => evaluateSla(row, now))
    .filter((ticket): ticket is SlaTicket => ticket !== null);
  console.info(`SLA Engine processed ${slaRows.length} tickets. Raw tickets: ${rawRows.length}.`);
  return slaRows;
}

export async function getAdminReports() {
  const connection = await getConnection();
  try {
    const hasTickets = await tableExists(connection, "TICKETS");
    const hasUsers = await tableExists(connection, "USERS");
    const hasAssets = await tableExists(connection, "ASSETS");
    const hasAuditLogs = await tableExists(connection, "AUDIT_LOGS");

    const totalTickets = hasTickets ? await scalar(connection, `SELECT COUNT(*) AS value FROM tickets`) : 0;
    const openTickets = hasTickets ? await scalar(connection, `SELECT COUNT(*) AS value FROM tickets WHERE status NOT IN ('resolved', 'closed')`) : 0;
    const closedTickets = hasTickets ? await scalar(connection, `SELECT COUNT(*) AS value FROM tickets WHERE status IN ('resolved', 'closed')`) : 0;
    const activeEngineers = hasUsers ? await scalar(connection, `SELECT COUNT(*) AS value FROM users WHERE role = 'engineer'`) : 0;
    const assetCount = hasAssets ? await scalar(connection, `SELECT COUNT(*) AS value FROM assets`) : 0;
    const securityAlerts = hasAuditLogs ? await scalar(connection, `SELECT COUNT(*) AS value FROM audit_logs WHERE LOWER(action) LIKE '%security%' OR LOWER(action) LIKE '%login%'`) : 0;
    const notifications = await getUnreadNotificationCount();

    const slaSummary = hasTickets ? summarizeSla(await getSlaRows(connection)) : summarizeSla([]);
    const slaCompliance = {
      value: slaSummary.slaCompliance,
      label: slaSummary.slaCompliance === null ? "No SLA data" : `${slaSummary.slaCompliance}%`,
      subtitle: slaSummary.slaCompliance === null
        ? "No SLA-trackable tickets"
        : `${slaSummary.trackableTickets} active/resolved tickets tracked`
    };

    const byStatus = hasTickets ? (await connection.execute(
      `SELECT NVL(status, 'unknown') AS label, COUNT(*) AS value
       FROM tickets
       GROUP BY NVL(status, 'unknown')
       ORDER BY value DESC`
    )).rows || [] : [];

    const byPriority = hasTickets ? (await connection.execute(
      `SELECT NVL(priority, 'unknown') AS label, COUNT(*) AS value
       FROM tickets
       GROUP BY NVL(priority, 'unknown')
       ORDER BY value DESC`
    )).rows || [] : [];

    const ticketTrend = hasTickets ? (await connection.execute(
      `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS label, COUNT(*) AS value
       FROM tickets
       GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
       ORDER BY label`
    )).rows || [] : [];

    const engineerPerformance = hasTickets && hasUsers ? (await connection.execute(
      `SELECT u.username AS label, COUNT(t.id) AS value
       FROM users u
       LEFT JOIN tickets t ON t.assigned_to = u.id
       WHERE u.role = 'engineer'
       GROUP BY u.username
       ORDER BY value DESC`
    )).rows || [] : [];

    console.info("[oracle] Reports query success");
    return {
      stats: {
        totalTickets,
        openTickets,
        closedTickets,
        activeEngineers,
        slaCompliance,
        assetCount,
        securityAlerts,
        notifications,
        slaWithinSla: slaSummary.withinSla,
        slaBreached: slaSummary.breaches,
        slaAtRisk: slaSummary.atRisk,
        averageResolutionTimeMinutes: slaSummary.averageResolutionTimeMinutes,
        slaTrackableTickets: slaSummary.trackableTickets
      },
      charts: {
        byStatus,
        byPriority,
        ticketTrend,
        engineerPerformance
      }
    };
  } catch (error) {
    console.info(`[oracle] Reports query failed: ${error instanceof Error ? error.message : "unknown error"}`);
    throw error;
  } finally {
    await connection.close();
  }
}

export async function getSlaReports() {
  const connection = await getConnection();
  try {
    const hasTickets = await tableExists(connection, "TICKETS");
    if (!hasTickets) {
      return {
        stats: { slaCompliance: null, withinSla: 0, breaches: 0, atRisk: 0, averageResolutionTimeMinutes: null, averageResponseTimeMinutes: null, trackableTickets: 0 },
        priorityMetrics: [],
        breachRiskQueue: [],
        engineerPerformance: [],
        trend: []
      };
    }

    const rows = await getSlaRows(connection, true);
    const summary = summarizeSla(rows);

    const priorityMetrics = ["critical", "high", "medium", "low"].map((priority) => {
      const scoped = rows.filter((ticket) => ticket.priority === priority);
      const scopedSummary = summarizeSla(scoped);
      return {
        priority,
        total: scoped.length,
        withinSla: scopedSummary.withinSla,
        breaches: scopedSummary.breaches,
        atRisk: scopedSummary.atRisk,
        compliance: scopedSummary.slaCompliance ?? 0
      };
    });

    const breachRiskQueue = rows
      .filter((ticket) => !isResolvedStatus(ticket.status) && (ticket.breached || ticket.atRisk))
      .sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime())
      .slice(0, 25)
      .map((ticket) => ({
        id: ticket.id,
        title: ticket.title,
        priority: ticket.priority,
        assignedEngineer: ticket.assignedEngineer,
        slaRemaining: ticket.remaining,
        status: ticket.breached ? "breached" : "at_risk"
      }));

    const engineerMap = new Map<string, { engineer: string; assignedTickets: number; resolvedTickets: number; breaches: number }>();
    for (const ticket of rows.filter((item) => item.assignedEngineer !== "Unassigned")) {
      const current = engineerMap.get(ticket.assignedEngineer) || { engineer: ticket.assignedEngineer, assignedTickets: 0, resolvedTickets: 0, breaches: 0 };
      current.assignedTickets += 1;
      if (isResolvedStatus(ticket.status)) current.resolvedTickets += 1;
      if (ticket.breached) current.breaches += 1;
      engineerMap.set(ticket.assignedEngineer, current);
    }
    const engineerPerformance = Array.from(engineerMap.values()).map((engineer) => ({
      ...engineer,
      compliance: engineer.assignedTickets ? Math.round(((engineer.assignedTickets - engineer.breaches) / engineer.assignedTickets) * 100) : 100
    }));

    const today = new Date();
    const trendDays = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      return dayKey(date);
    });
    const trend = trendDays.map((date) => {
      const scoped = rows.filter((ticket) => dayKey(ticket.createdAt) === date);
      const scopedSummary = summarizeSla(scoped);
      return {
        label: date.slice(5),
        value: scopedSummary.slaCompliance ?? 0
      };
    });

    return {
      stats: {
        slaCompliance: summary.slaCompliance,
        withinSla: summary.withinSla,
        breaches: summary.breaches,
        atRisk: summary.atRisk,
        averageResolutionTimeMinutes: summary.averageResolutionTimeMinutes,
        averageResponseTimeMinutes: summary.averageResolutionTimeMinutes,
        trackableTickets: summary.trackableTickets
      },
      priorityMetrics,
      breachRiskQueue,
      engineerPerformance,
      trend
    };
  } finally {
    await connection.close();
  }
}
export async function getTicketCategories() {
  const connection = await getConnection();
  try {
    const hasTickets = await tableExists(connection, "TICKETS");
    if (!hasTickets) {
      return [];
    }

    const result = await connection.execute(
      `SELECT NVL(category, 'Unknown') AS label, COUNT(*) AS value
       FROM tickets
       GROUP BY NVL(category, 'Unknown')
       ORDER BY value DESC`
    );

    return ((result.rows || []) as Array<Record<string, unknown>>).map((row) => ({
      label: String(row.LABEL || "Unknown"),
      value: Number(row.VALUE || 0)
    }));
  } catch (error) {
    console.error(`[oracle] Ticket categories query failed: ${error}`);
    throw error;
  } finally {
    await connection.close();
  }
}

export async function getSlaDistribution() {
  const connection = await getConnection();
  try {
    const hasTickets = await tableExists(connection, "TICKETS");
    if (!hasTickets) {
      return [];
    }

    const rows = await getSlaRows(connection);
    if (!rows.length) return [];

    const counts = {
      "Within SLA": rows.filter((ticket) => ticket.compliant && !ticket.atRisk).length,
      "At Risk": rows.filter((ticket) => ticket.atRisk).length,
      "Breached": rows.filter((ticket) => ticket.breached).length
    };

    return Object.entries(counts)
      .filter(([, value]) => value > 0)
      .map(([label, value]) => ({ label, value }));
  } catch (error) {
    console.error(`[oracle] SLA distribution query failed: ${error}`);
    throw error;
  } finally {
    await connection.close();
  }
}

export async function getAssetStatus() {
  const connection = await getConnection();
  try {
    const hasAssets = await tableExists(connection, "ASSETS");
    if (!hasAssets) {
      return [];
    }

    const result = await connection.execute(
      `SELECT NVL(status, 'Unknown') AS label, COUNT(*) AS value
       FROM assets
       GROUP BY NVL(status, 'Unknown')
       ORDER BY value DESC`
    );

    return ((result.rows || []) as Array<Record<string, unknown>>).map((row) => ({
      label: String(row.LABEL || "Unknown"),
      value: Number(row.VALUE || 0)
    }));
  } catch (error) {
    console.error(`[oracle] Asset status query failed: ${error}`);
    throw error;
  } finally {
    await connection.close();
  }
}

export async function getDepartmentDistribution() {
  const connection = await getConnection();
  try {
    const hasTickets = await tableExists(connection, "TICKETS");
    if (!hasTickets) {
      return [];
    }

    const result = await connection.execute(
      `SELECT NVL(department, 'Unknown') AS label, COUNT(*) AS value
       FROM tickets
       GROUP BY NVL(department, 'Unknown')
       ORDER BY value DESC`
    );

    return ((result.rows || []) as Array<Record<string, unknown>>).map((row) => ({
      label: String(row.LABEL || "Unknown"),
      value: Number(row.VALUE || 0)
    }));
  } catch (error) {
    console.error(`[oracle] Department distribution query failed: ${error}`);
    throw error;
  } finally {
    await connection.close();
  }
}

export async function getEngineerPerformance() {
  const connection = await getConnection();
  try {
    const hasTickets = await tableExists(connection, "TICKETS");
    const hasUsers = await tableExists(connection, "USERS");
    if (!hasTickets || !hasUsers) {
      return [];
    }

    const result = await connection.execute(
      `SELECT u.username AS engineer_name, COUNT(t.id) AS resolved_ticket_count
       FROM users u
       JOIN tickets t ON t.assigned_to = u.id
       WHERE u.role = 'engineer'
         AND t.status IN ('resolved', 'closed')
       GROUP BY u.username
       ORDER BY resolved_ticket_count DESC`
    );

    const rows = (result.rows || []) as Array<Record<string, unknown>>;
    const totalResolved = rows.reduce((sum, row) => sum + Number(row.RESOLVED_TICKET_COUNT || 0), 0);

    return rows.map((row) => {
      const engineerName = String(row.ENGINEER_NAME || "Unknown");
      const resolvedCount = Number(row.RESOLVED_TICKET_COUNT || 0);
      const percentage = totalResolved > 0 ? Math.round((resolvedCount / totalResolved) * 100) : 0;
      return {
        engineerName,
        resolvedTicketCount: resolvedCount,
        percentageContribution: percentage
      };
    });
  } catch (error) {
    console.error(`[oracle] Engineer performance query failed: ${error}`);
    throw error;
  } finally {
    await connection.close();
  }
}
