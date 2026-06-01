import {
  getInfrastructureCurrent,
  getInfrastructureHeatmap as getInfrastructureHeatmapService,
  getInfrastructureHistory as getInfrastructureHistoryService,
  getInfrastructureIncidents as getInfrastructureIncidentsService,
  getInfrastructureReports as getInfrastructureReportsService
} from "../services/serviceHealth.service";
import { asyncHandler } from "../utils/asyncHandler";

function rangeFromQuery(value: unknown) {
  return value === "7d" || value === "30d" ? value : "24h";
}

export const getCurrentInfrastructure = asyncHandler(async (_req, res) => {
  res.json(await getInfrastructureCurrent());
});

export const getInfrastructureHistory = asyncHandler(async (req, res) => {
  res.json(await getInfrastructureHistoryService(rangeFromQuery(req.query.range)));
});

export const getInfrastructureHeatmap = asyncHandler(async (req, res) => {
  res.json(await getInfrastructureHeatmapService(rangeFromQuery(req.query.range)));
});

export const getInfrastructureIncidents = asyncHandler(async (req, res) => {
  res.json(await getInfrastructureIncidentsService(rangeFromQuery(req.query.range)));
});

export const getInfrastructureReports = asyncHandler(async (req, res) => {
  res.json(await getInfrastructureReportsService(rangeFromQuery(req.query.range)));
});
