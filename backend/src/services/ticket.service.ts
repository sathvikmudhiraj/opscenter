import oracledb from "oracledb";
import { getConnection } from "../config/database";
import { writeAuditLog } from "./audit.service";
import { createNotification, notifyAdmins } from "./notification.service";

type TicketColumns = {
  columns: Set<string>;
  requesterColumn: "requester_id" | "created_by";
  hasAssignedTo: boolean;
  hasUpdatedAt: boolean;
  hasAssetId: boolean;
};

export type TicketFilters = {
  search?: string;
  status?: string;
  priority?: string;
  category?: string;
  assignedTo?: string;
};

async function getTicketColumns(connection: any): Promise<TicketColumns> {
  const result = await connection.execute(
    `SELECT column_name FROM user_tab_columns WHERE table_name = 'TICKETS'`
  );
  const columns = new Set(((result.rows || []) as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME));
  return {
    columns,
    requesterColumn: columns.has("REQUESTER_ID") ? "requester_id" : "created_by",
    hasAssignedTo: columns.has("ASSIGNED_TO"),
    hasUpdatedAt: columns.has("UPDATED_AT"),
    hasAssetId: columns.has("ASSET_ID")
  };
}

async function getUserColumns(connection: any) {
  const result = await connection.execute(
    `SELECT column_name FROM user_tab_columns WHERE table_name = 'USERS'`
  );
  const columns = new Set(((result.rows || []) as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME));
  const usernameColumn = columns.has("USERNAME") ? "username" : columns.has("EMAIL") ? "email" : "login_id";
  const nameExpression = columns.has("NAME") ? "name" : usernameColumn;
  return { usernameColumn, nameExpression };
}

async function getTicketUpdateColumns(connection: any) {
  const result = await connection.execute(
    `SELECT column_name FROM user_tab_columns WHERE table_name = 'TICKET_UPDATES'`
  );
  const columns = new Set(((result.rows || []) as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME));
  return {
    hasTable: columns.size > 0,
    authorColumn: columns.has("AUTHOR_ID") ? "author_id" : "updated_by",
    hasStatusFrom: columns.has("STATUS_FROM"),
    hasStatusTo: columns.has("STATUS_TO")
  };
}

function optionalSelect(columns: Set<string>, column: string, alias = column) {
  return columns.has(column.toUpperCase()) ? `t.${column} AS ${alias}` : `NULL AS ${alias}`;
}

async function addTicketUpdate(connection: any, input: { ticketId: number; actorId: number; message: string; status?: string }) {
  const updateColumns = await getTicketUpdateColumns(connection);
  if (!updateColumns.hasTable) return;

  const statusColumns = updateColumns.hasStatusFrom && updateColumns.hasStatusTo ? ", status_from, status_to" : "";
  const statusValues = updateColumns.hasStatusFrom && updateColumns.hasStatusTo ? ", NULL, :status" : "";
  const binds: Record<string, unknown> = {
    ticketId: input.ticketId,
    actorId: input.actorId,
    message: input.message
  };
  if (updateColumns.hasStatusFrom && updateColumns.hasStatusTo) binds.status = input.status || null;
  await connection.execute(
    `INSERT INTO ticket_updates (ticket_id, ${updateColumns.authorColumn}, message${statusColumns})
     VALUES (:ticketId, :actorId, :message${statusValues})`,
    binds
  );
}

function slaSelect(columns: Set<string>) {
  if (columns.has("SLA_DEADLINE") && columns.has("SLA_STATUS")) {
    return `t.sla_deadline AS sla_deadline, t.sla_status AS sla_status, 'low' AS sla_risk`;
  }
  return `CASE
            WHEN t.priority = 'critical' THEN t.created_at + INTERVAL '1' HOUR
            WHEN t.priority = 'high' THEN t.created_at + INTERVAL '4' HOUR
            WHEN t.priority = 'medium' THEN t.created_at + INTERVAL '8' HOUR
            ELSE t.created_at + INTERVAL '24' HOUR
          END AS sla_deadline,
          'Normal' AS sla_status,
          'low' AS sla_risk`;
}

