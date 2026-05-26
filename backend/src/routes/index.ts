import { Router } from "express";
import { assetsRouter } from "./assets.routes";
import { authRouter } from "./auth.routes";
import { notificationsRouter } from "./notifications.routes";
import { ticketsRouter } from "./tickets.routes";
import { usersRouter } from "./users.routes";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => res.json({ status: "ok", service: "opscenter-api" }));
apiRouter.use("/auth", authRouter);
apiRouter.use("/tickets", ticketsRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/assets", assetsRouter);
apiRouter.use("/notifications", notificationsRouter);
