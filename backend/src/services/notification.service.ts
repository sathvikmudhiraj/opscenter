import { getConnection } from "../config/database";
import { writeAuditLog } from "./audit.service";
import { EventEmitter } from "events";
import { getSystemSettings } from "./settings.service";

export const notificationEvents = new EventEmitter();
notificationEvents.setMaxListeners(100);

async function getNotificationColumns(connection: any) {
  const result = await connection.execute(
    `SELECT column_name, data_type FROM user_tab_columns WHERE table_name = 'NOTIFICATIONS'`
  );
  const rows = (result.rows || []) as Array<{ COLUMN_NAME: string; DATA_TYPE: string }>;
  const columns = new Set(rows.map((row) => row.COLUMN_NAME));
  const isReadColumn = rows.find((row) => row.COLUMN_NAME === "IS_READ");
  const isReadDataType = isReadColumn?.DATA_TYPE || "";
  return {
    hasTable: columns.size > 0,
    messageColumn: columns.has("BODY") ? "body" : "message",
    hasReadAt: columns.has("READ_AT"),
    hasIsRead: columns.has("IS_READ"),
    isReadIsCharacter: ["CHAR", "NCHAR", "VARCHAR2", "NVARCHAR2"].includes(isReadDataType),
    hasType: columns.has("TYPE")
  };
}

function isUnreadValue(value: unknown) {
  if (value === null || value === undefined) return true;
  const normalized = String(value).trim().toUpperCase();
  return normalized === "N" || normalized === "0" || normalized === "FALSE";
}

function isReadValue(value: unknown) {
  return !isUnreadValue(value);
}

function emitNotificationMetricsChanged() {
  setTimeout(() => notificationEvents.emit("changed"), 250);
}

type NotificationCategory =
  | "ticketAssignment"
  | "ticketResolution"
  | "slaBreach"
  | "assetAssignment"
  | "assetRequest"
  | "serviceOutage"
  | "system";

async function notificationAllowed(category: NotificationCategory = "system") {
  const settings = await getSystemSettings();
  if (!settings.notifications.inAppEnabled) return false;
  if (category === "ticketAssignment") return settings.notifications.ticketAssignmentAlerts;
  if (category === "ticketResolution") return settings.notifications.ticketResolutionAlerts;
  if (category === "slaBreach") return settings.notifications.slaBreachAlerts;
  if (category === "assetAssignment") return settings.notifications.assetAssignmentAlerts;
  if (category === "assetRequest") return settings.notifications.assetRequestAlerts;
  if (category === "serviceOutage") return settings.notifications.serviceOutageAlerts;
  return true;
}

export async function getUnreadNotificationCount(input?: { userId: number }) {
  if (!(await notificationAllowed())) return 0;
  const connection = await getConnection();
  try {
    const columns = await getNotificationColumns(connection);
    if (!columns.hasTable) return 0;
    const userFilter = input ? "user_id = :userId AND " : "";
    const binds = input ? { userId: input.userId } : {};
    if (columns.hasIsRead) {
      const result = await connection.execute(
        `SELECT COUNT(*)
         AS unread_count
         FROM NOTIFICATIONS
         WHERE ${userFilter}UPPER(TRIM(TO_CHAR(IS_READ))) IN ('N', '0', 'FALSE')`,
        binds
      );
      return Number(((result.rows || [])[0] as { UNREAD_COUNT?: number })?.UNREAD_COUNT || 0);
    }
    if (columns.hasReadAt) {
      const result = await connection.execute(
        `SELECT COUNT(*) AS unread_count
         FROM notifications
         WHERE ${userFilter}read_at IS NULL`,
        binds
      );
      return Number(((result.rows || [])[0] as { UNREAD_COUNT?: number })?.UNREAD_COUNT || 0);
    }
    return 0;
  } finally {
    await connection.close();
  }
}

export async function createNotification(input: { userId: number; title: string; body?: string; category?: NotificationCategory }, connection?: any) {
  if (!(await notificationAllowed(input.category))) return;
  const activeConnection = connection || await getConnection();
  const shouldClose = !connection;
  try {
    const columns = await getNotificationColumns(activeConnection);
    if (!columns.hasTable) return;
    const readColumn = columns.hasIsRead ? ", is_read" : "";
    const readValue = columns.hasIsRead ? ", :isRead" : "";
    const typeColumns = columns.hasType ? ", type" : "";
    const typeValues = columns.hasType ? ", 'system'" : "";
    await activeConnection.execute(
      `INSERT INTO notifications (user_id, title, ${columns.messageColumn}${readColumn}${typeColumns})
       VALUES (:userId, :title, :body${readValue}${typeValues})`,
      { userId: input.userId, title: input.title, body: input.body || null, isRead: columns.isReadIsCharacter ? "N" : 0 }
    );
    if (shouldClose) await activeConnection.commit();
    emitNotificationMetricsChanged();
  } catch (error) {
    if (shouldClose) await activeConnection.rollback();
    throw error;
  } finally {
    if (shouldClose) await activeConnection.close();
  }
}

