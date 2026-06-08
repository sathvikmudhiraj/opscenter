import { Router } from "express";
import {
  getClientAgentSummaryController,
  listClientAgentServiceHistory,
  listClientAgentServices,
  postClientAgentHeartbeat,
  postClientAgentServiceChecks
} from "../controllers/clientAgent.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const clientAgentRouter = Router();

clientAgentRouter.post("/heartbeat", postClientAgentHeartbeat);
clientAgentRouter.post("/service-checks", postClientAgentServiceChecks);
clientAgentRouter.get("/services", listClientAgentServices);
clientAgentRouter.get("/summary", requireAuth, requireRole("admin"), getClientAgentSummaryController);
clientAgentRouter.get("/service-history", requireAuth, requireRole("admin"), listClientAgentServiceHistory);
