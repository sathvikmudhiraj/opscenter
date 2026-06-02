import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import oracledb from "oracledb";
import { getConnection } from "../config/database";
import type { UserRole } from "../types/auth";
import { HttpError } from "../utils/httpError";
import { writeAuditLog } from "./audit.service";
import { createNotification } from "./notification.service";
import { validatePasswordPolicy } from "./settings.service";

export type UserStatus = "active" | "inactive" | "disabled";

export type CreateUserInput = {
  fullName: string;
  username: string;
  email?: string;
  password: string;
  role: UserRole;
  department?: string;
  employeeId?: string;
  phone?: string;
  status?: UserStatus;
  actorId: number;
};

export type UpdateUserInput = Partial<Omit<CreateUserInput, "password" | "actorId">> & {
  id: number;
  actorId: number;
};

async function getUserColumns(connection: any) {
  const result = await connection.execute(
    `SELECT column_name
     FROM user_tab_columns
     WHERE table_name = 'USERS'`
  );
  const columns = new Set(((result.rows || []) as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME));
  return {
    columns,
    usernameColumn: columns.has("USERNAME") ? "username" : columns.has("EMAIL") ? "email" : "login_id",
    fullNameColumn: columns.has("FULL_NAME") ? "full_name" : columns.has("NAME") ? "name" : "username",
    hasEmail: columns.has("EMAIL"),
    hasDepartment: columns.has("DEPARTMENT"),
    hasEmployeeId: columns.has("EMPLOYEE_ID"),
    hasPhone: columns.has("PHONE"),
    hasStatus: columns.has("STATUS"),
    hasUpdatedAt: columns.has("UPDATED_AT")
  };
}

function normalizeStatus(status?: string) {
  if (status === "inactive" || status === "disabled") return status;
  return "active";
}

function mapUser(row: any) {
  return {
    id: row.ID,
    userId: row.ID,
    name: row.FULL_NAME || row.NAME || row.USERNAME || row.LOGIN_ID,
    fullName: row.FULL_NAME || row.NAME || row.USERNAME || row.LOGIN_ID,
    username: row.USERNAME || row.LOGIN_ID,
    loginId: row.LOGIN_ID || row.USERNAME,
    email: row.EMAIL || "",
    role: row.ROLE,
    department: row.DEPARTMENT || "",
    employeeId: row.EMPLOYEE_ID || "",
    phone: row.PHONE || "",
    status: normalizeStatus(row.STATUS),
    createdAt: row.CREATED_AT,
    updatedAt: row.UPDATED_AT
  };
}

export async function listUsers() {
  const connection = await getConnection();
  try {
    const meta = await getUserColumns(connection);
    const statusSelect = meta.hasStatus ? "status" : "'active' AS status";
    const result = await connection.execute(
      `SELECT id,
              ${meta.fullNameColumn} AS full_name,
              ${meta.usernameColumn} AS username,
              ${meta.usernameColumn} AS login_id,
              ${meta.hasEmail ? "email" : "NULL AS email"},
              role,
              ${meta.hasDepartment ? "department" : "NULL AS department"},
              ${meta.hasEmployeeId ? "employee_id" : "NULL AS employee_id"},
              ${meta.hasPhone ? "phone" : "NULL AS phone"},
              ${statusSelect},
              created_at,
              ${meta.hasUpdatedAt ? "updated_at" : "created_at AS updated_at"}
       FROM users
       ORDER BY role, full_name`
    );
    console.info("[oracle] Users query success");
    return ((result.rows || []) as Array<any>).map(mapUser);
  } catch (error) {
    console.info(`[oracle] Users query failed: ${error instanceof Error ? error.message : "unknown error"}`);
    throw error;
  } finally {
    await connection.close();
  }
}

export async function getUserProfile(id: number) {
  const connection = await getConnection();
  try {
    const meta = await getUserColumns(connection);
    const statusSelect = meta.hasStatus ? "status" : "'active' AS status";
    const result = await connection.execute(
      `SELECT id,
              ${meta.fullNameColumn} AS full_name,
              ${meta.usernameColumn} AS username,
              ${meta.usernameColumn} AS login_id,
              ${meta.hasEmail ? "email" : "NULL AS email"},
              role,
              ${meta.hasDepartment ? "department" : "NULL AS department"},
              ${meta.hasEmployeeId ? "employee_id" : "NULL AS employee_id"},
              ${meta.hasPhone ? "phone" : "NULL AS phone"},
              ${statusSelect},
              created_at,
              ${meta.hasUpdatedAt ? "updated_at" : "created_at AS updated_at"}
       FROM users
       WHERE id = :id`,
      { id }
    );
    const row = ((result.rows || []) as Array<any>)[0];
    if (!row) throw new HttpError(404, "User not found");
    return mapUser(row);
  } finally {
    await connection.close();
  }
}

