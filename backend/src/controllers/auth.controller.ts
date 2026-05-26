import { z } from "zod";
import { login, setupAdmin, getBootstrapState } from "../services/auth.service";
import { asyncHandler } from "../utils/asyncHandler";

const credentialsSchema = z.object({
  email: z.string().min(2),
  password: z.string().min(5)
});

const setupSchema = credentialsSchema.extend({
  name: z.string().min(2).max(120)
});

export const bootstrap = asyncHandler(async (_req, res) => {
  res.json(await getBootstrapState());
});

export const createInitialAdmin = asyncHandler(async (req, res) => {
  const input = setupSchema.parse(req.body);
  res.status(201).json(await setupAdmin(input));
});

export const signIn = asyncHandler(async (req, res) => {
  const input = credentialsSchema.parse(req.body);
  res.json(await login(input));
});

export const validateRole = asyncHandler(async (req, res) => {
  res.json({ valid: true, user: req.user });
});
