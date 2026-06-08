import { env } from "../config/env";
import {
  getClientAgentServices,
  getClientAgentServiceHistory,
  getClientAgentSummary,
  saveClientAgentHeartbeat,
  saveClientAgentServiceChecks
} from "../services/clientAgent.service";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";

function requireAgentToken(req: { headers: { authorization?: string } }) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  if (!env.clientAgentToken || token !== env.clientAgentToken) {
    throw new HttpError(401, "Invalid client agent token");
  }
}

export const postClientAgentHeartbeat = asyncHandler(async (req, res) => {
  requireAgentToken(req);
  res.status(201).json(await saveClientAgentHeartbeat(req.body || {}));
});

export const postClientAgentServiceChecks = asyncHandler(async (req, res) => {
  requireAgentToken(req);
  res.status(201).json(await saveClientAgentServiceChecks(req.body || {}));
});

export const listClientAgentServices = asyncHandler(async (req, res) => {
  requireAgentToken(req);
  res.json(await getClientAgentServices());
});

export const getClientAgentSummaryController = asyncHandler(async (_req, res) => {
  res.json(await getClientAgentSummary());
});

export const listClientAgentServiceHistory = asyncHandler(async (req, res) => {
  res.json(await getClientAgentServiceHistory(req.query));
});
