import { Router } from "express";
import { getUsers, patchUserRole, patchUserStatus, resetUserPassword } from "../controllers/users.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const usersRouter = Router();

usersRouter.get("/", requireAuth, requireRole("admin"), getUsers);
usersRouter.patch("/:id/role", requireAuth, requireRole("admin"), patchUserRole);
usersRouter.patch("/:id/status", requireAuth, requireRole("admin"), patchUserStatus);
usersRouter.post("/:id/reset-password", requireAuth, requireRole("admin"), resetUserPassword);
