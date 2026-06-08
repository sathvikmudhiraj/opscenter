import { Router } from "express";
import { getUsers, patchUser, patchUserRole, patchUserStatus, postUser, removeUser, resetUserPassword, unlockUserAccount } from "../controllers/users.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const usersRouter = Router();

usersRouter.get("/", requireAuth, requireRole("admin"), getUsers);
usersRouter.post("/", requireAuth, requireRole("admin"), postUser);
usersRouter.post("/unlock-account", requireAuth, requireRole("admin"), unlockUserAccount);
usersRouter.patch("/:id", requireAuth, requireRole("admin"), patchUser);
usersRouter.patch("/:id/role", requireAuth, requireRole("admin"), patchUserRole);
usersRouter.patch("/:id/status", requireAuth, requireRole("admin"), patchUserStatus);
usersRouter.post("/:id/reset-password", requireAuth, requireRole("admin"), resetUserPassword);
usersRouter.delete("/:id", requireAuth, requireRole("admin"), removeUser);
