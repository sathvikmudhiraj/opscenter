import oracledb from "oracledb";
import { getConnection } from "../config/database";
import { writeAuditLog } from "./audit.service";
import { createNotification, notifyAdmins } from "./notification.service";

type AssetInput = {
  assetTag: string;
  assetName: string;
  category: string;
  type: string;
  status: string;
  brand: string;
  model: string;
  serialNumber: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  department: string;
  block: string;
  room: string;
  assignedTo?: number | null;
  lifecycleState?: string;
  processor?: string;
  ram?: string;
  storage?: string;
  operatingSystem?: string;
};

type AssetColumnInfo = {
  columns: Set<string>;
  assignedColumn?: "assigned_employee" | "assigned_to" | "assigned_user";
};

function assetLocation(input: { department?: string; block?: string; room?: string }) {
  return [input.department, input.block ? `Block ${input.block}` : "", input.room ? `Room ${input.room}` : ""].filter(Boolean).join(" / ");
}

async function getAssetColumns(connection: any): Promise<AssetColumnInfo> {
  const result = await connection.execute(
    `SELECT column_name FROM user_tab_columns WHERE table_name = 'ASSETS'`
  );
  const columns = new Set(((result.rows || []) as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME));
  return {
    columns,
    assignedColumn: columns.has("ASSIGNED_EMPLOYEE") ? "assigned_employee" : columns.has("ASSIGNED_TO") ? "assigned_to" : columns.has("ASSIGNED_USER") ? "assigned_user" : undefined
  };
}

async function getUserColumns(connection: any) {
  const result = await connection.execute(
    `SELECT column_name FROM user_tab_columns WHERE table_name = 'USERS'`
  );
  const columns = new Set(((result.rows || []) as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME));
  return {
    columns,
    usernameColumn: columns.has("USERNAME") ? "username" : columns.has("EMAIL") ? "email" : "login_id",
    nameExpression: columns.has("FULL_NAME") ? "full_name" : columns.has("NAME") ? "name" : columns.has("USERNAME") ? "username" : columns.has("EMAIL") ? "email" : "login_id"
  };
}

function userColumnSelect(columns: Set<string>, alias: string, column: string, fallback = "NULL") {
  return columns.has(column.toUpperCase()) ? `${alias}.${column}` : fallback;
}

function statusFromLifecycle(value?: string) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "assigned") return "assigned";
  if (normalized === "under repair" || normalized === "repair") return "repair";
  if (normalized === "retired") return "retired";
  return "available";
}

function lifecycleFromStatus(status?: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "assigned") return "Assigned";
  if (normalized === "repair" || normalized === "under repair") return "Under Repair";
  if (normalized === "retired") return "Retired";
  return "Available";
}

function normalizeAsset(row: any) {
  return {
    id: row.ID,
    assetTag: row.ASSET_TAG,
    assetName: row.ASSET_NAME,
    category: row.CATEGORY,
    type: row.TYPE || row.CATEGORY,
    status: row.STATUS || statusFromLifecycle(row.LIFECYCLE_STATE),
    brand: row.BRAND || "",
    model: row.MODEL || "",
    serialNumber: row.SERIAL_NUMBER || "",
    purchaseDate: row.PURCHASE_DATE,
    warrantyExpiry: row.WARRANTY_EXPIRY,
    department: row.DEPARTMENT || "",
    block: row.BLOCK || "",
    room: row.ROOM || "",
    location: row.LOCATION || "",
    assignedTo: row.ASSIGNED_EMPLOYEE ?? row.ASSIGNED_TO ?? row.ASSIGNED_USER ?? null,
    assignedToName: row.ASSIGNED_TO_NAME || "",
    assignedToLogin: row.ASSIGNED_TO_LOGIN || "",
    processor: row.PROCESSOR || "",
    ram: row.RAM || "",
    storage: row.STORAGE || "",
    operatingSystem: row.OPERATING_SYSTEM || "",
    lifecycleState: row.LIFECYCLE_STATE || lifecycleFromStatus(row.STATUS),
    updatedAt: row.UPDATED_AT,
    createdAt: row.CREATED_AT
  };
}

function selectIf(columns: Set<string>, column: string, fallback = "NULL") {
  return columns.has(column.toUpperCase()) ? `a.${column}` : `${fallback} AS ${column}`;
}