function buildTicketFilters(input: TicketFilters, ticketColumns: TicketColumns, userColumns: Awaited<ReturnType<typeof getUserColumns>>) {
  const where: string[] = [];
  const binds: Record<string, unknown> = {};
  const assignedUserColumn = ticketColumns.hasAssignedTo ? `assignee.${userColumns.usernameColumn}` : `requester.${userColumns.usernameColumn}`;
  const assignedNameColumn = ticketColumns.hasAssignedTo ? `assignee.${userColumns.nameExpression}` : `requester.${userColumns.nameExpression}`;

  if (input.search?.trim()) {
    binds.search = `%${input.search.trim().toLowerCase()}%`;
    const searchableColumns = [
      "TO_CHAR(t.id)",
      "LOWER(t.title)",
      "LOWER(t.category)",
      `LOWER(requester.${userColumns.nameExpression})`,
      `LOWER(requester.${userColumns.usernameColumn})`,
      `LOWER(${assignedNameColumn})`,
      `LOWER(${assignedUserColumn})`
    ];
    for (const column of ["subcategory", "department", "block", "room_number", "asset_tag_manual"]) {
      if (ticketColumns.columns.has(column.toUpperCase())) searchableColumns.push(`LOWER(t.${column})`);
    }
    where.push(`(${searchableColumns.map((column) => `${column} LIKE :search`).join(" OR ")})`);
  }

  if (input.status && input.status !== "all") {
    where.push("t.status = :status");
    binds.status = input.status;
  }

  if (input.priority && input.priority !== "all") {
    where.push("t.priority = :priority");
    binds.priority = input.priority;
  }

  if (input.category && input.category !== "all") {
    where.push("t.category = :category");
    binds.category = input.category;
  }

  if (input.assignedTo && input.assignedTo !== "all") {
    if (ticketColumns.hasAssignedTo && /^\d+$/.test(input.assignedTo)) {
      where.push("t.assigned_to = :assignedTo");
      binds.assignedTo = Number(input.assignedTo);
    } else {
      where.push(`LOWER(${assignedUserColumn}) = LOWER(:assignedTo)`);
      binds.assignedTo = input.assignedTo;
    }
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    binds
  };
}

export async function listTickets(filters: TicketFilters = {}) {
  const connection = await getConnection();
  try {
    const ticketColumns = await getTicketColumns(connection);
    const userColumns = await getUserColumns(connection);
    const assignedSelect = ticketColumns.hasAssignedTo ? "assignee." : "requester.";
    const assignedJoin = ticketColumns.hasAssignedTo ? "LEFT JOIN users assignee ON assignee.id = t.assigned_to" : "";
    const { whereSql, binds } = buildTicketFilters(filters, ticketColumns, userColumns);
    const result = await connection.execute(
      `SELECT t.id, t.title, t.category,
              ${optionalSelect(ticketColumns.columns, "subcategory", "subcategory")},
              ${optionalSelect(ticketColumns.columns, "department", "department")},
              ${optionalSelect(ticketColumns.columns, "block", "block")},
              ${optionalSelect(ticketColumns.columns, "room_number", "room_number")},
              ${optionalSelect(ticketColumns.columns, "asset_tag_manual", "asset_tag_manual")},
              t.status, t.priority, t.created_at,
              ${ticketColumns.hasUpdatedAt ? "t.updated_at" : "t.created_at"} AS updated_at,
              requester.${userColumns.nameExpression} AS requester_name,
              requester.${userColumns.usernameColumn} AS requester_id,
              ${assignedSelect}${userColumns.nameExpression} AS assigned_to_name,
              ${assignedSelect}${userColumns.usernameColumn} AS assigned_to_id,
              ${ticketColumns.hasUpdatedAt ? "t.updated_at" : "t.created_at"} AS assigned_at,
              ${slaSelect(ticketColumns.columns)}
       FROM tickets t
       JOIN users requester ON requester.id = t.${ticketColumns.requesterColumn}
       ${assignedJoin}
       ${whereSql}
       ORDER BY t.created_at DESC`,
      binds
    );
    console.info("[oracle] Tickets query success");
    return result.rows || [];
  } catch (error) {
    console.info(`[oracle] Tickets query failed: ${error instanceof Error ? error.message : "unknown error"}`);
    throw error;
  } finally {
    await connection.close();
  }
}

