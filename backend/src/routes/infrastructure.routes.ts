import { Router } from "express";
import {
  getCurrentInfrastructure,
  getInfrastructureHeatmap,
  getInfrastructureHistory,
  getInfrastructureIncidents,
  getInfrastructureReports
} from "../controllers/infrastructure.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const infrastructureRouter = Router();

infrastructureRouter.get("/current", requireAuth, requireRole("admin"), getCurrentInfrastructure);
infrastructureRouter.get("/history", requireAuth, requireRole("admin"), getInfrastructureHistory);
infrastructureRouter.get("/heatmap", requireAuth, requireRole("admin"), getInfrastructureHeatmap);
infrastructureRouter.get("/incidents", requireAuth, requireRole("admin"), getInfrastructureIncidents);
infrastructureRouter.get("/reports", requireAuth, requireRole("admin"), getInfrastructureReports);
