import { getConnection } from "../config/database";
import { writeAuditLog } from "./audit.service";

async function getNotificationColumns(connection: any) {
  const result = await connection.execute(
    `SELECT column_name FROM user_tab_columns WHERE table_name = 'NOTIFICATIONS'`
  );
  const columns = new Set(((result.rows || []) as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME));
  return {
    hasTable: columns.size > 0,
    messageColumn: columns.has("BODY") ? "body" : "message",
    hasReadAt: columns.has("READ_AT"),
    hasIsRead: columns.has("IS_READ"),
    hasType: columns.has("TYPE")
  };
}

export async function createNotification(input: { userId: number; title: string; body?: string }, connection?: any) {
  const activeConnection = connection || await getConnection();
  const shouldClose = !connection;
  try {
    const columns = await getNotificationColumns(activeConnection);
    if (!columns.hasTable) return;
    const typeColumns = columns.hasType ? ", type" : "";
    const typeValues = columns.hasType ? ", 'system'" : "";
    await activeConnection.execute(
      `INSERT INTO notifications (user_id, title, ${columns.messageColumn}${typeColumns})
       VALUES (:userId, :title, :body${typeValues})`,
      { userId: input.userId, title: input.title, body: input.body || null }
    );
    if (shouldClose) await activeConnection.commit();
  } catch (error) {
    if (shouldClose) await activeConnection.rollback();
    throw error;
  } finally {
    if (shouldClose) await activeConnection.close();
  }
}

export async function notifyAdmins(input: { title: string; body?: string }, connection: any) {
  const userColumnsResult = await connection.execute(
    `SELECT column_name FROM user_tab_columns WHERE table_name = 'USERS'`
  );
  const userColumns = new Set(((userColumnsResult.rows || []) as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME));
  const statusFilter = userColumns.has("STATUS") ? "AND status = 'active'" : "";
  const result = await connection.execute(
    `SELECT id FROM users WHERE role = 'admin' ${statusFilter}`
  );
  for (const admin of (result.rows || []) as Array<{ ID: number }>) {
    await createNotification({ userId: admin.ID, title: input.title, body: input.body }, connection);
  }
}

export async function listNotifications(input: { userId: number }) {
  const connection = await getConnection();
  try {
    const columns = await getNotificationColumns(connection);
    if (!columns.hasTable) return [];
    const readSelect = columns.hasReadAt ? "read_at" : columns.hasIsRead ? "is_read" : "0 AS is_read";
    const result = await connection.execute(
      `SELECT id, user_id, title, ${columns.messageColumn} AS body, ${readSelect}, created_at
       FROM notifications
       WHERE user_id = :userId
       ORDER BY created_at DESC`,
      input
    );
    return ((result.rows || []) as Array<any>).map((item) => ({
      id: item.ID,
      user_id: item.USER_ID,
      userId: item.USER_ID,
      title: item.TITLE,
      body: item.BODY || "",
      message: item.BODY || "",
      readAt: item.READ_AT || (item.IS_READ ? item.CREATED_AT : null),
      isRead: Boolean(item.READ_AT || item.IS_READ),
      createdAt: item.CREATED_AT,
      created_at: item.CREATED_AT
    }));
  } finally {
    await connection.close();
  }
}

export async function markNotificationRead(input: { id: number; userId: number }) {
  const connection = await getConnection();
  try {
    const columns = await getNotificationColumns(connection);
    if (!columns.hasTable) return;
    const setSql = columns.hasReadAt ? "read_at = COALESCE(read_at, CURRENT_TIMESTAMP)" : columns.hasIsRead ? "is_read = 1" : "id = id";
    await connection.execute(
      `UPDATE notifications
       SET ${setSql}
       WHERE id = :id AND user_id = :userId`,
      input
    );
    await connection.commit();
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
    const setSql = columns.hasReadAt ? "read_at = COALESCE(read_at, CURRENT_TIMESTAMP)" : columns.hasIsRead ? "is_read = 1" : "id = id";
    await connection.execute(
      `UPDATE notifications
       SET ${setSql}
       WHERE user_id = :userId`,
      input
    );
    await connection.commit();
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
