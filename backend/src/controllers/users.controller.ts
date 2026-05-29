import { z } from "zod";
import { createUser, deleteUser, listUsers, resetPassword, updateUser, updateUserRole, updateUserStatus } from "../services/user.service";
import { asyncHandler } from "../utils/asyncHandler";

const roleSchema = z.object({
  role: z.enum(["employee", "engineer", "admin"])
});

const statusSchema = z.object({
  status: z.enum(["active", "inactive", "disabled"])
});

const userSchema = z.object({
  fullName: z.string().min(2),
  username: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["employee", "engineer", "admin"]),
  department: z.string().optional(),
  employeeId: z.string().min(1),
  phone: z.string().optional(),
  status: z.enum(["active", "inactive", "disabled"]).default("active")
});

const userUpdateSchema = userSchema.omit({ password: true }).partial();

export const getUsers = asyncHandler(async (_req, res) => {
  res.json({ data: await listUsers() });
});

export const postUser = asyncHandler(async (req, res) => {
  const input = userSchema.parse(req.body);
  res.status(201).json({ message: "User created", data: await createUser({ ...input, actorId: req.user!.sub }) });
});

export const patchUser = asyncHandler(async (req, res) => {
  const input = userUpdateSchema.parse(req.body);
  await updateUser({ id: Number(req.params.id), ...input, actorId: req.user!.sub });
  res.json({ message: "User updated" });
});

export const patchUserRole = asyncHandler(async (req, res) => {
  const input = roleSchema.parse(req.body);
  await updateUserRole({ id: Number(req.params.id), role: input.role, actorId: req.user!.sub });
  res.json({ message: "User role updated" });
});

export const patchUserStatus = asyncHandler(async (req, res) => {
  const input = statusSchema.parse(req.body);
  await updateUserStatus({ id: Number(req.params.id), status: input.status, actorId: req.user!.sub });
  res.json({ message: "User status updated" });
});

export const resetUserPassword = asyncHandler(async (req, res) => {
  const result = await resetPassword({ id: Number(req.params.id), actorId: req.user!.sub });
  res.json({ message: "Password reset", data: result });
});

export const removeUser = asyncHandler(async (req, res) => {
  await deleteUser({ id: Number(req.params.id), actorId: req.user!.sub });
  res.json({ message: "User deleted" });
});
