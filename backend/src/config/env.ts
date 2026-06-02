import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 5000),
  host: process.env.HOST || "0.0.0.0",
  nodeEnv: process.env.NODE_ENV || "development",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  jwtSecret: process.env.JWT_SECRET || "dev-only-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  oracle: {
    user: process.env.ORACLE_USER || "OPSCENTER",
    password: process.env.ORACLE_PASSWORD || "change_me",
    connectString: process.env.ORACLE_CONNECT_STRING || "localhost:1521/XEPDB1",
    poolMin: Number(process.env.ORACLE_POOL_MIN || 1),
    poolMax: Number(process.env.ORACLE_POOL_MAX || 10)
  },
  serviceHealth: {
    hpepIntranetUrl: process.env.HPEP_INTRANET_URL || "https://hpepintranet.bhel.com",
    bhelWebmailUrl: process.env.BHEL_WEBMAIL_URL || "https://webmail.bhel.in"
  }
};
