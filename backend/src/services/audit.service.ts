import { getConnection } from "../config/database";

export async function writeAuditLog(input: { userId?: number; action: string; details?: string }, connection?: any) {
  const activeConnection = connection || await getConnection();
  const shouldClose = !connection;
  try {
    const tableResult = await activeConnection.execute(
      `SELECT COUNT(*) AS count FROM user_tables WHERE table_name = 'AUDIT_LOGS'`
    );
    const exists = Number(((tableResult.rows || [])[0] as { COUNT?: number })?.COUNT || 0) > 0;
    if (!exists) return;

    await activeConnection.execute(
      `INSERT INTO audit_logs (user_id, action, details)
       VALUES (:userId, :action, :details)`,
      { userId: input.userId || null, action: input.action, details: input.details || null }
    );
    if (shouldClose) await activeConnection.commit();
  } catch (error) {
    if (shouldClose) await activeConnection.rollback();
    console.info(`[oracle] Audit log write failed: ${error instanceof Error ? error.message : "unknown error"}`);
  } finally {
    if (shouldClose) await activeConnection.close();
  }
}
