import { Router } from "express";
import { changePassword, completeReset, generateResetPassword, getResetRequests, patchResetStatus, requestReset } from "../controllers/passwordReset.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const passwordResetRouter = Router();

passwordResetRouter.post("/request", requestReset);
passwordResetRouter.post("/change-password", requireAuth, changePassword);
passwordResetRouter.get("/", requireAuth, requireRole("admin"), getResetRequests);
passwordResetRouter.get("/generate", requireAuth, requireRole("admin"), generateResetPassword);
passwordResetRouter.patch("/:id/status", requireAuth, requireRole("admin"), patchResetStatus);
passwordResetRouter.post("/:id/complete", requireAuth, requireRole("admin"), completeReset);