export async function createUser(input: CreateUserInput) {
  const connection = await getConnection();
  try {
    await validatePasswordPolicy(input.password);
    const meta = await getUserColumns(connection);
    const passwordHash = await bcrypt.hash(input.password, 12);
    const values: Array<[string, string, unknown]> = [
      [meta.usernameColumn, "username", input.username.toLowerCase()],
      ["password_hash", "passwordHash", passwordHash],
      ["role", "role", input.role]
    ];
    if (meta.columns.has("FULL_NAME")) values.push(["full_name", "fullName", input.fullName]);
    else if (meta.columns.has("NAME")) values.push(["name", "fullName", input.fullName]);
    if (meta.hasEmail) values.push(["email", "email", input.email || null]);
    if (meta.hasDepartment) values.push(["department", "department", input.department || null]);
    if (meta.hasEmployeeId) values.push(["employee_id", "employeeId", input.employeeId || null]);
    if (meta.hasPhone) values.push(["phone", "phone", input.phone || null]);
    if (meta.hasStatus) values.push(["status", "status", input.status || "active"]);
    if (meta.hasUpdatedAt) values.push(["updated_at", "updatedAt", new Date()]);

    const binds = Object.fromEntries(values.map(([, bind, value]) => [bind, value])) as Record<string, unknown>;
    binds.id = { dir: oracledb.BIND_OUT, type: oracledb.NUMBER };
    const result = await connection.execute(
      `INSERT INTO users (${values.map(([column]) => column).join(", ")})
       VALUES (${values.map(([, bind]) => `:${bind}`).join(", ")})
       RETURNING id INTO :id`,
      binds
    );
    const id = Number(result.outBinds?.id?.[0]);
    await writeAuditLog({ userId: input.actorId, action: "user_created", details: `${input.username} created as ${input.role}.` }, connection);
    await connection.commit();
    console.info("[oracle] User insert success");
    return { id, ...input, password: undefined };
  } catch (error) {
    await connection.rollback();
    console.info(`[oracle] User insert failed: ${error instanceof Error ? error.message : "unknown error"}`);
    throw error;
  } finally {
    await connection.close();
  }
}

export async function updateUser(input: UpdateUserInput) {
  const connection = await getConnection();
  try {
    const meta = await getUserColumns(connection);
    const updates: string[] = [];
    const binds: Record<string, unknown> = { id: input.id };
    const candidates: Array<[string, string, unknown, boolean]> = [
      [meta.usernameColumn, "username", input.username?.toLowerCase(), input.username !== undefined],
      ["role", "role", input.role, input.role !== undefined],
      ["full_name", "fullName", input.fullName, input.fullName !== undefined && meta.columns.has("FULL_NAME")],
      ["name", "fullName", input.fullName, input.fullName !== undefined && meta.columns.has("NAME")],
      ["email", "email", input.email || null, input.email !== undefined && meta.hasEmail],
      ["department", "department", input.department || null, input.department !== undefined && meta.hasDepartment],
      ["employee_id", "employeeId", input.employeeId || null, input.employeeId !== undefined && meta.hasEmployeeId],
      ["phone", "phone", input.phone || null, input.phone !== undefined && meta.hasPhone],
      ["status", "status", input.status, input.status !== undefined && meta.hasStatus]
    ];
    for (const [column, bind, value, enabled] of candidates) {
      if (!enabled) continue;
      updates.push(`${column} = :${bind}`);
      binds[bind] = value;
    }
    if (meta.hasUpdatedAt) updates.push("updated_at = CURRENT_TIMESTAMP");
    if (!updates.length) return;

    await connection.execute(`UPDATE users SET ${updates.join(", ")} WHERE id = :id`, binds);
    await writeAuditLog({ userId: input.actorId, action: "user_updated", details: `User #${input.id} updated.` }, connection);
    await connection.commit();
    console.info("[oracle] User update success");
  } catch (error) {
    await connection.rollback();
    console.info(`[oracle] User update failed: ${error instanceof Error ? error.message : "unknown error"}`);
    throw error;
  } finally {
    await connection.close();
  }
}

export async function updateUserRole(input: { id: number; role: UserRole; actorId?: number }) {
  return updateUser({ id: input.id, role: input.role, actorId: input.actorId || input.id });
}

export async function updateUserStatus(input: { id: number; status: UserStatus; actorId: number }) {
  return updateUser({ id: input.id, status: input.status, actorId: input.actorId });
}

export async function resetPassword(input: { id: number; actorId: number; password?: string }) {
  const connection = await getConnection();
  try {
    const meta = await getUserColumns(connection);
    const updatedAtSql = meta.hasUpdatedAt ? ", updated_at = CURRENT_TIMESTAMP" : "";
    const userResult = await connection.execute(`SELECT ${meta.usernameColumn} AS username FROM users WHERE id = :id`, { id: input.id });
    const user = (userResult.rows || [])[0] as { USERNAME: string } | undefined;
    if (!user) throw new HttpError(404, "User not found");

    const temporaryPassword = input.password || `Ops-${randomBytes(8).toString("base64url")}1`;
    await validatePasswordPolicy(temporaryPassword);
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await connection.execute(
      `UPDATE users
       SET password_hash = :passwordHash${updatedAtSql}
       WHERE id = :id`,
      { id: input.id, passwordHash }
    );
    await createNotification({ userId: input.id, title: "Password reset", body: "Your password was reset by an administrator." }, connection);
    await writeAuditLog({ userId: input.actorId, action: "password_reset", details: `${user.USERNAME} password reset.` }, connection);
    await connection.commit();
    return { temporaryPassword };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

export async function deleteUser(input: { id: number; actorId: number }) {
  const connection = await getConnection();
  try {
    const meta = await getUserColumns(connection);
    const userResult = await connection.execute(`SELECT ${meta.usernameColumn} AS username FROM users WHERE id = :id`, { id: input.id });
    const user = (userResult.rows || [])[0] as { USERNAME: string } | undefined;
    if (!user) throw new HttpError(404, "User not found");
    if (user.USERNAME === "admin") throw new HttpError(400, "The built-in admin account cannot be deleted");

    await connection.execute(`DELETE FROM users WHERE id = :id`, { id: input.id });
    await writeAuditLog({ userId: input.actorId, action: "user_deleted", details: `${user.USERNAME} deleted.` }, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.info(`[oracle] User delete failed: ${error instanceof Error ? error.message : "unknown error"}`);
    throw error;
  } finally {
    await connection.close();
  }
}
