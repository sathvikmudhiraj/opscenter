import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import oracledb from "oracledb";
import { getConnection } from "../config/database";
import { env } from "../config/env";
import type { UserRole } from "../types/auth";
import { HttpError } from "../utils/httpError";
import { writeAuditLog } from "./audit.service";
import { getSystemSettings, validatePasswordPolicy } from "./settings.service";

type UserRow = {
  id: number;
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: string;
  forcePasswordChange: boolean;
};

type OracleUserRow = Record<string, unknown>;
type FailedLoginState = {
  count: number;
  lockedUntil: number;
  cooldownLevel: number;
};

const failedLogins = new Map<string, FailedLoginState>();

function logDevelopmentAuth(message: string) {
  if (env.nodeEnv !== "production") {
    console.info(`[auth] ${message}`);
  }
}

function normalizeLoginKey(username: string) {
  return username.trim().toLowerCase();
}

function cooldownDetails(state: FailedLoginState) {
  const remainingSeconds = Math.max(1, Math.ceil((state.lockedUntil - Date.now()) / 1000));
  const message = `Too many failed attempts. Try again in ${remainingSeconds} seconds.`;
  return {
    success: false,
    message,
    remainingSeconds,
    lockedUntil: new Date(state.lockedUntil).toISOString(),
    failedAttempts: state.count
  };
}

export function unlockLogin(username: string) {
  const loginKey = normalizeLoginKey(username);
  const previous = failedLogins.get(loginKey);
  failedLogins.delete(loginKey);
  return {
    username: loginKey,
    unlocked: Boolean(previous),
    failedAttempts: previous?.count || 0
  };
}

function signToken(user: Pick<UserRow, "id" | "name" | "username" | "email" | "role">, sessionTimeoutMinutes: number) {
  const options: SignOptions = {
    expiresIn: `${sessionTimeoutMinutes}m` as SignOptions["expiresIn"]
  };
  return jwt.sign({ sub: user.id, username: user.username, email: user.email || user.username, fullName: user.name, role: user.role }, env.jwtSecret, options);
}

function normalizeRole(role: unknown): UserRole {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "admin" || normalized === "engineer" || normalized === "employee") return normalized;
  throw new HttpError(401, "Invalid credentials");
}

function normalizeUser(row: OracleUserRow): UserRow {
  const username = row.USERNAME ?? row.EMAIL ?? row.LOGIN_ID;
  const email = row.EMAIL ?? username;
  return {
    id: Number(row.ID),
    name: String(row.FULL_NAME ?? row.NAME ?? username ?? ""),
    username: String(username ?? "").toLowerCase(),
    email: String(email ?? "").toLowerCase(),
    passwordHash: String(row.PASSWORD_HASH ?? ""),
    role: normalizeRole(row.ROLE),
    status: String(row.STATUS ?? "active").toLowerCase(),
    forcePasswordChange: Number(row.PASSWORD_MUST_CHANGE || 0) === 1
  };
}

async function getUserAuthColumns(connection: any) {
  const result = await connection.execute(
    `SELECT column_name
     FROM user_tab_columns
     WHERE table_name = 'USERS'
       AND column_name IN ('ID', 'NAME', 'FULL_NAME', 'USERNAME', 'EMAIL', 'LOGIN_ID', 'PASSWORD_HASH', 'ROLE', 'STATUS', 'PASSWORD_MUST_CHANGE')`
  );
  const columns = new Set(((result.rows || []) as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME));
  const usernameColumn = ["USERNAME", "EMAIL", "LOGIN_ID"].find((column) => columns.has(column));
  if (!usernameColumn) throw new HttpError(500, "USERS table must include USERNAME or EMAIL");
  if (!columns.has("PASSWORD_HASH") || !columns.has("ROLE")) {
    throw new HttpError(500, "USERS table must include PASSWORD_HASH and ROLE");
  }

  return {
    usernameColumn,
    hasId: columns.has("ID"),
    nameColumn: columns.has("FULL_NAME") ? "full_name" : columns.has("NAME") ? "name" : usernameColumn.toLowerCase(),
    hasEmail: columns.has("EMAIL"),
    hasStatus: columns.has("STATUS"),
    hasPasswordMustChange: columns.has("PASSWORD_MUST_CHANGE")
  };
}