export async function getTicketById(id: number) {
  const connection = await getConnection();
  try {
    const ticketColumns = await getTicketColumns(connection);
    const userColumns = await getUserColumns(connection);
    const assignedSelect = ticketColumns.hasAssignedTo ? "assignee." : "requester.";
    const assignedJoin = ticketColumns.hasAssignedTo ? "LEFT JOIN users assignee ON assignee.id = t.assigned_to" : "";
    const result = await connection.execute(
      `SELECT t.id, t.title, t.description, t.category,
              ${optionalSelect(ticketColumns.columns, "subcategory", "subcategory")},
              ${optionalSelect(ticketColumns.columns, "department", "department")},
              ${optionalSelect(ticketColumns.columns, "block", "block")},
              ${optionalSelect(ticketColumns.columns, "room_number", "room_number")},
              ${ticketColumns.hasAssetId ? "t.asset_id" : "NULL"} AS asset_id,
              ${optionalSelect(ticketColumns.columns, "asset_tag_manual", "asset_tag_manual")},
              ${optionalSelect(ticketColumns.columns, "screenshot_url", "screenshot_url")},
              ${optionalSelect(ticketColumns.columns, "service_image_url", "service_image_url")},
              ${optionalSelect(ticketColumns.columns, "engineer_notes", "engineer_notes")},
              ${optionalSelect(ticketColumns.columns, "root_cause", "root_cause")},
              ${optionalSelect(ticketColumns.columns, "corrective_action", "corrective_action")},
              ${optionalSelect(ticketColumns.columns, "preventive_action", "preventive_action")},
              ${optionalSelect(ticketColumns.columns, "parts_used", "parts_used")},
              ${optionalSelect(ticketColumns.columns, "remarks", "remarks")},
              ${optionalSelect(ticketColumns.columns, "resolved_at", "resolved_at")},
              t.status, t.priority, t.created_at,
              ${ticketColumns.hasUpdatedAt ? "t.updated_at" : "t.created_at"} AS updated_at,
              requester.id AS requester_user_id,
              requester.${userColumns.nameExpression} AS requester_name,
              requester.${userColumns.usernameColumn} AS requester_id,
              ${assignedSelect}id AS assigned_to_user_id,
              ${assignedSelect}${userColumns.nameExpression} AS assigned_to_name,
              ${assignedSelect}${userColumns.usernameColumn} AS assigned_to_id,
              ${ticketColumns.hasUpdatedAt ? "t.updated_at" : "t.created_at"} AS assigned_at,
              ${slaSelect(ticketColumns.columns)}
       FROM tickets t
       JOIN users requester ON requester.id = t.${ticketColumns.requesterColumn}
       ${assignedJoin}
       WHERE t.id = :id`,
      { id }
    );
    const ticket = (result.rows?.[0] as any) || null;
    if (!ticket) return null;

    const updateColumns = await getTicketUpdateColumns(connection);
    if (updateColumns.hasTable) {
      const statusSelect = updateColumns.hasStatusTo ? "tu.status_to" : "NULL AS status_to";
      const timelineResult = await connection.execute(
        `SELECT tu.id, tu.${updateColumns.authorColumn} AS author_id,
                COALESCE(u.${userColumns.usernameColumn}, 'system') AS user_login,
                tu.message, ${statusSelect}, tu.created_at
         FROM ticket_updates tu
         LEFT JOIN users u ON u.id = tu.${updateColumns.authorColumn}
         WHERE tu.ticket_id = :id
         ORDER BY tu.created_at ASC`,
        { id }
      );
      ticket.TIMELINE = ((timelineResult.rows || []) as Array<any>).map((entry) => ({
        action: entry.STATUS_TO ? `status_${entry.STATUS_TO}` : "ticket_update",
        userId: entry.AUTHOR_ID,
        user: entry.USER_LOGIN,
        timestamp: entry.CREATED_AT,
        details: entry.MESSAGE
      }));
    } else {
      ticket.TIMELINE = [];
    }

    ticket.ASSET = null;
    ticket.EMPLOYEE = { id: ticket.REQUESTER_USER_ID, loginId: ticket.REQUESTER_ID, name: ticket.REQUESTER_NAME };
    ticket.ENGINEER = ticket.ASSIGNED_TO_ID ? { id: ticket.ASSIGNED_TO_USER_ID, loginId: ticket.ASSIGNED_TO_ID, name: ticket.ASSIGNED_TO_NAME } : null;
    ticket.IMAGE_RETENTION_DAYS = ticket.PRIORITY === "critical" ? 365 : ticket.PRIORITY === "high" ? 180 : 60;
    return ticket;
  } finally {
    await connection.close();
  }
}

