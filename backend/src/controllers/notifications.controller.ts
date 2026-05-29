import { asyncHandler } from "../utils/asyncHandler";
import { listAuditLogs, listNotifications, markAllNotificationsRead as markAllNotificationsReadService, markNotificationRead as markNotificationReadService } from "../services/notification.service";

export const getNotifications = asyncHandler(async (req, res) => {
  res.json({ data: await listNotifications({ userId: req.user!.sub }) });
});

export const getAuditLogs = asyncHandler(async (_req, res) => {
  res.json({ data: await listAuditLogs() });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  await markNotificationReadService({ id: Number(req.params.id), userId: req.user!.sub });
  res.json({ message: "Notification marked read" });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await markAllNotificationsReadService({ userId: req.user!.sub });
  res.json({ message: "Notifications marked read" });
});