export async function getBootstrapState() {
  const connection = await getConnection();
  try {
    const result = await connection.execute("SELECT COUNT(*) AS count FROM users");
    const rows = (result.rows || []) as Array<{ COUNT: number }>;
    const count = rows[0]?.COUNT || 0;
    return { setupRequired: count === 0 };
  } finally {
    await connection.close();
  }
}

export async function setupAdmin(input: { name: string; email: string; password: string }) {
  const connection = await getConnection();
  try {
    await validatePasswordPolicy(input.password);
    const authColumns = await getUserAuthColumns(connection);
    const usernameColumn = authColumns.usernameColumn.toLowerCase();
    const countResult = await connection.execute("SELECT COUNT(*) AS count FROM users");
    const countRows = (countResult.rows || []) as Array<{ COUNT: number }>;
    if ((countRows[0]?.COUNT || 0) > 0) {
      throw new HttpError(409, "Initial admin setup has already been completed");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const values: Array<[string, string, unknown]> = [
      [authColumns.nameColumn, "name", input.name],
      [usernameColumn, "username", input.email.toLowerCase()],
      ["password_hash", "passwordHash", passwordHash],
      ["role", "role", "admin"]
    ];
    if (authColumns.hasStatus) values.push(["status", "status", "active"]);
    if (authColumns.hasEmail && usernameColumn !== "email") values.push(["email", "email", input.email.toLowerCase()]);
    values.push(["id", "id", { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }]);
    const insertValues = values.filter(([column]) => column !== "id");
    const binds = Object.fromEntries(values.map(([, bind, value]) => [bind, value]));
    const result = await connection.execute(
      `INSERT INTO users (${insertValues.map(([column]) => column).join(", ")})
       VALUES (${insertValues.map(([, bind]) => `:${bind}`).join(", ")})
       RETURNING id INTO :id`,
      binds
    );
    const id = Number(result.outBinds?.id?.[0]);
    await writeAuditLog({ userId: id, action: "user_created", details: `${input.email.toLowerCase()} created as first admin.` }, connection);
    await connection.commit();
    const user = { id, name: input.name, username: input.email.toLowerCase(), email: input.email.toLowerCase(), role: "admin" as const };
    const settings = await getSystemSettings({ force: true });
    return { token: signToken(user, settings.security.sessionTimeoutMinutes), user };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

export async function login(input: { email: string; password: string }) {
  const connection = await getConnection();
  try {
    const loginKey = normalizeLoginKey(input.email);
    const settings = await getSystemSettings({ force: true });
    const cooldownPolicy = settings.security;
    const cooldownEnabled = env.nodeEnv === "production" && cooldownPolicy.cooldownEnabled;
    let attempt = cooldownEnabled ? failedLogins.get(loginKey) : undefined;
    if (cooldownEnabled && attempt?.lockedUntil) {
      if (attempt.lockedUntil > Date.now()) {
        const details = cooldownDetails(attempt);
        throw new HttpError(429, details.message, details);
      }
      attempt = { ...attempt, count: 0, lockedUntil: 0 };
      failedLogins.set(loginKey, attempt);
    } else if (!cooldownEnabled) {
      failedLogins.delete(loginKey);
    }
    if (env.nodeEnv !== "production") {
      const schemaResult = await connection.execute(
        "SELECT USER AS connected_user, SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') AS current_schema FROM dual"
      );
      const schema = ((schemaResult.rows || []) as Array<{ CONNECTED_USER: string; CURRENT_SCHEMA: string }>)[0];
      logDevelopmentAuth(`Connected Oracle user/schema: ${schema?.CONNECTED_USER || env.oracle.user}/${schema?.CURRENT_SCHEMA || "unknown"}`);
      logDevelopmentAuth(`Searched username: ${loginKey}`);
    }
    const authColumns = await getUserAuthColumns(connection);
    const usernameColumn = authColumns.usernameColumn;
    const idSelect = authColumns.hasId ? "id" : "ROWNUM AS id";
    const nameSelect = `${authColumns.nameColumn} AS full_name`;
    const emailSelect = authColumns.hasEmail ? "email" : `${usernameColumn.toLowerCase()} AS email`;
    const statusSelect = authColumns.hasStatus ? "status" : "'active' AS status";
    const passwordMustChangeSelect = authColumns.hasPasswordMustChange ? "password_must_change" : "0 AS password_must_change";
    const result = await connection.execute(
      `SELECT ${idSelect},
              ${nameSelect},
              ${usernameColumn.toLowerCase()} AS username,
              ${emailSelect},
              password_hash,
              role,
              ${statusSelect},
              ${passwordMustChangeSelect}
       FROM users
       WHERE LOWER(${usernameColumn.toLowerCase()}) = LOWER(:username)`,
      { username: input.email }
    );
    const row = ((result.rows || []) as OracleUserRow[])[0];
    if (!row) {
      logDevelopmentAuth("User found: false");
      throw new HttpError(401, "User not found");
    }

    const user = normalizeUser(row);
    logDevelopmentAuth("User found: true");
    logDevelopmentAuth(`Status: ${user.status}`);
    logDevelopmentAuth(`Role: ${user.role}`);

    if (user.status !== "active") {
      throw new HttpError(403, "Account disabled");
    }

    const storedPassword = user.passwordHash.trim();
    const bcryptValid = await bcrypt.compare(input.password, storedPassword).catch(() => false);
    const plainTextTestValid = env.nodeEnv !== "production" && input.password === storedPassword;
    const valid = bcryptValid || plainTextTestValid;
    logDevelopmentAuth(`bcryptValid: ${bcryptValid}`);
    logDevelopmentAuth(`plainTextTestValid: ${plainTextTestValid}`);
    if (!valid) {
      if (cooldownEnabled) {
        const current = failedLogins.get(loginKey) || { count: 0, lockedUntil: 0, cooldownLevel: 0 };
        const nextCount = current.count + 1;
        const failedLoginLimit = cooldownPolicy.failedLoginLimit;
        const fixedCooldownMinutes = cooldownPolicy.cooldownDurationMinutes;
        const maximumCooldownMinutes = Math.max(fixedCooldownMinutes, cooldownPolicy.maximumCooldownMinutes);
        const cooldownLevel = nextCount >= failedLoginLimit
          ? cooldownPolicy.escalatingCooldownEnabled
            ? Math.min(Math.max(current.cooldownLevel + 1, fixedCooldownMinutes), maximumCooldownMinutes)
            : fixedCooldownMinutes
          : current.cooldownLevel;
        const nextState: FailedLoginState = {
          count: nextCount,
          cooldownLevel,
          lockedUntil: nextCount >= failedLoginLimit ? Date.now() + cooldownLevel * 60 * 1000 : 0
        };
        failedLogins.set(loginKey, nextState);
        await writeAuditLog({ userId: user.id, action: "login_failed", details: `Failed login ${nextCount}/${failedLoginLimit} for ${user.username}.` }, connection);
        if (nextState.lockedUntil) {
          const details = cooldownDetails(nextState);
          throw new HttpError(429, details.message, details);
        }
        throw new HttpError(401, "Invalid credentials", {
          success: false,
          remainingSeconds: 0,
          lockedUntil: null,
          failedAttempts: nextState.count
        });
      }
      throw new HttpError(401, "Invalid credentials", {
        remainingSeconds: 0,
        lockedUntil: null,
        failedAttempts: 0
      });
    }

    failedLogins.delete(loginKey);
    return {
      token: signToken(user, settings.security.sessionTimeoutMinutes),
      user: { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role, forcePasswordChange: user.forcePasswordChange }
    };
  } finally {
    await connection.close();
  }
}
