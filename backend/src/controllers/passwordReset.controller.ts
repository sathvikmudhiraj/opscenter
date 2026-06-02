import { z } from "zod";
import { changeOwnPassword, completePasswordReset, generateTemporaryPassword, listPasswordResetRequests, requestPasswordReset, updatePasswordResetStatus } from "../services/passwordReset.service";
import { asyncHandler } from "../utils/asyncHandler";

const requestSchema = z.object({ username: z.string().min(2) });
const statusSchema = z.object({ status: z.enum(["APPROVED", "REJECTED"]) });
const completeSchema = z.object({
  temporaryPassword: z.string().min(8),
  confirmPassword: z.string().min(8)
}).refine((value) => value.temporaryPassword === value.confirmPassword, { message: "Passwords must match", path: ["confirmPassword"] });
const changeSchema = z.object({
  currentPassword: z.string().min(5),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(8)
}).refine((value) => value.newPassword === value.confirmPassword, { message: "Passwords must match", path: ["confirmPassword"] });

export const requestReset = asyncHandler(async (req, res) => {
  const input = requestSchema.parse(req.body);
  await requestPasswordReset(input);
  res.status(201).json({ message: "Password reset request submitted" });
});

export const getResetRequests = asyncHandler(async (_req, res) => {
  res.json({ data: await listPasswordResetRequests() });
});

export const generateResetPassword = asyncHandler(async (_req, res) => {
  res.json({ data: { temporaryPassword: await generateTemporaryPassword() } });
});

export const patchResetStatus = asyncHandler(async (req, res) => {
  const input = statusSchema.parse(req.body);
  await updatePasswordResetStatus({ id: Number(req.params.id), status: input.status, actorId: req.user!.sub });
  res.json({ message: `Password reset request ${input.status.toLowerCase()}` });
});

export const completeReset = asyncHandler(async (req, res) => {
  const input = completeSchema.parse(req.body);
  await completePasswordReset({ id: Number(req.params.id), actorId: req.user!.sub, temporaryPassword: input.temporaryPassword });
  res.json({ message: "Password reset completed" });
});

export const changePassword = asyncHandler(async (req, res) => {
  const input = changeSchema.parse(req.body);
  await changeOwnPassword({ userId: req.user!.sub, currentPassword: input.currentPassword, newPassword: input.newPassword });
  res.json({ message: "Password changed" });
});
