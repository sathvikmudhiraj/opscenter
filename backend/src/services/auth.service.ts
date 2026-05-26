import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import oracledb from "oracledb";
import { getConnection } from "../config/database";
import { env } from "../config/env";
import type { UserRole } from "../types/auth";
import { mockStore } from "./mockStore";
import { HttpError } from "../utils/httpError";

type UserRow = {
  ID: number;
  NAME: string;
  EMAIL: string;
  PASSWORD_HASH: string;
  ROLE: UserRole;
  STATUS: string;
};

function signToken(user: Pick<UserRow, "ID" | "EMAIL" | "ROLE">) {
  const options: SignOptions = { expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"] };
  return jwt.sign({ sub: user.ID, email: user.EMAIL, role: user.ROLE }, env.jwtSecret, options);
}

export async function getBootstrapState() {
  if (env.dataMode === "mock") {
    return { setupRequired: !mockStore.hasUsers(), mode: "mock" };
  }

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
  if (env.dataMode === "mock") {
    const user = await mockStore.createFirstAdmin(input);
    return {
      token: signToken({ ID: user.id, EMAIL: user.email, ROLE: user.role }),
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    };
  }

  const connection = await getConnection();
  try {
    const countResult = await connection.execute("SELECT COUNT(*) AS count FROM users");
    const countRows = (countResult.rows || []) as Array<{ COUNT: number }>;
    if ((countRows[0]?.COUNT || 0) > 0) {
      throw new HttpError(409, "Initial admin setup has already been completed");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const result = await connection.execute(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES (:name, LOWER(:email), :passwordHash, 'admin', 'active')
       RETURNING id INTO :id`,
      {
        name: input.name,
        email: input.email,
        passwordHash,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );
    await connection.commit();
    const id = Number(result.outBinds?.id?.[0]);
    const user = { id, name: input.name, email: input.email.toLowerCase(), role: "admin" as const };
    return { token: signToken({ ID: id, EMAIL: user.email, ROLE: user.role }), user };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

export async function login(input: { email: string; password: string }) {
  if (env.dataMode === "mock") {
    const user = await mockStore.findActiveUserByCredentials(input);
    if (!user) throw new HttpError(401, "Invalid credentials");
    return {
      token: signToken({ ID: user.id, EMAIL: user.email, ROLE: user.role }),
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    };
  }

  const connection = await getConnection();
  try {
    const result = await connection.execute(
      `SELECT id, name, email, password_hash, role, status
       FROM users
       WHERE email = LOWER(:email)`,
      { email: input.email }
    );
    const rows = (result.rows || []) as UserRow[];
    const user = rows[0];
    if (!user || user.STATUS !== "active") throw new HttpError(401, "Invalid credentials");
    const valid = await bcrypt.compare(input.password, user.PASSWORD_HASH);
    if (!valid) throw new HttpError(401, "Invalid credentials");
    return {
      token: signToken(user),
      user: { id: user.ID, name: user.NAME, email: user.EMAIL, role: user.ROLE }
    };
  } finally {
    await connection.close();
  }
}
