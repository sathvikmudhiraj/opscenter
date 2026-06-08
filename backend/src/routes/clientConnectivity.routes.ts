import { Router } from "express";
import {
  getConnectivityClients,
  getConnectivityIncidents,
  getConnectivitySummary,
  listClientConnectivityHistory,
  listMyClientConnectivityHistory,
  postClientConnectivityHistory,
  postClientConnectivityReport
} from "../controllers/clientConnectivity.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const clientConnectivityRouter = Router();

clientConnectivityRouter.post("/history", requireAuth, postClientConnectivityHistory);
clientConnectivityRouter.post("/report", requireAuth, postClientConnectivityReport);
clientConnectivityRouter.get("/history", requireAuth, requireRole("admin"), listClientConnectivityHistory);
clientConnectivityRouter.get("/my-history", requireAuth, listMyClientConnectivityHistory);
clientConnectivityRouter.get("/summary", requireAuth, requireRole("admin"), getConnectivitySummary);
clientConnectivityRouter.get("/clients", requireAuth, requireRole("admin"), getConnectivityClients);
clientConnectivityRouter.get("/incidents", requireAuth, requireRole("admin"), getConnectivityIncidents);
