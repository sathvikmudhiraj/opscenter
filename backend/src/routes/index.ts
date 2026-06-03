import { Router } from "express";
import { assetsRouter } from "./assets.routes";
import { authRouter } from "./auth.routes";
import { infrastructureRouter } from "./infrastructure.routes";
import { infrastructureServicesRouter } from "./infrastructureServices.routes";
import { notificationsRouter } from "./notifications.routes";
import { passwordResetRouter } from "./passwordReset.routes";
import { publicRouter } from "./public.routes";
import { reportsRouter } from "./reports.routes";
import { serviceHealthRouter } from "./serviceHealth.routes";
import { settingsRouter } from "./settings.routes";
import { ticketsRouter } from "./tickets.routes";
import { usersRouter } from "./users.routes";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => res.json({ status: "ok", service: "opscenter-api" }));
apiRouter.use("/auth", authRouter);
apiRouter.use("/tickets", ticketsRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/assets", assetsRouter);
apiRouter.use("/infrastructure", infrastructureRouter);
apiRouter.use("/infrastructure-services", infrastructureServicesRouter);
apiRouter.use("/notifications", notificationsRouter);
apiRouter.use("/password-resets", passwordResetRouter);
apiRouter.use("/public", publicRouter);
apiRouter.use("/reports", reportsRouter);
apiRouter.use("/service-health", serviceHealthRouter);
apiRouter.use("/settings", settingsRouter);
