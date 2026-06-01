import { Router } from "express";
import { getAuditLogs, getNotifications, getUnreadCount, markAllNotificationsRead, markNotificationRead, streamNotificationMetrics } from "../controllers/notifications.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const notificationsRouter = Router();

notificationsRouter.get("/", requireAuth, getNotifications);
notificationsRouter.get("/unread-count", requireAuth, getUnreadCount);
notificationsRouter.get("/events", requireAuth, streamNotificationMetrics);
notificationsRouter.patch("/read-all", requireAuth, markAllNotificationsRead);
notificationsRouter.patch("/:id/read", requireAuth, markNotificationRead);
notificationsRouter.get("/audit-logs", requireAuth, requireRole("admin"), getAuditLogs);
