import { getConnection } from "../config/database";
import { env } from "../config/env";
import { mockStore } from "./mockStore";

export async function listTickets() {
  if (env.dataMode === "mock") {
    return mockStore.listTickets();
  }

  const connection = await getConnection();
  try {
    const result = await connection.execute(
      `SELECT t.id, t.title, t.category, t.status, t.priority, t.created_at, t.updated_at,
              requester.name AS requester_name, requester.email AS requester_id,
              assignee.name AS assigned_to_name, assignee.email AS assigned_to_id,
              t.updated_at AS assigned_at,
              CASE
                WHEN t.priority = 'critical' THEN t.created_at + INTERVAL '1' HOUR
                WHEN t.priority = 'high' THEN t.created_at + INTERVAL '4' HOUR
                WHEN t.priority = 'medium' THEN t.created_at + INTERVAL '8' HOUR
                ELSE t.created_at + INTERVAL '24' HOUR
              END AS sla_deadline,
              CASE
                WHEN t.status IN ('resolved', 'closed') THEN 'Normal'
                WHEN CURRENT_TIMESTAMP >= CASE
                  WHEN t.priority = 'critical' THEN t.created_at + INTERVAL '1' HOUR
                  WHEN t.priority = 'high' THEN t.created_at + INTERVAL '4' HOUR
                  WHEN t.priority = 'medium' THEN t.created_at + INTERVAL '8' HOUR
                  ELSE t.created_at + INTERVAL '24' HOUR
                END THEN 'Breached'
                WHEN CURRENT_TIMESTAMP >= CASE
                  WHEN t.priority = 'critical' THEN t.created_at + INTERVAL '45' MINUTE
                  WHEN t.priority = 'high' THEN t.created_at + INTERVAL '3' HOUR
                  WHEN t.priority = 'medium' THEN t.created_at + INTERVAL '6' HOUR
                  ELSE t.created_at + INTERVAL '18' HOUR
                END THEN 'Warning'
                ELSE 'Normal'
              END AS sla_status,
              CASE
                WHEN t.status NOT IN ('resolved', 'closed') AND CURRENT_TIMESTAMP >= CASE
                  WHEN t.priority = 'critical' THEN t.created_at + INTERVAL '1' HOUR
                  WHEN t.priority = 'high' THEN t.created_at + INTERVAL '4' HOUR
                  WHEN t.priority = 'medium' THEN t.created_at + INTERVAL '8' HOUR
                  ELSE t.created_at + INTERVAL '24' HOUR
                END THEN 'high'
                WHEN t.status NOT IN ('resolved', 'closed') AND CURRENT_TIMESTAMP >= CASE
                  WHEN t.priority = 'critical' THEN t.created_at + INTERVAL '45' MINUTE
                  WHEN t.priority = 'high' THEN t.created_at + INTERVAL '3' HOUR
                  WHEN t.priority = 'medium' THEN t.created_at + INTERVAL '6' HOUR
                  ELSE t.created_at + INTERVAL '18' HOUR
                END THEN 'medium'
                ELSE 'low'
              END AS sla_risk
       FROM tickets t
       JOIN users requester ON requester.id = t.requester_id
       LEFT JOIN users assignee ON assignee.id = t.assigned_to
       ORDER BY t.created_at DESC`
    );
    return result.rows || [];
  } finally {
    await connection.close();
  }
}

