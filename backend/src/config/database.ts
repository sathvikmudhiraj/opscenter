import oracledb from "oracledb";
import { env } from "./env";

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = false;

let pool: any = null;

export async function initializeDatabase() {
  if (pool) return pool;
  pool = await oracledb.createPool({
    user: env.oracle.user,
    password: env.oracle.password,
    connectString: env.oracle.connectString,
    poolMin: env.oracle.poolMin,
    poolMax: env.oracle.poolMax
  });
  return pool;
}

export async function getConnection() {
  const activePool = pool || (await initializeDatabase());
  return activePool.getConnection();
}

export async function closeDatabase() {
  if (pool) {
    await pool.close(10);
    pool = null;
  }
}
