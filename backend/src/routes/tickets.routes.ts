import { Router } from "express";
import { assignTicket, escalateTicket, getTicket, getTickets, patchEngineerAction, patchTicketPriority, patchTicketStatus, postTicket } from "../controllers/tickets.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const ticketsRouter = Router();

ticketsRouter.get("/", requireAuth, getTickets);
ticketsRouter.post("/", requireAuth, requireRole("employee", "engineer", "admin"), postTicket);
ticketsRouter.get("/:id", requireAuth, getTicket);
ticketsRouter.patch("/:id/assign", requireAuth, requireRole("admin"), assignTicket);
ticketsRouter.patch("/:id/status", requireAuth, requireRole("engineer", "admin"), patchTicketStatus);
ticketsRouter.patch("/:id/priority", requireAuth, requireRole("admin"), patchTicketPriority);
ticketsRouter.patch("/:id/escalate", requireAuth, requireRole("engineer", "admin"), escalateTicket);
ticketsRouter.patch("/:id/engineer-action", requireAuth, requireRole("engineer", "admin"), patchEngineerAction);
