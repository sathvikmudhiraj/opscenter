import { z } from "zod";
import { listUsers, updateUserRole } from "../services/user.service";
import { asyncHandler } from "../utils/asyncHandler";
import { mockStore } from "../services/mockStore";

const roleSchema = z.object({
  role: z.enum(["employee", "engineer", "admin"])
});

const statusSchema = z.object({
  status: z.enum(["active", "disabled"])
});

export const getUsers = asyncHandler(async (_req, res) => {
  res.json({ data: await listUsers() });
});

export const patchUserRole = asyncHandler(async (req, res) => {
  const input = roleSchema.parse(req.body);
  await updateUserRole({ id: Number(req.params.id), role: input.role, actorId: req.user!.sub });
  res.json({ message: "User role updated" });
});

export const patchUserStatus = asyncHandler(async (req, res) => {
  const input = statusSchema.parse(req.body);
  mockStore.updateUserStatus({ id: Number(req.params.id), status: input.status, actorId: req.user!.sub });
  res.json({ message: "User status updated" });
});

export const resetUserPassword = asyncHandler(async (req, res) => {
  mockStore.resetUserPassword({ id: Number(req.params.id), actorId: req.user!.sub });
  res.json({ message: "Password reset to Ops@12345" });
});