export async function listAssets() {
  const connection = await getConnection();
  try {
    const assetColumns = await getAssetColumns(connection);
    const userColumns = await getUserColumns(connection);
    const assignedSelect = assetColumns.assignedColumn ? `a.${assetColumns.assignedColumn}` : "NULL";
    const assignedJoin = assetColumns.assignedColumn ? `LEFT JOIN users u ON u.id = a.${assetColumns.assignedColumn}` : "";
    const result = await connection.execute(
      `SELECT a.id,
              a.asset_tag,
              a.asset_name,
              a.category,
              ${selectIf(assetColumns.columns, "type", "a.category")},
              a.status,
              ${selectIf(assetColumns.columns, "brand")},
              ${selectIf(assetColumns.columns, "model")},
              ${selectIf(assetColumns.columns, "serial_number")},
              ${selectIf(assetColumns.columns, "purchase_date")},
              ${selectIf(assetColumns.columns, "warranty_expiry")},
              ${selectIf(assetColumns.columns, "department")},
              ${selectIf(assetColumns.columns, "block")},
              ${selectIf(assetColumns.columns, "room")},
              ${selectIf(assetColumns.columns, "location")},
              ${assignedSelect} AS assigned_to,
              ${selectIf(assetColumns.columns, "processor")},
              ${selectIf(assetColumns.columns, "ram")},
              ${selectIf(assetColumns.columns, "storage")},
              ${selectIf(assetColumns.columns, "operating_system")},
              ${selectIf(assetColumns.columns, "lifecycle_state")},
              ${selectIf(assetColumns.columns, "updated_at", "a.created_at")},
              a.created_at,
              ${assetColumns.assignedColumn ? `u.${userColumns.nameExpression}` : "NULL"} AS assigned_to_name,
              ${assetColumns.assignedColumn ? `u.${userColumns.usernameColumn}` : "NULL"} AS assigned_to_login
       FROM assets a
       ${assignedJoin}
       ORDER BY a.created_at DESC, a.asset_tag`
    );
    console.info("[oracle] Assets query success");
    return ((result.rows || []) as Array<any>).map(normalizeAsset);
  } catch (error) {
    console.info(`[oracle] Assets query failed: ${error instanceof Error ? error.message : "unknown error"}`);
    throw error;
  } finally {
    await connection.close();
  }
}

export async function createAsset(input: AssetInput & { actorId: number }) {
  const connection = await getConnection();
  try {
    const assetColumns = await getAssetColumns(connection);
    const location = assetLocation(input);
    const values: Array<[string, string, unknown]> = [
      ["asset_tag", "assetTag", input.assetTag],
      ["asset_name", "assetName", input.assetName],
      ["category", "category", input.category],
      ["status", "status", input.status || statusFromLifecycle(input.lifecycleState)]
    ];

    const optionalValues: Array<[string, string, unknown]> = [
      ["type", "type", input.type],
      ["brand", "brand", input.brand],
      ["model", "model", input.model],
      ["serial_number", "serialNumber", input.serialNumber],
      ["department", "department", input.department],
      ["block", "block", input.block],
      ["room", "room", input.room],
      ["location", "location", location],
      ["processor", "processor", input.processor || null],
      ["ram", "ram", input.ram || null],
      ["storage", "storage", input.storage || null],
      ["operating_system", "operatingSystem", input.operatingSystem || null]
    ];
    if (assetColumns.columns.has("LIFECYCLE_STATE")) optionalValues.push(["lifecycle_state", "lifecycleState", input.lifecycleState || lifecycleFromStatus(input.status)]);
    if (assetColumns.columns.has("UPDATED_AT")) optionalValues.push(["updated_at", "updatedAt", new Date()]);

    for (const value of optionalValues) {
      if (assetColumns.columns.has(value[0].toUpperCase())) values.push(value);
    }

    if (assetColumns.assignedColumn) {
      values.push([assetColumns.assignedColumn, "assignedTo", input.assignedTo || null]);
    }

    const dateValues: Array<[string, string]> = [];
    const binds = Object.fromEntries(values.map(([, bind, value]) => [bind, value])) as Record<string, unknown>;
    if (assetColumns.columns.has("PURCHASE_DATE")) {
      binds.purchaseDateValue = input.purchaseDate || null;
      dateValues.push(["purchase_date", "CASE WHEN :purchaseDateValue IS NULL THEN NULL ELSE TO_DATE(:purchaseDateValue, 'YYYY-MM-DD') END"]);
    }
    if (assetColumns.columns.has("WARRANTY_EXPIRY")) {
      binds.warrantyExpiryValue = input.warrantyExpiry || null;
      dateValues.push(["warranty_expiry", "CASE WHEN :warrantyExpiryValue IS NULL THEN NULL ELSE TO_DATE(:warrantyExpiryValue, 'YYYY-MM-DD') END"]);
    }

    binds.id = { dir: oracledb.BIND_OUT, type: oracledb.NUMBER };

    const sql = `INSERT INTO assets (${[...values.map(([column]) => column), ...dateValues.map(([column]) => column)].join(", ")})
       VALUES (${[...values.map(([, bind]) => `:${bind}`), ...dateValues.map(([, expression]) => expression)].join(", ")})
       RETURNING id INTO :id`;

    console.info("[oracle] Asset insert columns", [...values.map(([column]) => column), ...dateValues.map(([column]) => column)].join(", "));
    const result = await connection.execute(sql, binds);
    await writeAuditLog({ userId: input.actorId, action: "asset_created", details: `${input.assetTag} created.` }, connection);
    await connection.commit();
    console.info("[oracle] Asset insert success");
    return { id: Number(result.outBinds?.id?.[0]), ...input, location };
  } catch (error) {
    await connection.rollback();
    console.info(`[oracle] Asset insert failed: ${error instanceof Error ? error.message : "unknown error"}`);
    throw error;
  } finally {
    await connection.close();
  }
}

