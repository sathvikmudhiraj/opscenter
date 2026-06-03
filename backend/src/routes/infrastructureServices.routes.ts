import { Router } from "express";
import {
  listInfrastructureServices,
  postInfrastructureService,
  putInfrastructureService,
  removeInfrastructureService
} from "../controllers/infrastructureServices.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const infrastructureServicesRouter = Router();

infrastructureServicesRouter.get("/", requireAuth, requireRole("admin"), listInfrastructureServices);
infrastructureServicesRouter.post("/", requireAuth, requireRole("admin"), postInfrastructureService);
infrastructureServicesRouter.put("/:id", requireAuth, requireRole("admin"), putInfrastructureService);
infrastructureServicesRouter.delete("/:id", requireAuth, requireRole("admin"), removeInfrastructureService);
