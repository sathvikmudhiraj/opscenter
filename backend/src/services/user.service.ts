import { getConnection } from "../config/database";
import { env } from "../config/env";
import type { UserRole } from "../types/auth";
import { mockStore } from "./mockStore";

export async function listUsers() {
  if (env.dataMode === "mock") {
    return mockStore.listUsers();
  }

  const connection = await getConnection();
  try {
    const result = await connection.execute(
      `SELECT id, name, email AS login_id, role, status
       FROM users
       ORDER BY role, name`
    );
    return ((result.rows || []) as Array<{ ID: number; NAME: string; LOGIN_ID: string; ROLE: UserRole; STATUS: string }>).map((user) => ({
      id: user.ID,
      name: user.NAME,
      loginId: user.LOGIN_ID,
      role: user.ROLE,
      status: user.STATUS
    }));
  } finally {
    await connection.close();
  }
}

export async function updateUserRole(input: { id: number; role: UserRole; actorId?: number }) {
  if (env.dataMode === "mock") {
    return mockStore.updateUserRole(input);
  }

  const connection = await getConnection();
  try {
    await connection.execute(
      `UPDATE users
       SET role = :role, updated_at = CURRENT_TIMESTAMP
       WHERE id = :id`,
      { id: input.id, role: input.role }
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}