export async function updateAsset(input: Partial<AssetInput> & { id: number; actorId: number }) {
  const connection = await getConnection();
  try {
    const assetColumns = await getAssetColumns(connection);
    const location = assetLocation(input);
    const updates: string[] = [];
    const binds: Record<string, unknown> = { id: input.id };
    const candidates: Array<[string, string, unknown]> = [
      ["asset_tag", "assetTag", input.assetTag],
      ["asset_name", "assetName", input.assetName],
      ["category", "category", input.category],
      ["type", "type", input.type],
      ["brand", "brand", input.brand],
      ["model", "model", input.model],
      ["serial_number", "serialNumber", input.serialNumber],
      ["status", "status", input.status],
      ["lifecycle_state", "lifecycleState", input.lifecycleState || (input.status ? lifecycleFromStatus(input.status) : undefined)],
      ["department", "department", input.department],
      ["block", "block", input.block],
      ["room", "room", input.room],
      ["location", "location", location],
      ["processor", "processor", input.processor],
      ["ram", "ram", input.ram],
      ["storage", "storage", input.storage],
      ["operating_system", "operatingSystem", input.operatingSystem]
    ];

    for (const [column, bind, value] of candidates) {
      if (assetColumns.columns.has(column.toUpperCase()) && value !== undefined) {
        updates.push(`${column} = :${bind}`);
        binds[bind] = value;
      }
    }
    if (assetColumns.assignedColumn && input.assignedTo !== undefined) {
      updates.push(`${assetColumns.assignedColumn} = :assignedTo`);
      binds.assignedTo = input.assignedTo;
    }
    if (assetColumns.columns.has("PURCHASE_DATE") && input.purchaseDate !== undefined) {
      updates.push("purchase_date = CASE WHEN :purchaseDateValue IS NULL THEN NULL ELSE TO_DATE(:purchaseDateValue, 'YYYY-MM-DD') END");
      binds.purchaseDateValue = input.purchaseDate || null;
    }
    if (assetColumns.columns.has("WARRANTY_EXPIRY") && input.warrantyExpiry !== undefined) {
      updates.push("warranty_expiry = CASE WHEN :warrantyExpiryValue IS NULL THEN NULL ELSE TO_DATE(:warrantyExpiryValue, 'YYYY-MM-DD') END");
      binds.warrantyExpiryValue = input.warrantyExpiry || null;
    }
    if (assetColumns.columns.has("UPDATED_AT")) updates.push("updated_at = CURRENT_TIMESTAMP");

    if (updates.length) {
      await connection.execute(`UPDATE assets SET ${updates.join(", ")} WHERE id = :id`, binds);
      await writeAuditLog({ userId: input.actorId, action: "asset_updated", details: `Asset #${input.id} updated.` }, connection);
      await connection.commit();
    }
  } catch (error) {
    await connection.rollback();
    console.info(`[oracle] Asset update failed: ${error instanceof Error ? error.message : "unknown error"}`);
    throw error;
  } finally {
    await connection.close();
  }
}

