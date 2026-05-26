import { z } from "zod";
import { assignTicketToEngineer, createTicket, escalateTicketById, getTicketById, listTickets, saveEngineerAction, updateTicketPriority, updateTicketStatus } from "../services/ticket.service";
import { asyncHandler } from "../utils/asyncHandler";

const ticketSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  category: z.string().min(2),
  priority: z.enum(["low", "medium", "high", "critical"]),
  assetId: z.coerce.number().optional(),
  screenshotUrl: z.string().optional()
});

const assignSchema = z.object({
  engineerId: z.coerce.number().int().positive()
});

const statusSchema = z.object({
  status: z.enum(["open", "assigned", "in_progress", "waiting_for_parts", "escalated", "resolved", "closed"]),
  message: z.string().optional()
});

const prioritySchema = z.object({
  priority: z.enum(["low", "medium", "high", "critical"])
});

const engineerActionSchema = z.object({
  engineerNotes: z.string().optional(),
  rootCause: z.string().optional(),
  correctiveAction: z.string().optional(),
  preventiveAction: z.string().optional(),
  partsUsed: z.string().optional(),
  serviceImageUrl: z.string().optional(),
  status: z.enum(["open", "assigned", "in_progress", "waiting_for_parts", "escalated", "resolved", "closed"]),
  remarks: z.string().optional()
});

export const getTickets = asyncHandler(async (_req, res) => {
  res.json({ data: await listTickets() });
});

export const getTicket = asyncHandler(async (req, res) => {
  res.json({ data: await getTicketById(Number(req.params.id)) });
});

export const postTicket = asyncHandler(async (req, res) => {
  const input = ticketSchema.parse(req.body);
  const ticket = await createTicket({ ...input, requesterId: req.user!.sub });
  res.status(201).json({ message: "Ticket created", data: ticket });
});

export const assignTicket = asyncHandler(async (req, res) => {
  const input = assignSchema.parse(req.body);
  await assignTicketToEngineer({ ticketId: Number(req.params.id), engineerId: input.engineerId, adminId: req.user!.sub });
  res.json({ message: "Engineer assigned" });
});

export const patchTicketStatus = asyncHandler(async (req, res) => {
  const input = statusSchema.parse(req.body);
  await updateTicketStatus({ ticketId: Number(req.params.id), status: input.status, message: input.message, actorId: req.user!.sub });
  res.json({ message: "Ticket updated" });
});

export const patchTicketPriority = asyncHandler(async (req, res) => {
  const input = prioritySchema.parse(req.body);
  await updateTicketPriority({ ticketId: Number(req.params.id), priority: input.priority, actorId: req.user!.sub });
  res.json({ message: "Priority updated" });
});

export const escalateTicket = asyncHandler(async (req, res) => {
  await escalateTicketById({ ticketId: Number(req.params.id), actorId: req.user!.sub });
  res.json({ message: "Ticket escalated" });
});

export const patchEngineerAction = asyncHandler(async (req, res) => {
  const input = engineerActionSchema.parse(req.body);
  await saveEngineerAction({ ticketId: Number(req.params.id), actorId: req.user!.sub, ...input });
  res.json({ message: "Engineer action saved" });
});
