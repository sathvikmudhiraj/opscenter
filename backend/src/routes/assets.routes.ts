import { Router } from "express";
import { assignAsset, createAsset, decideAssetRequest, deleteAsset, getAssetRequests, getAssets, requestAsset, updateAsset } from "../controllers/assets.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const assetsRouter = Router();

assetsRouter.get("/", requireAuth, getAssets);
assetsRouter.post("/", requireAuth, requireRole("admin"), createAsset);
assetsRouter.patch("/:id", requireAuth, requireRole("admin"), updateAsset);
assetsRouter.patch("/:id/assign", requireAuth, requireRole("admin"), assignAsset);
assetsRouter.delete("/:id", requireAuth, requireRole("admin"), deleteAsset);
assetsRouter.get("/requests", requireAuth, requireRole("admin", "engineer"), getAssetRequests);
assetsRouter.post("/requests", requireAuth, requestAsset);
assetsRouter.patch("/requests/:id", requireAuth, requireRole("admin"), decideAssetRequest);
