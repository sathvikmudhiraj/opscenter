import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import {
  getSettingsHistory,
  getSystemHealth,
  getSystemSettings,
  runMaintenanceAction,
  testEmailSettings,
  updateSystemSettings
} from "../services/settings.service";

const settingSections = new Set(["general", "sla", "notifications", "security", "assets", "email", "infrastructure", "audit", "maintenance"]);
const maintenanceActions = new Set(["record-backup", "clear-notifications", "clear-monitoring-history"]);

export const getSettings = asyncHandler(async (_req, res) => {
  res.json({ data: await getSystemSettings({ masked: true }) });
});

export const putSettings = asyncHandler(async (req, res) => {
  const section = req.body.section;
  if (section !== undefined && !settingSections.has(String(section))) {
    throw new HttpError(400, "Invalid settings section");
  }
  res.json({ data: await updateSystemSettings({ actorId: req.user!.sub, section, values: req.body.values ?? req.body }) });
});

export const postTestEmail = asyncHandler(async (req, res) => {
  res.json(await testEmailSettings({ actorId: req.user!.sub, recipient: req.body.recipient }));
});

export const getSettingsSystemHealth = asyncHandler(async (_req, res) => {
  res.json({ data: await getSystemHealth() });
});

export const getSettingsAudit = asyncHandler(async (_req, res) => {
  res.json({ data: await getSettingsHistory() });
});

export const postMaintenanceAction = asyncHandler(async (req, res) => {
  const action = String(req.body.action || "");
  if (!maintenanceActions.has(action)) {
    throw new HttpError(400, "Invalid maintenance action");
  }
  res.json(await runMaintenanceAction({ actorId: req.user!.sub, action }));
});