export async function notifyAdmins(input: { title: string; body?: string; category?: NotificationCategory }, connection: any) {
  if (!(await notificationAllowed(input.category))) return;
  const userColumnsResult = await connection.execute(
    `SELECT column_name FROM user_tab_columns WHERE table_name = 'USERS'`
  );
  const userColumns = new Set(((userColumnsResult.rows || []) as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME));
  const statusFilter = userColumns.has("STATUS") ? "AND status = 'active'" : "";
  const result = await connection.execute(
    `SELECT id FROM users WHERE role = 'admin' ${statusFilter}`
  );
  for (const admin of (result.rows || []) as Array<{ ID: number }>) {
    await createNotification({ userId: admin.ID, title: input.title, body: input.body, category: input.category }, connection);
  }
}

export async function listNotifications(input: { userId: number }) {
  if (!(await notificationAllowed())) return [];
  const connection = await getConnection();
  try {
    const columns = await getNotificationColumns(connection);
    if (!columns.hasTable) return [];
    const readAtSelect = columns.hasReadAt ? "read_at" : "NULL AS read_at";
    const isReadSelect = columns.hasIsRead ? "is_read" : columns.hasReadAt ? "CASE WHEN read_at IS NULL THEN 'N' ELSE 'Y' END AS is_read" : "'Y' AS is_read";
    const result = await connection.execute(
      `SELECT id, user_id, title, ${columns.messageColumn} AS body, ${readAtSelect}, ${isReadSelect}, created_at
       FROM notifications
       WHERE user_id = :userId
       ORDER BY created_at DESC`,
      input
    );
    return ((result.rows || []) as Array<any>).map((item) => {
      const read = isReadValue(item.IS_READ);
      return {
        id: item.ID,
        user_id: item.USER_ID,
        userId: item.USER_ID,
        title: item.TITLE,
        body: item.BODY || "",
        message: item.BODY || "",
        readAt: item.READ_AT || (read ? item.CREATED_AT : null),
        isRead: read,
        createdAt: item.CREATED_AT,
        created_at: item.CREATED_AT
      };
    });
  } finally {
    await connection.close();
  }
}

export async function markNotificationRead(input: { id: number; userId: number }) {
  const connection = await getConnection();
  try {
    const columns = await getNotificationColumns(connection);
    if (!columns.hasTable) return;
    const updates = [];
    if (columns.hasIsRead) updates.push("is_read = :isRead");
    if (columns.hasReadAt) updates.push("read_at = COALESCE(read_at, CURRENT_TIMESTAMP)");
    const setSql = updates.length ? updates.join(", ") : "id = id";
    await connection.execute(
      `UPDATE notifications
       SET ${setSql}
       WHERE id = :id AND user_id = :userId`,
      { ...input, isRead: columns.isReadIsCharacter ? "Y" : 1 }
    );
    await connection.commit();
    emitNotificationMetricsChanged();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

export async function markAllNotificationsRead(input: { userId: number }) {
  const connection = await getConnection();
  try {
    const columns = await getNotificationColumns(connection);
    if (!columns.hasTable) return;
    const updates = [];
    if (columns.hasIsRead) updates.push("is_read = :isRead");
    if (columns.hasReadAt) updates.push("read_at = COALESCE(read_at, CURRENT_TIMESTAMP)");
    const setSql = updates.length ? updates.join(", ") : "id = id";
    await connection.execute(
      `UPDATE notifications
       SET ${setSql}
       WHERE user_id = :userId`,
      { ...input, isRead: columns.isReadIsCharacter ? "Y" : 1 }
    );
    await connection.commit();
    emitNotificationMetricsChanged();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

export async function listAuditLogs() {
  const connection = await getConnection();
  try {
    const auditTable = await connection.execute(`SELECT COUNT(*) AS count FROM user_tables WHERE table_name = 'AUDIT_LOGS'`);
    const exists = Number(((auditTable.rows || [])[0] as { COUNT?: number })?.COUNT || 0) > 0;
    if (!exists) return [];
    const userColumnsResult = await connection.execute(`SELECT column_name FROM user_tab_columns WHERE table_name = 'USERS'`);
    const userColumns = new Set(((userColumnsResult.rows || []) as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME));
    const userColumn = userColumns.has("USERNAME") ? "username" : userColumns.has("EMAIL") ? "email" : "login_id";
    const result = await connection.execute(
      `SELECT a.id, a.user_id, COALESCE(u.${userColumn}, 'system') AS user_login,
              a.action, a.details, a.created_at
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC
       FETCH FIRST 200 ROWS ONLY`
    );
    return ((result.rows || []) as Array<any>).map((item) => ({
      id: item.ID,
      userId: item.USER_ID,
      user: item.USER_LOGIN,
      action: item.ACTION,
      details: item.DETAILS || "",
      timestamp: item.CREATED_AT,
      createdAt: item.CREATED_AT
    }));
  } finally {
    await connection.close();
  }
}

export async function auditAndNotifyUser(input: { userId: number; title: string; body: string; actorId?: number; action: string; details: string }, connection: any) {
  await createNotification({ userId: input.userId, title: input.title, body: input.body }, connection);
  await writeAuditLog({ userId: input.actorId, action: input.action, details: input.details }, connection);
}
