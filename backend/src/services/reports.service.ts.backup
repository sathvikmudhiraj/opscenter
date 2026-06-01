import { getConnection } from "../config/database";

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

export async function getAdminReports() {
  const connection = await getConnection();
  try {
    const hasTickets = await tableExists(connection, "TICKETS");
    const hasUsers = await tableExists(connection, "USERS");
    const hasAssets = await tableExists(connection, "ASSETS");
    const hasNotifications = await tableExists(connection, "NOTIFICATIONS");
    const hasAuditLogs = await tableExists(connection, "AUDIT_LOGS");

    const totalTickets = hasTickets ? await scalar(connection, `SELECT COUNT(*) AS value FROM tickets`) : 0;
    const openTickets = hasTickets ? await scalar(connection, `SELECT COUNT(*) AS value FROM tickets WHERE status NOT IN ('resolved', 'closed')`) : 0;
    const closedTickets = hasTickets ? await scalar(connection, `SELECT COUNT(*) AS value FROM tickets WHERE status IN ('resolved', 'closed')`) : 0;
    const activeEngineers = hasUsers ? await scalar(connection, `SELECT COUNT(*) AS value FROM users WHERE role = 'engineer'`) : 0;
    const assetCount = hasAssets ? await scalar(connection, `SELECT COUNT(*) AS value FROM assets`) : 0;
    const securityAlerts = hasAuditLogs ? await scalar(connection, `SELECT COUNT(*) AS value FROM audit_logs WHERE LOWER(action) LIKE '%security%' OR LOWER(action) LIKE '%login%'`) : 0;
    const notifications = hasNotifications ? await scalar(connection, `SELECT COUNT(*) AS value FROM notifications WHERE NVL(is_read, 0) = 0`) : 0;
    const slaBreached = hasTickets ? await scalar(connection, `SELECT COUNT(*) AS value FROM tickets WHERE LOWER(NVL(sla_status, 'normal')) LIKE '%breach%'`) : 0;
    const slaCompliance = totalTickets ? Math.round(((totalTickets - slaBreached) / totalTickets) * 100) : 100;

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
        notifications
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
        stats: { slaCompliance: 100, breaches: 0, atRisk: 0, averageResponseTimeMinutes: 0 },
        priorityMetrics: [],
        breachRiskQueue: [],
        engineerPerformance: [],
        trend: []
      };
    }

    const ticketColumns = await tableColumns(connection, "TICKETS");
    const userColumns = await tableColumns(connection, "USERS");
    const requesterColumn = ticketColumns.has("REQUESTER_ID") ? "requester_id" : "created_by";
    const hasAssignedTo = ticketColumns.has("ASSIGNED_TO");
    const hasUpdatedAt = ticketColumns.has("UPDATED_AT");
    const hasResolvedAt = ticketColumns.has("RESOLVED_AT");
    const hasSlaDeadline = ticketColumns.has("SLA_DEADLINE");
    const hasSlaStatus = ticketColumns.has("SLA_STATUS");
    const usernameColumn = userColumns.has("USERNAME") ? "username" : userColumns.has("EMAIL") ? "email" : "login_id";
    const nameColumn = userColumns.has("NAME") ? "name" : usernameColumn;
    const assignedJoin = hasAssignedTo ? "LEFT JOIN users assignee ON assignee.id = t.assigned_to" : "";
    const assignedNameSelect = hasAssignedTo ? `assignee.${nameColumn}` : "NULL";

    const result = await connection.execute(
      `SELECT t.id, t.title, t.priority, t.status, t.created_at,
              ${hasUpdatedAt ? "t.updated_at" : "t.created_at"} AS updated_at,
              ${hasResolvedAt ? "t.resolved_at" : "NULL"} AS resolved_at,
              ${hasSlaDeadline ? "t.sla_deadline" : "NULL"} AS sla_deadline,
              ${hasSlaStatus ? "t.sla_status" : "NULL"} AS sla_status,
              ${assignedNameSelect} AS assigned_engineer
       FROM tickets t
       JOIN users requester ON requester.id = t.${requesterColumn}
       ${assignedJoin}`
    );

    const now = new Date();
    const rows = ((result.rows || []) as Array<Record<string, any>>).map((row) => {
      const priority = String(row.PRIORITY || "low").toLowerCase();
      const status = String(row.STATUS || "open").toLowerCase();
      const createdAt = asDate(row.CREATED_AT) || now;
      const updatedAt = asDate(row.UPDATED_AT);
      const resolvedAt = asDate(row.RESOLVED_AT);
      const dueAt = asDate(row.SLA_DEADLINE) || addHours(createdAt, priorityHours(priority));
      const isResolved = status === "resolved" || status === "closed";
      const remainingMs = dueAt.getTime() - now.getTime();
      const storedStatus = String(row.SLA_STATUS || "").toLowerCase();
      const breached = storedStatus.includes("breach") || (isResolved ? Boolean(resolvedAt && resolvedAt.getTime() > dueAt.getTime()) : remainingMs < 0);
      const totalWindow = dueAt.getTime() - createdAt.getTime();
      const atRisk = !breached && !isResolved && totalWindow > 0 && remainingMs <= totalWindow * 0.25;
      const responseMinutes = updatedAt ? Math.max(0, Math.round((updatedAt.getTime() - createdAt.getTime()) / 60000)) : 0;
      return {
        id: Number(row.ID),
        title: String(row.TITLE || "Untitled ticket"),
        priority,
        status,
        createdAt,
        dueAt,
        resolvedAt,
        assignedEngineer: String(row.ASSIGNED_ENGINEER || "Unassigned"),
        breached,
        atRisk,
        responseMinutes,
        remaining: formatRemaining(dueAt, now)
      };
    });

    const totalTickets = rows.length;
    const breaches = rows.filter((ticket) => ticket.breached).length;
    const atRisk = rows.filter((ticket) => ticket.atRisk).length;
    const slaCompliance = totalTickets ? Math.round(((totalTickets - breaches) / totalTickets) * 100) : 100;
    const averageResponseTimeMinutes = totalTickets ? Math.round(rows.reduce((sum, ticket) => sum + ticket.responseMinutes, 0) / totalTickets) : 0;

    const priorityMetrics = ["critical", "high", "medium", "low"].map((priority) => {
      const scoped = rows.filter((ticket) => ticket.priority === priority);
      const scopedBreaches = scoped.filter((ticket) => ticket.breached).length;
      const scopedAtRisk = scoped.filter((ticket) => ticket.atRisk).length;
      return {
        priority,
        total: scoped.length,
        breaches: scopedBreaches,
        atRisk: scopedAtRisk,
        compliance: scoped.length ? Math.round(((scoped.length - scopedBreaches) / scoped.length) * 100) : 100
      };
    });

    const breachRiskQueue = rows
      .filter((ticket) => !["resolved", "closed"].includes(ticket.status) && (ticket.breached || ticket.atRisk))
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
      if (ticket.status === "resolved" || ticket.status === "closed") current.resolvedTickets += 1;
      if (ticket.breached) current.breaches += 1;
      engineerMap.set(ticket.assignedEngineer, current);
    }
    const engineerPerformance = Array.from(engineerMap.values()).map((engineer) => ({
      ...engineer,
      compliance: engineer.assignedTickets ? Math.round(((engineer.assignedTickets - engineer.breaches) / engineer.assignedTickets) * 100) : 100
    }));

    const trendDays = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - index));
      return dayKey(date);
    });
    const trend = trendDays.map((date) => {
      const scoped = rows.filter((ticket) => dayKey(ticket.createdAt) === date);
      const scopedBreaches = scoped.filter((ticket) => ticket.breached).length;
      return {
        label: date.slice(5),
        value: scoped.length ? Math.round(((scoped.length - scopedBreaches) / scoped.length) * 100) : 100
      };
    });

    return {
      stats: { slaCompliance, breaches, atRisk, averageResponseTimeMinutes },
      priorityMetrics,
      breachRiskQueue,
      engineerPerformance,
      trend
    };
  } finally {
    await connection.close();
  }
}
