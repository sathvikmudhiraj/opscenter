import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { JwtPayload, UserRole } from "../types/auth";
import { HttpError } from "../utils/httpError";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const queryToken = typeof req.query.token === "string" ? req.query.token : null;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : queryToken;
  console.info(`[auth] Token ${token ? "received" : "missing"} for ${req.method} ${req.path}`);
  if (!token) throw new HttpError(401, "Authentication token required");

  try {
    req.user = jwt.verify(token, env.jwtSecret) as unknown as JwtPayload;
    console.info(`[auth] Token valid for user ${req.user.email}; role ${req.user.role}`);
    next();
  } catch (error) {
    console.info(`[auth] Token invalid for ${req.method} ${req.path}`);
    throw new HttpError(401, "Invalid or expired token");
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new HttpError(403, "Insufficient role permissions");
    }
    console.info(`[auth] Authenticated user role ${req.user.role} allowed for ${roles.join(",")}`);
    next();
  };
}