export type CreateTicketInput = {
  title: string;
  description?: string;
  category: string;
  subcategory?: string;
  priority: string;
  requesterId: number;
  assetId?: number;
  department?: string;
  block?: string;
  roomNumber?: string;
  assetTagManual?: string;
  screenshotUrl?: string;
};

export async function createTicket(input: CreateTicketInput) {
  const connection = await getConnection();
  try {
    const ticketColumns = await getTicketColumns(connection);
    const columnValues: Array<[string, string, unknown]> = [
      ["title", "title", input.title],
      ["description", "description", input.description || null],
      ["category", "category", input.category],
      ["priority", "priority", input.priority],
      [ticketColumns.requesterColumn, "requesterId", input.requesterId],
      ["status", "status", "open"]
    ];

    const optionalValues: Array<[string, string, unknown]> = [
      ["subcategory", "subcategory", input.subcategory || null],
      ["asset_id", "assetId", input.assetId || null],
      ["department", "department", input.department || null],
      ["block", "block", input.block || null],
      ["room_number", "roomNumber", input.roomNumber || null],
      ["asset_tag_manual", "assetTagManual", input.assetTagManual || null],
      ["screenshot_url", "screenshotUrl", input.screenshotUrl || null]
    ];

    for (const value of optionalValues) {
      if (ticketColumns.columns.has(value[0].toUpperCase())) columnValues.push(value);
    }
    if (ticketColumns.columns.has("SLA_STATUS")) columnValues.push(["sla_status", "slaStatus", "Normal"]);

    const binds = Object.fromEntries(columnValues.map(([, bind, value]) => [bind, value])) as Record<string, unknown>;
    binds.id = { dir: oracledb.BIND_OUT, type: oracledb.NUMBER };

    const result = await connection.execute(
      `INSERT INTO tickets (${columnValues.map(([column]) => column).join(", ")})
       VALUES (${columnValues.map(([, bind]) => `:${bind}`).join(", ")})
       RETURNING id INTO :id`,
      binds
    );
    const id = Number(result.outBinds?.id?.[0]);
    await addTicketUpdate(connection, { ticketId: id, actorId: input.requesterId, message: "Ticket created by user.", status: "open" });
    await notifyAdmins({ title: "New ticket", body: `Ticket #${id} requires triage.` }, connection);
    await writeAuditLog({ userId: input.requesterId, action: "ticket_created", details: `Ticket #${id} created.` }, connection);
    await connection.commit();
    console.info("[oracle] Ticket insert success");
    return getTicketById(id);
  } catch (error) {
    await connection.rollback();
    console.info(`[oracle] Ticket insert failed: ${error instanceof Error ? error.message : "unknown error"}`);
    throw error;
  } finally {
    await connection.close();
  }
}