export async function getTicketById(id: number) {
  if (env.dataMode === "mock") {
    return mockStore.getTicket(id);
  }

  const connection = await getConnection();
  try {
    const result = await connection.execute(
      `SELECT t.id, t.title, t.description, t.category, t.status, t.priority, t.created_at, t.updated_at,
              requester.name AS requester_name, requester.email AS requester_id,
              assignee.name AS assigned_to_name, assignee.email AS assigned_to_id,
              t.updated_at AS assigned_at,
              CASE
                WHEN t.priority = 'critical' THEN t.created_at + INTERVAL '1' HOUR
                WHEN t.priority = 'high' THEN t.created_at + INTERVAL '4' HOUR
                WHEN t.priority = 'medium' THEN t.created_at + INTERVAL '8' HOUR
                ELSE t.created_at + INTERVAL '24' HOUR
              END AS sla_deadline,
              CASE
                WHEN t.status IN ('resolved', 'closed') THEN 'Normal'
                WHEN CURRENT_TIMESTAMP >= CASE
                  WHEN t.priority = 'critical' THEN t.created_at + INTERVAL '1' HOUR
                  WHEN t.priority = 'high' THEN t.created_at + INTERVAL '4' HOUR
                  WHEN t.priority = 'medium' THEN t.created_at + INTERVAL '8' HOUR
                  ELSE t.created_at + INTERVAL '24' HOUR
                END THEN 'Breached'
                WHEN CURRENT_TIMESTAMP >= CASE
                  WHEN t.priority = 'critical' THEN t.created_at + INTERVAL '45' MINUTE
                  WHEN t.priority = 'high' THEN t.created_at + INTERVAL '3' HOUR
                  WHEN t.priority = 'medium' THEN t.created_at + INTERVAL '6' HOUR
                  ELSE t.created_at + INTERVAL '18' HOUR
                END THEN 'Warning'
                ELSE 'Normal'
              END AS sla_status,
              CASE
                WHEN t.status NOT IN ('resolved', 'closed') AND CURRENT_TIMESTAMP >= CASE
                  WHEN t.priority = 'critical' THEN t.created_at + INTERVAL '1' HOUR
                  WHEN t.priority = 'high' THEN t.created_at + INTERVAL '4' HOUR
                  WHEN t.priority = 'medium' THEN t.created_at + INTERVAL '8' HOUR
                  ELSE t.created_at + INTERVAL '24' HOUR
                END THEN 'high'
                WHEN t.status NOT IN ('resolved', 'closed') AND CURRENT_TIMESTAMP >= CASE
                  WHEN t.priority = 'critical' THEN t.created_at + INTERVAL '45' MINUTE
                  WHEN t.priority = 'high' THEN t.created_at + INTERVAL '3' HOUR
                  WHEN t.priority = 'medium' THEN t.created_at + INTERVAL '6' HOUR
                  ELSE t.created_at + INTERVAL '18' HOUR
                END THEN 'medium'
                ELSE 'low'
              END AS sla_risk
       FROM tickets t
       JOIN users requester ON requester.id = t.requester_id
       LEFT JOIN users assignee ON assignee.id = t.assigned_to
       WHERE t.id = :id`,
      { id }
    );
    return result.rows?.[0] || null;
  } finally {
    await connection.close();
  }
}

export async function createTicket(input: { title: string; description?: string; category: string; priority: string; requesterId: number; assetId?: number; screenshotUrl?: string }) {
  if (env.dataMode === "mock") {
    return mockStore.createTicket(input);
  }

  const connection = await getConnection();
  try {
    await connection.execute(
      `INSERT INTO tickets (title, description, category, priority, requester_id, status)
       VALUES (:title, :description, :category, :priority, :requesterId, 'open')`,
      input
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

export async function updateTicketPriority(input: { ticketId: number; priority: string; actorId: number }) {
  if (env.dataMode === "mock") {
    mockStore.updatePriority(input);
    return;
  }
}

export async function escalateTicketById(input: { ticketId: number; actorId: number }) {
  if (env.dataMode === "mock") {
    mockStore.escalateTicket(input);
    return;
  }
}

export async function saveEngineerAction(input: {
  ticketId: number;
  actorId: number;
  engineerNotes?: string;
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  partsUsed?: string;
  serviceImageUrl?: string;
  status: string;
  remarks?: string;
}) {
  if (env.dataMode === "mock") {
    mockStore.engineerAction(input);
    return;
  }
}

export async function assignTicketToEngineer(input: { ticketId: number; engineerId: number; adminId: number }) {
  if (env.dataMode === "mock") {
    mockStore.assignTicketToEngineer(input);
    return;
  }

  const connection = await getConnection();
  try {
    await connection.execute(
      `UPDATE tickets
       SET assigned_to = :engineerId, status = 'in_progress', updated_at = CURRENT_TIMESTAMP
       WHERE id = :ticketId`,
      { ticketId: input.ticketId, engineerId: input.engineerId }
    );
    await connection.execute(
      `INSERT INTO ticket_updates (ticket_id, author_id, message, status_from, status_to)
       VALUES (:ticketId, :adminId, 'Engineer assigned', NULL, 'in_progress')`,
      input
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

export async function updateTicketStatus(input: { ticketId: number; status: string; message?: string; actorId: number }) {
  if (env.dataMode === "mock") {
    mockStore.updateTicketStatus(input);
    return;
  }

  const connection = await getConnection();
  try {
    await connection.execute(
      `UPDATE tickets
       SET status = :status, updated_at = CURRENT_TIMESTAMP
       WHERE id = :ticketId`,
      { ticketId: input.ticketId, status: input.status }
    );
    await connection.execute(
      `INSERT INTO ticket_updates (ticket_id, author_id, message, status_from, status_to)
       VALUES (:ticketId, :actorId, :message, NULL, :status)`,
      { ...input, message: input.message || `Status changed to ${input.status}` }
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}
