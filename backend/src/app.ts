import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { apiRouter } from "./routes";

function skipGlobalRateLimit(req: express.Request) {
  const requestPath = (req.originalUrl || req.path || "").split("?")[0];
  if (req.method === "OPTIONS" || requestPath === "/api/notifications/events") return true;
  if (req.method === "GET" && (
    requestPath.startsWith("/api/infrastructure/") ||
    requestPath.startsWith("/infrastructure/") ||
    requestPath.startsWith("/api/service-health/") ||
    requestPath.startsWith("/service-health/")
  )) return true;
  return false;
}

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    skip: skipGlobalRateLimit,
    handler: (req, res) => {
      console.warn(`[rate-limit] ${req.method} ${req.originalUrl} exceeded request limit`);
      res.status(429).json({ message: `Too many requests for ${req.method} ${req.originalUrl}` });
    }
  }));

  app.use("/api", apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
