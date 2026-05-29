import { getServiceHealth } from "../services/serviceHealth.service";
import { asyncHandler } from "../utils/asyncHandler";

export const getEnterpriseServiceHealth = asyncHandler(async (_req, res) => {
  res.json(await getServiceHealth());
});
