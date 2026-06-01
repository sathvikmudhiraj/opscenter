import { Router } from "express";
import { getCurrentEnterpriseServiceHealth, getEnterpriseServiceHealth, getEnterpriseServiceHealthHistory } from "../controllers/serviceHealth.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const serviceHealthRouter = Router();

serviceHealthRouter.get("/", requireAuth, requireRole("admin"), getEnterpriseServiceHealth);
serviceHealthRouter.get("/current", requireAuth, requireRole("admin"), getCurrentEnterpriseServiceHealth);
serviceHealthRouter.get("/history", requireAuth, requireRole("admin"), getEnterpriseServiceHealthHistory);
