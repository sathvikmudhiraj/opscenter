import { Router } from "express";
import { getReports, getSlaReport } from "../controllers/reports.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const reportsRouter = Router();

reportsRouter.get("/", requireAuth, requireRole("admin"), getReports);
reportsRouter.get("/sla", requireAuth, requireRole("admin"), getSlaReport);
