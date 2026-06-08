import bcrypt from "bcrypt";
import { closeDatabase, getConnection } from "../config/database";
import { env } from "../config/env";

const adminUsername = "admin";
const developmentPassword = "admin123";

async function resetAdminPassword() {
  if (env.nodeEnv === "production") {
    throw new Error("Admin password reset is disabled in production.");
  }

  const connection = await getConnection();
  try {
    const columnResult = await connection.execute(
      `SELECT column_name
       FROM user_tab_columns
       WHERE table_name = 'USERS'
         AND column_name IN ('USERNAME', 'PASSWORD_HASH', 'STATUS', 'PASSWORD_MUST_CHANGE')`
    );
    const columns = new Set(
      ((columnResult.rows || []) as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME)
    );

    for (const requiredColumn of ["USERNAME", "PASSWORD_HASH", "STATUS"]) {
      if (!columns.has(requiredColumn)) {
        throw new Error(`USERS table must include ${requiredColumn}.`);
      }
    }

    const passwordHash = await bcrypt.hash(developmentPassword, 12);
    const passwordMustChangeSql = columns.has("PASSWORD_MUST_CHANGE")
      ? ", password_must_change = 0"
      : "";
    const result = await connection.execute(
      `UPDATE users
       SET password_hash = :passwordHash,
           status = 'active'
           ${passwordMustChangeSql}
       WHERE LOWER(username) = :username`,
      { passwordHash, username: adminUsername }
    );

    if (result.rowsAffected !== 1) {
      throw new Error(`Expected one admin user, updated ${result.rowsAffected || 0}.`);
    }

    await connection.commit();
    console.log("Development admin password reset completed successfully.");
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

resetAdminPassword()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Admin password reset failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
