import { asyncHandler } from "../utils/asyncHandler";
import { mockStore } from "../services/mockStore";

export const getNotifications = asyncHandler(async (req, res) => {
  res.json({ data: mockStore.listNotifications({ userId: req.user!.sub }) });
});

export const getAuditLogs = asyncHandler(async (_req, res) => {
  res.json({ data: mockStore.listAuditLogs() });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  res.json({ message: "Notification marked read", data: mockStore.markNotificationRead({ id: Number(req.params.id), userId: req.user!.sub }) });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  mockStore.markAllNotificationsRead({ userId: req.user!.sub });
  res.json({ message: "Notifications marked read" });
});
