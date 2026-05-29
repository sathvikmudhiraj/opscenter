import { Router } from "express";
import { bootstrap, createInitialAdmin, me, signIn, validateRole } from "../controllers/auth.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { isUserRole } from "../utils/roles";
import { HttpError } from "../utils/httpError";

export const authRouter = Router();

authRouter.get("/bootstrap", bootstrap);
authRouter.post("/setup-admin", createInitialAdmin);
authRouter.post("/login", signIn);
authRouter.get("/me", requireAuth, me);
authRouter.get("/validate/:role", requireAuth, (req, _res, next) => {
  const requestedRole = String(req.params.role);
  if (!isUserRole(requestedRole)) {
    throw new HttpError(400, "Invalid role");
  }
  return requireRole(requestedRole)(req, _res, next);
}, validateRole);
