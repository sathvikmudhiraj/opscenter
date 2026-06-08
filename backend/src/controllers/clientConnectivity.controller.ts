import type { Request } from "express";
import {
  getClientConnectivityClients,
  getClientConnectivityHistory,
  getClientConnectivityIncidents,
  getClientConnectivitySummary,
  getMyClientConnectivityHistory,
  saveClientConnectivityHistory
} from "../services/clientConnectivity.service";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";

function requireUser(req: Request) {
  if (!req.user) throw new HttpError(401, "Authentication token required");
  return req.user;
}

function clientIpFromRequest(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0].trim();
  return req.ip;
}

export const postClientConnectivityHistory = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  res.status(201).json(await saveClientConnectivityHistory(req.body || {}, user, clientIpFromRequest(req)));
});

export const postClientConnectivityReport = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  res.status(201).json(await saveClientConnectivityHistory(
    { ...(req.body || {}), source: "OPSCENTER_AGENT", checkedFrom: req.body?.checkedFrom || "OpsCenter Agent" },
    user,
    clientIpFromRequest(req)
  ));
});

export const listClientConnectivityHistory = asyncHandler(async (req, res) => {
  res.json(await getClientConnectivityHistory(req.query));
});

export const listMyClientConnectivityHistory = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  res.json(await getMyClientConnectivityHistory(user, req.query));
});

export const getConnectivitySummary = asyncHandler(async (req, res) => {
  res.json(await getClientConnectivitySummary(req.query));
});

export const getConnectivityClients = asyncHandler(async (req, res) => {
  res.json(await getClientConnectivityClients(req.query));
});

export const getConnectivityIncidents = asyncHandler(async (req, res) => {
  res.json(await getClientConnectivityIncidents(req.query));
});
