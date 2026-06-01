import { getAdminReports, getSlaReports, getTicketCategories, getSlaDistribution, getAssetStatus, getDepartmentDistribution, getEngineerPerformance } from "../services/reports.service";
import { asyncHandler } from "../utils/asyncHandler";

export const getReports = asyncHandler(async (_req, res) => {
  res.json({ data: await getAdminReports() });
});

export const getSlaReport = asyncHandler(async (_req, res) => {
  res.json({ data: await getSlaReports() });
});

export const getTicketCategoriesReport = asyncHandler(async (_req, res) => {
  res.json({ data: await getTicketCategories() });
});

export const getSlaDistributionReport = asyncHandler(async (_req, res) => {
  res.json({ data: await getSlaDistribution() });
});

export const getAssetStatusReport = asyncHandler(async (_req, res) => {
  res.json({ data: await getAssetStatus() });
});

export const getDepartmentDistributionReport = asyncHandler(async (_req, res) => {
  res.json({ data: await getDepartmentDistribution() });
});

export const getEngineerPerformanceReport = asyncHandler(async (_req, res) => {
  res.json({ data: await getEngineerPerformance() });
});