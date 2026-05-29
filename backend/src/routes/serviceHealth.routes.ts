import { Router } from "express";
import { getEnterpriseServiceHealth } from "../controllers/serviceHealth.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const serviceHealthRouter = Router();

serviceHealthRouter.get("/", requireAuth, requireRole("admin"), getEnterpriseServiceHealth);
