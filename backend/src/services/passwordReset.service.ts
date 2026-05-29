import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { getConnection } from "../config/database";
import { HttpError } from "../utils/httpError";
import { writeAuditLog } from "./audit.service";
import { createNotification, notifyAdmins } from "./notification.service";

type ResetStatus = "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";

async function getUserColumns(connection: any) {
  const result = await connection.execute(`SELECT column_name FROM user_tab_columns WHERE table_name = 'USERS'`);
  const columns = new Set(((result.rows || []) as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME));
  return {
    usernameColumn: columns.has("USERNAME") ? "username" : columns.has("EMAIL") ? "email" : "login_id",
    nameExpression: columns.has("FULL_NAME") ? "full_name" : columns.has("NAME") ? "name" : columns.has("USERNAME") ? "username" : "email",
    hasDepartment: columns.has("DEPARTMENT"),
    hasPasswordMustChange: columns.has("PASSWORD_MUST_CHANGE"),
    hasUpdatedAt: columns.has("UPDATED_AT")
  };
}

export function generateTemporaryPassword() {
  return `Ops-${randomBytes(9).toString("base64url")}1!`;
}

export async function requestPasswordReset(input: { username: string }) {
  const connection = await getConnection();
  try {
    const userColumns = await getUserColumns(connection);
    const userResult = await connection.execute(
      `SELECT id, ${userColumns.usernameColumn} AS username
       FROM users
       WHERE LOWER(${userColumns.usernameColumn}) = LOWER(:username)`,
      { username: input.username.trim() }
    );
    const user = ((userResult.rows || []) as Array<{ ID: number; USERNAME: string }>)[0];
    if (!user) throw new HttpError(404, "User not found");

    const existing = await connection.execute(
      `SELECT id FROM password_reset_requests WHERE user_id = :userId AND status IN ('PENDING', 'APPROVED')`,
      { userId: user.ID }
    );
    if (!existing.rows?.length) {
      await connection.execute(
        `INSERT INTO password_reset_requests (user_id, username, status)
         VALUES (:userId, :username, 'PENDING')`,
        { userId: user.ID, username: user.USERNAME }
      );
    }

    await notifyAdmins({ title: "Password reset requested", body: `${user.USERNAME} requested password reset assistance.` }, connection);
    await writeAuditLog({ userId: user.ID, action: "PASSWORD_RESET_REQUESTED", details: `${user.USERNAME} requested password reset.` }, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

export async function listPasswordResetRequests() {
  const connection = await getConnection();
  try {
    const userColumns = await getUserColumns(connection);
    const departmentSelect = userColumns.hasDepartment ? "u.department" : "NULL AS department";
    const result = await connection.execute(
      `SELECT r.id, r.user_id, r.username, r.requested_at, r.status, r.processed_by, r.processed_at,
              u.${userColumns.nameExpression} AS full_name,
              u.role,
              ${departmentSelect}
       FROM password_reset_requests r
       JOIN users u ON u.id = r.user_id
       ORDER BY r.requested_at DESC`
    );
    return ((result.rows || []) as Array<any>).map((row) => ({
      id: row.ID,
      userId: row.USER_ID,
      username: row.USERNAME,
      fullName: row.FULL_NAME || row.USERNAME,
      role: row.ROLE,
      department: row.DEPARTMENT || "",
      requestedAt: row.REQUESTED_AT,
      status: row.STATUS,
      processedBy: row.PROCESSED_BY,
      processedAt: row.PROCESSED_AT
    }));
  } finally {
    await connection.close();
  }
}

export async function updatePasswordResetStatus(input: { id: number; status: Extract<ResetStatus, "APPROVED" | "REJECTED">; actorId: number }) {
  const connection = await getConnection();
  try {
    const request = await getRequestForUpdate(connection, input.id);
    if (request.STATUS === "COMPLETED") throw new HttpError(400, "Request already completed");

    await connection.execute(
      `UPDATE password_reset_requests
       SET status = :status, processed_by = :actorId, processed_at = CURRENT_TIMESTAMP
       WHERE id = :id`,
      { id: input.id, status: input.status, actorId: input.actorId }
    );
    if (input.status === "APPROVED") {
      await createNotification({ userId: request.USER_ID, title: "Password reset approved", body: "Your password reset request was approved by an administrator." }, connection);
    }
    await writeAuditLog({ userId: input.actorId, action: input.status === "APPROVED" ? "PASSWORD_RESET_APPROVED" : "PASSWORD_RESET_REJECTED", details: `${request.USERNAME} reset request ${input.status.toLowerCase()}.` }, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

export async function completePasswordReset(input: { id: number; actorId: number; temporaryPassword: string }) {
  const connection = await getConnection();
  try {
    const request = await getRequestForUpdate(connection, input.id);
    if (request.STATUS === "REJECTED") throw new HttpError(400, "Request was rejected");

    const userColumns = await getUserColumns(connection);
    const passwordHash = await bcrypt.hash(input.temporaryPassword, 12);
    const updates = ["password_hash = :passwordHash"];
    if (userColumns.hasPasswordMustChange) updates.push("password_must_change = 1");
    if (userColumns.hasUpdatedAt) updates.push("updated_at = CURRENT_TIMESTAMP");
    await connection.execute(
      `UPDATE users SET ${updates.join(", ")} WHERE id = :userId`,
      { userId: request.USER_ID, passwordHash }
    );
    await connection.execute(
      `UPDATE password_reset_requests
       SET status = 'COMPLETED', processed_by = :actorId, processed_at = CURRENT_TIMESTAMP
       WHERE id = :id`,
      { id: input.id, actorId: input.actorId }
    );
    await createNotification({ userId: request.USER_ID, title: "Password reset completed", body: "Your temporary password has been issued. Change it after signing in." }, connection);
    await writeAuditLog({ userId: input.actorId, action: "PASSWORD_RESET_COMPLETED", details: `${request.USERNAME} password reset completed.` }, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

export async function changeOwnPassword(input: { userId: number; currentPassword: string; newPassword: string }) {
  const connection = await getConnection();
  try {
    const userColumns = await getUserColumns(connection);
    const result = await connection.execute(
      `SELECT password_hash FROM users WHERE id = :userId`,
      { userId: input.userId }
    );
    const user = ((result.rows || []) as Array<{ PASSWORD_HASH: string }>)[0];
    if (!user) throw new HttpError(404, "User not found");
    const valid = await bcrypt.compare(input.currentPassword, String(user.PASSWORD_HASH || "")).catch(() => false);
    if (!valid) throw new HttpError(401, "Current password is incorrect");

    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    const updates = ["password_hash = :passwordHash"];
    if (userColumns.hasPasswordMustChange) updates.push("password_must_change = 0");
    if (userColumns.hasUpdatedAt) updates.push("updated_at = CURRENT_TIMESTAMP");
    await connection.execute(
      `UPDATE users SET ${updates.join(", ")} WHERE id = :userId`,
      { userId: input.userId, passwordHash }
    );
    await writeAuditLog({ userId: input.userId, action: "PASSWORD_CHANGED", details: "User changed password after reset." }, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

async function getRequestForUpdate(connection: any, id: number) {
  const result = await connection.execute(
    `SELECT id, user_id, username, status FROM password_reset_requests WHERE id = :id`,
    { id }
  );
  const request = ((result.rows || []) as Array<any>)[0];
  if (!request) throw new HttpError(404, "Password reset request not found");
  return request;
}
