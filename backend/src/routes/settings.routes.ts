import { Router } from "express";
import { getSettings, getSettingsAudit, getSettingsSystemHealth, postMaintenanceAction, postTestEmail, putSettings } from "../controllers/settings.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const settingsRouter = Router();

settingsRouter.get("/", requireAuth, requireRole("admin"), getSettings);
settingsRouter.put("/", requireAuth, requireRole("admin"), putSettings);
settingsRouter.post("/test-email", requireAuth, requireRole("admin"), postTestEmail);
settingsRouter.get("/system-health", requireAuth, requireRole("admin"), getSettingsSystemHealth);
settingsRouter.get("/audit", requireAuth, requireRole("admin"), getSettingsAudit);
settingsRouter.post("/maintenance", requireAuth, requireRole("admin"), postMaintenanceAction);
