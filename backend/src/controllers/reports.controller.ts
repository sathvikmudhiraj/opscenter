import { getAdminReports, getSlaReports } from "../services/reports.service";
import { asyncHandler } from "../utils/asyncHandler";

export const getReports = asyncHandler(async (_req, res) => {
  res.json({ data: await getAdminReports() });
});

export const getSlaReport = asyncHandler(async (_req, res) => {
  res.json({ data: await getSlaReports() });
});
