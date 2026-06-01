import { Router } from "express";
import { getReports, getSlaReport, getTicketCategoriesReport, getSlaDistributionReport, getAssetStatusReport, getDepartmentDistributionReport, getEngineerPerformanceReport } from "../controllers/reports.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const reportsRouter = Router();

reportsRouter.get("/", requireAuth, requireRole("admin"), getReports);
reportsRouter.get("/sla", requireAuth, requireRole("admin"), getSlaReport);
reportsRouter.get("/ticket-categories", requireAuth, requireRole("admin"), getTicketCategoriesReport);
reportsRouter.get("/sla-distribution", requireAuth, requireRole("admin"), getSlaDistributionReport);
reportsRouter.get("/asset-status", requireAuth, requireRole("admin"), getAssetStatusReport);
reportsRouter.get("/department-distribution", requireAuth, requireRole("admin"), getDepartmentDistributionReport);
reportsRouter.get("/engineer-performance", requireAuth, requireRole("admin"), getEngineerPerformanceReport);