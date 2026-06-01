import { getCurrentServiceHealth, getServiceHealth, getServiceHealthHistory } from "../services/serviceHealth.service";
import { asyncHandler } from "../utils/asyncHandler";

export const getEnterpriseServiceHealth = asyncHandler(async (_req, res) => {
  res.json(await getServiceHealth());
});

export const getCurrentEnterpriseServiceHealth = asyncHandler(async (_req, res) => {
  res.json(await getCurrentServiceHealth());
});

export const getEnterpriseServiceHealthHistory = asyncHandler(async (req, res) => {
  const range = req.query.range === "7d" || req.query.range === "30d" ? req.query.range : "24h";
  res.json(await getServiceHealthHistory(range));
});
