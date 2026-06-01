import { asyncHandler } from "../utils/asyncHandler";
import { getUnreadNotificationCount, listAuditLogs, listNotifications, markAllNotificationsRead as markAllNotificationsReadService, markNotificationRead as markNotificationReadService, notificationEvents } from "../services/notification.service";

export const getNotifications = asyncHandler(async (req, res) => {
  res.json({ data: await listNotifications({ userId: req.user!.sub }) });
});

export const getUnreadCount = asyncHandler(async (_req, res) => {
  res.json({ unreadCount: await getUnreadNotificationCount() });
});

export const getAuditLogs = asyncHandler(async (_req, res) => {
  res.json({ data: await listAuditLogs() });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  await markNotificationReadService({ id: Number(req.params.id), userId: req.user!.sub });
  res.json({ message: "Notification marked read", unreadCount: await getUnreadNotificationCount() });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await markAllNotificationsReadService({ userId: req.user!.sub });
  res.json({ message: "Notifications marked read", unreadCount: await getUnreadNotificationCount() });
});

export const streamNotificationMetrics = asyncHandler(async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const sendCount = async () => {
    try {
      res.write(`event: unread-count\n`);
      res.write(`data: ${JSON.stringify({ unreadCount: await getUnreadNotificationCount() })}\n\n`);
    } catch {
      cleanup();
    }
  };
  const cleanup = () => {
    notificationEvents.off("changed", sendCount);
  };

  notificationEvents.on("changed", sendCount);
  req.on("close", cleanup);
  await sendCount();
});
