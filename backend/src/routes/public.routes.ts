import { Router } from "express";
import { getPublicAsset } from "../controllers/public.controller";

export const publicRouter = Router();

publicRouter.get("/assets/:assetId", getPublicAsset);