export async function assignAsset(input: { id: number; employeeId: number; actorId: number }) {
  const connection = await getConnection();
  try {
    const assetColumns = await getAssetColumns(connection);
    if (!assetColumns.assignedColumn) return;
    await connection.execute(
      `UPDATE assets
       SET ${assetColumns.assignedColumn} = :employeeId, status = 'assigned'${assetColumns.columns.has("LIFECYCLE_STATE") ? ", lifecycle_state = 'Assigned'" : ""}${assetColumns.columns.has("UPDATED_AT") ? ", updated_at = CURRENT_TIMESTAMP" : ""}
       WHERE id = :id`,
      { id: input.id, employeeId: input.employeeId }
    );
    await createNotification({ userId: input.employeeId, title: "Asset assigned", body: `Asset #${input.id} has been assigned to you.` }, connection);
    await writeAuditLog({ userId: input.actorId, action: "asset_assigned", details: `Asset #${input.id} assigned to user #${input.employeeId}.` }, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.info(`[oracle] Asset assignment failed: ${error instanceof Error ? error.message : "unknown error"}`);
    throw error;
  } finally {
    await connection.close();
  }
}

export async function deleteAsset(input: { id: number; actorId: number }) {
  const connection = await getConnection();
  try {
    const result = await connection.execute(`SELECT asset_tag FROM assets WHERE id = :id`, { id: input.id });
    const asset = (result.rows || [])[0] as { ASSET_TAG?: string } | undefined;
    await connection.execute(`DELETE FROM assets WHERE id = :id`, { id: input.id });
    await writeAuditLog({ userId: input.actorId, action: "asset_deleted", details: `${asset?.ASSET_TAG || `Asset #${input.id}`} deleted.` }, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.info(`[oracle] Asset delete failed: ${error instanceof Error ? error.message : "unknown error"}`);
    throw error;
  } finally {
    await connection.close();
  }
}

export async function listAssetRequests() {
  const connection = await getConnection();
  try {
    const requestTable = await connection.execute(`SELECT column_name FROM user_tab_columns WHERE table_name = 'ASSET_REQUESTS'`);
    const columns = new Set(((requestTable.rows || []) as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME));
    if (!columns.size) return [];
    const userColumns = await getUserColumns(connection);
    const requesterColumn = columns.has("REQUESTER_ID") ? "requester_id" : "employee_id";
    const assetColumn = columns.has("ASSET_TYPE") ? "asset_type" : "asset_name";
    const justificationSelect = columns.has("JUSTIFICATION") ? "ar.justification" : "NULL AS justification";
    const approvedByJoin = columns.has("APPROVED_BY") ? `LEFT JOIN users approver ON approver.id = ar.approved_by` : "";
    const approvedByNameSelect = columns.has("APPROVED_BY") ? `approver.${userColumns.nameExpression}` : "NULL";
    const approvedByLoginSelect = columns.has("APPROVED_BY") ? `approver.${userColumns.usernameColumn}` : "NULL";
    const result = await connection.execute(
      `SELECT ar.id, ar.${requesterColumn} AS requester_id,
              requester.${userColumns.nameExpression} AS requester_name,
              requester.${userColumns.usernameColumn} AS requester_login,
              ${userColumnSelect(userColumns.columns, "requester", "employee_id", "TO_CHAR(requester.id)")} AS requester_employee_id,
              ${userColumnSelect(userColumns.columns, "requester", "role", "'employee'")} AS requester_role,
              ${userColumnSelect(userColumns.columns, "requester", "department")} AS requester_department,
              ar.${assetColumn} AS asset_type,
              ${justificationSelect},
              ar.status,
              ar.created_at,
              ${approvedByNameSelect} AS approved_by_name,
              ${approvedByLoginSelect} AS decided_by_login
       FROM asset_requests ar
       LEFT JOIN users requester ON requester.id = ar.${requesterColumn}
       ${approvedByJoin}
       ORDER BY ar.created_at DESC`
    );
    return ((result.rows || []) as Array<any>).map((row) => ({
      id: row.ID,
      requesterId: row.REQUESTER_ID,
      requesterName: row.REQUESTER_NAME || "Unknown",
      requesterLogin: row.REQUESTER_LOGIN || "",
      requesterFullName: row.REQUESTER_NAME || row.REQUESTER_LOGIN || "Unknown",
      requesterEmployeeId: row.REQUESTER_EMPLOYEE_ID || String(row.REQUESTER_ID || ""),
      requesterRole: row.REQUESTER_ROLE || "employee",
      requesterDepartment: row.REQUESTER_DEPARTMENT || "Unassigned",
      department: row.REQUESTER_DEPARTMENT || "Unassigned",
      assetType: row.ASSET_TYPE || "Asset",
      justification: row.JUSTIFICATION || "No justification provided.",
      status: row.STATUS || "pending",
      requestedAt: row.CREATED_AT,
      createdAt: row.CREATED_AT,
      approvedBy: row.APPROVED_BY_NAME || row.DECIDED_BY_LOGIN || "",
      decidedByLogin: row.DECIDED_BY_LOGIN || ""
    }));
  } catch (error) {
    console.info(`[oracle] Asset request query failed: ${error instanceof Error ? error.message : "unknown error"}`);
    throw error;
  } finally {
    await connection.close();
  }
}

export async function createAssetRequest(input: { requesterId: number; assetType?: string; justification?: string }) {
  const connection = await getConnection();
  try {
    const requestTable = await connection.execute(`SELECT column_name FROM user_tab_columns WHERE table_name = 'ASSET_REQUESTS'`);
    const columns = new Set(((requestTable.rows || []) as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME));
    if (columns.size) {
      const requesterColumn = columns.has("REQUESTER_ID") ? "requester_id" : "employee_id";
      const assetColumn = columns.has("ASSET_TYPE") ? "asset_type" : "asset_name";
      const values: Array<[string, string, unknown]> = [
        [requesterColumn, "requesterId", input.requesterId],
        [assetColumn, "assetType", input.assetType || "General Asset"]
      ];
      if (columns.has("JUSTIFICATION")) values.push(["justification", "justification", input.justification || "No justification provided."]);
      if (columns.has("STATUS")) values.push(["status", "status", "pending"]);
      await connection.execute(
        `INSERT INTO asset_requests (${values.map(([column]) => column).join(", ")})
         VALUES (${values.map(([, bind]) => `:${bind}`).join(", ")})`,
        Object.fromEntries(values.map(([, bind, value]) => [bind, value]))
      );
    }
    await notifyAdmins({ title: "Asset request submitted", body: `A new ${input.assetType || "asset"} request needs review.` }, connection);
    await writeAuditLog({ userId: input.requesterId, action: "asset_request_created", details: `${input.assetType || "Asset"} requested.` }, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

export async function decideAssetRequest(input: { id: number; status: "approved" | "rejected"; actorId: number }) {
  const connection = await getConnection();
  try {
    const requestTable = await connection.execute(`SELECT column_name FROM user_tab_columns WHERE table_name = 'ASSET_REQUESTS'`);
    const columns = new Set(((requestTable.rows || []) as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME));
    let request: { REQUESTER_ID?: number; ASSET_TYPE?: string } | undefined;
    if (columns.size) {
      const requesterColumn = columns.has("REQUESTER_ID") ? "requester_id" : "employee_id";
      const assetColumn = columns.has("ASSET_TYPE") ? "asset_type" : "asset_name";
      const requestResult = await connection.execute(
        `SELECT ar.${requesterColumn} AS requester_id, ar.${assetColumn} AS asset_type
         FROM asset_requests ar
         WHERE ar.id = :id`,
        { id: input.id }
      );
      request = (requestResult.rows || [])[0] as { REQUESTER_ID?: number; ASSET_TYPE?: string } | undefined;
      const updates = ["status = :status"];
      const binds: Record<string, unknown> = { id: input.id, status: input.status };
      if (columns.has("APPROVED_BY")) {
        updates.push("approved_by = :actorId");
        binds.actorId = input.actorId;
      }
      if (columns.has("UPDATED_AT")) updates.push("updated_at = CURRENT_TIMESTAMP");
      await connection.execute(`UPDATE asset_requests SET ${updates.join(", ")} WHERE id = :id`, binds);
    }
    if (request?.REQUESTER_ID) {
      const label = input.status === "approved" ? "approved" : "rejected";
      await createNotification({
        userId: Number(request.REQUESTER_ID),
        title: `Asset request ${label}`,
        body: `Your ${request.ASSET_TYPE || "asset"} request was ${label}.`
      }, connection);
    }
    await writeAuditLog({ userId: input.actorId, action: `asset_request_${input.status}`, details: `Request #${input.id} ${input.status}.` }, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.info(`[oracle] Asset request decision failed: ${error instanceof Error ? error.message : "unknown error"}`);
    throw error;
  } finally {
    await connection.close();
  }
}