export async function updateTicketPriority(input: { ticketId: number; priority: string; actorId: number }) {
  const connection = await getConnection();
  try {
    const ticketColumns = await getTicketColumns(connection);
    const updatedAtSql = ticketColumns.hasUpdatedAt ? ", updated_at = CURRENT_TIMESTAMP" : "";
    await connection.execute(
      `UPDATE tickets SET priority = :priority${updatedAtSql} WHERE id = :ticketId`,
      { ticketId: input.ticketId, priority: input.priority }
    );
    await addTicketUpdate(connection, { ticketId: input.ticketId, actorId: input.actorId, message: `Priority changed to ${input.priority}.` });
    await writeAuditLog({ userId: input.actorId, action: "priority_updated", details: `Ticket #${input.ticketId} priority changed to ${input.priority}.` }, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

export async function escalateTicketById(input: { ticketId: number; actorId: number }) {
  await updateTicketStatus({ ticketId: input.ticketId, actorId: input.actorId, status: "escalated", message: "Ticket escalated." });
}

export async function saveEngineerAction(input: {
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
  const connection = await getConnection();
  try {
    const ticketColumns = await getTicketColumns(connection);
    const updates: string[] = ["status = :status"];
    const binds: Record<string, unknown> = { ticketId: input.ticketId, status: input.status };
    const optionalFields: Array<[string, string]> = [
      ["engineer_notes", "engineerNotes"],
      ["root_cause", "rootCause"],
      ["corrective_action", "correctiveAction"],
      ["preventive_action", "preventiveAction"],
      ["parts_used", "partsUsed"],
      ["service_image_url", "serviceImageUrl"],
      ["remarks", "remarks"]
    ];
    for (const [column, bind] of optionalFields) {
      if (ticketColumns.columns.has(column.toUpperCase())) {
        updates.push(`${column} = :${bind}`);
        binds[bind] = input[bind as keyof typeof input] || null;
      }
    }
    if (ticketColumns.columns.has("RESOLVED_AT")) updates.push("resolved_at = CASE WHEN :status IN ('resolved', 'closed') THEN CURRENT_TIMESTAMP ELSE resolved_at END");
    if (ticketColumns.hasUpdatedAt) updates.push("updated_at = CURRENT_TIMESTAMP");

    await connection.execute(`UPDATE tickets SET ${updates.join(", ")} WHERE id = :ticketId`, binds);
    await addTicketUpdate(connection, { ticketId: input.ticketId, actorId: input.actorId, message: input.remarks || "Engineer updated service action.", status: input.status });
    await notifyAdmins({ title: input.status === "resolved" ? "Ticket resolved" : "Ticket updated", body: `Ticket #${input.ticketId} was updated.` }, connection);
    await writeAuditLog({ userId: input.actorId, action: input.status === "resolved" ? "ticket_resolved" : "status_updated", details: `Engineer action saved for ticket #${input.ticketId}.` }, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

export async function assignTicketToEngineer(input: { ticketId: number; engineerId: number; adminId: number }) {
  const connection = await getConnection();
  try {
    const ticketColumns = await getTicketColumns(connection);
    const updatedAtSql = ticketColumns.hasUpdatedAt ? ", updated_at = CURRENT_TIMESTAMP" : "";
    if (ticketColumns.hasAssignedTo) {
      await connection.execute(
        `UPDATE tickets SET assigned_to = :engineerId, status = 'assigned'${updatedAtSql} WHERE id = :ticketId`,
        { ticketId: input.ticketId, engineerId: input.engineerId }
      );
    }
    await addTicketUpdate(connection, { ticketId: input.ticketId, actorId: input.adminId, message: "Engineer assigned.", status: "assigned" });
    await createNotification({ userId: input.engineerId, title: "Ticket assigned", body: `Ticket #${input.ticketId} has been assigned to you.` }, connection);
    await writeAuditLog({ userId: input.adminId, action: "ticket_assigned", details: `Ticket #${input.ticketId} assigned to user #${input.engineerId}.` }, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

export async function updateTicketStatus(input: { ticketId: number; status: string; message?: string; actorId: number }) {
  const connection = await getConnection();
  try {
    const ticketColumns = await getTicketColumns(connection);
    const updates = ["status = :status"];
    if (ticketColumns.columns.has("RESOLVED_AT")) updates.push("resolved_at = CASE WHEN :status IN ('resolved', 'closed') THEN CURRENT_TIMESTAMP ELSE resolved_at END");
    if (ticketColumns.hasUpdatedAt) updates.push("updated_at = CURRENT_TIMESTAMP");
    await connection.execute(
      `UPDATE tickets SET ${updates.join(", ")} WHERE id = :ticketId`,
      { ticketId: input.ticketId, status: input.status }
    );
    await addTicketUpdate(connection, { ticketId: input.ticketId, actorId: input.actorId, message: input.message || `Status changed to ${input.status}.`, status: input.status });
    await notifyAdmins({ title: "Ticket updated", body: `Ticket #${input.ticketId} moved to ${input.status}.` }, connection);
    await writeAuditLog({ userId: input.actorId, action: input.status === "resolved" ? "ticket_resolved" : "status_updated", details: `Ticket #${input.ticketId} moved to ${input.status}.` }, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}
