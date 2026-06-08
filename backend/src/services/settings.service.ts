import { getConnection } from "../config/database";
import { env } from "../config/env";
import { HttpError } from "../utils/httpError";
import { writeAuditLog } from "./audit.service";
import net from "net";
import oracledb from "oracledb";

export type SettingsSection =
  | "general"
  | "sla"
  | "notifications"
  | "security"
  | "assets"
  | "email"
  | "infrastructure"
  | "audit"
  | "maintenance";

export type SystemSettings = {
  general: {
    organizationName: string;
    companyLogoDataUrl: string;
    timeZone: string;
    dateFormat: string;
    timeFormat: string;
    defaultLanguage: string;
  };
  sla: {
    criticalHours: number;
    highHours: number;
    mediumHours: number;
    lowHours: number;
    warningThresholdPercent: number;
  };
  notifications: {
    inAppEnabled: boolean;
    emailEnabled: boolean;
    ticketAssignmentAlerts: boolean;
    ticketResolutionAlerts: boolean;
    slaBreachAlerts: boolean;
    assetAssignmentAlerts: boolean;
    assetRequestAlerts: boolean;
    serviceOutageAlerts: boolean;
  };
  security: {
    minimumPasswordLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialCharacters: boolean;
    passwordExpiryDays: number;
    sessionTimeoutMinutes: number;
    failedLoginLimit: number;
    cooldownEnabled: boolean;
    cooldownDurationMinutes: number;
    escalatingCooldownEnabled: boolean;
    maximumCooldownMinutes: number;
    adminManualUnlockEnabled: boolean;
    accountLockoutDurationMinutes: number;
    mfaEnabled: boolean;
    auditLoggingEnabled: boolean;
  };
  assets: {
    autoAssetIdGeneration: boolean;
    qrCodeGeneration: boolean;
    warrantyAlertDays: number;
    assetRetentionYears: number;
    assetLifecyclePolicy: string;
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    senderEmail: string;
    smtpUsername: string;
    smtpPassword: string;
  };
  infrastructure: {
    hpepIntranetUrl: string;
    bhelWebmailUrl: string;
    monitoringIntervalSeconds: number;
    slowResponseThresholdMs: number;
    timeoutThresholdMs: number;
    packetLossThresholdPercent: number;
  };
  audit: {
    auditLogRetentionDays: number;
    adminActionLogging: boolean;
    securityEventLogging: boolean;
    sensitiveDataMasking: boolean;
  };
  maintenance: {
    databaseBackupSchedule: string;
    lastBackupTime: string;
  };
};

const defaults: SystemSettings = {
  general: {
    organizationName: "OpsCenter",
    companyLogoDataUrl: "",
    timeZone: "Asia/Kolkata",
    dateFormat: "DD-MM-YYYY",
    timeFormat: "24h",
    defaultLanguage: "en"
  },
  sla: {
    criticalHours: 1,
    highHours: 4,
    mediumHours: 8,
    lowHours: 24,
    warningThresholdPercent: 25
  },
  notifications: {
    inAppEnabled: true,
    emailEnabled: false,
    ticketAssignmentAlerts: true,
    ticketResolutionAlerts: true,
    slaBreachAlerts: true,
    assetAssignmentAlerts: true,
    assetRequestAlerts: true,
    serviceOutageAlerts: true
  },
  security: {
    minimumPasswordLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialCharacters: false,
    passwordExpiryDays: 90,
    sessionTimeoutMinutes: 480,
    failedLoginLimit: 5,
    cooldownEnabled: true,
    cooldownDurationMinutes: 1,
    escalatingCooldownEnabled: true,
    maximumCooldownMinutes: 5,
    adminManualUnlockEnabled: true,
    accountLockoutDurationMinutes: 1,
    mfaEnabled: false,
    auditLoggingEnabled: true
  },
  assets: {
    autoAssetIdGeneration: false,
    qrCodeGeneration: false,
    warrantyAlertDays: 30,
    assetRetentionYears: 5,
    assetLifecyclePolicy: "Available -> Assigned -> Under Repair -> Retired"
  },
  email: {
    smtpHost: "",
    smtpPort: 587,
    senderEmail: "",
    smtpUsername: "",
    smtpPassword: ""
  },
  infrastructure: {
    hpepIntranetUrl: env.serviceHealth.hpepIntranetUrl,
    bhelWebmailUrl: env.serviceHealth.bhelWebmailUrl,
    monitoringIntervalSeconds: 60,
    slowResponseThresholdMs: 500,
    timeoutThresholdMs: 2500,
    packetLossThresholdPercent: 50
  },
  audit: {
    auditLogRetentionDays: 365,
    adminActionLogging: true,
    securityEventLogging: true,
    sensitiveDataMasking: true
  },
  maintenance: {
    databaseBackupSchedule: "manual",
    lastBackupTime: ""
  }
};

let settingsCache: { value: SystemSettings; expiresAt: number } | null = null;

function cloneDefaults(): SystemSettings {
  return JSON.parse(JSON.stringify(defaults)) as SystemSettings;
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return base;
  const output: any = { ...(base as any) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (value && typeof value === "object" && !Array.isArray(value) && key in output) {
      output[key] = deepMerge(output[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function toBool(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return fallback;
}

function numberInRange(value: unknown, fallback: number, min: number, max: number) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, Math.round(next)));
}

function sanitizeSettings(input: unknown): SystemSettings {
  const merged = deepMerge(cloneDefaults(), input);
  return {
    general: {
      organizationName: String(merged.general.organizationName || defaults.general.organizationName).slice(0, 160),
      companyLogoDataUrl: String(merged.general.companyLogoDataUrl || ""),
      timeZone: String(merged.general.timeZone || defaults.general.timeZone).slice(0, 80),
      dateFormat: String(merged.general.dateFormat || defaults.general.dateFormat).slice(0, 40),
      timeFormat: ["12h", "24h"].includes(String(merged.general.timeFormat)) ? merged.general.timeFormat : "24h",
      defaultLanguage: String(merged.general.defaultLanguage || "en").slice(0, 20)
    },
    sla: {
      criticalHours: numberInRange(merged.sla.criticalHours, defaults.sla.criticalHours, 1, 720),
      highHours: numberInRange(merged.sla.highHours, defaults.sla.highHours, 1, 720),
      mediumHours: numberInRange(merged.sla.mediumHours, defaults.sla.mediumHours, 1, 720),
      lowHours: numberInRange(merged.sla.lowHours, defaults.sla.lowHours, 1, 720),
      warningThresholdPercent: numberInRange(merged.sla.warningThresholdPercent, defaults.sla.warningThresholdPercent, 1, 99)
    },
    notifications: {
      inAppEnabled: toBool(merged.notifications.inAppEnabled, true),
      emailEnabled: toBool(merged.notifications.emailEnabled, false),
      ticketAssignmentAlerts: toBool(merged.notifications.ticketAssignmentAlerts, true),
      ticketResolutionAlerts: toBool(merged.notifications.ticketResolutionAlerts, true),
      slaBreachAlerts: toBool(merged.notifications.slaBreachAlerts, true),
      assetAssignmentAlerts: toBool(merged.notifications.assetAssignmentAlerts, true),
      assetRequestAlerts: toBool(merged.notifications.assetRequestAlerts, true),
      serviceOutageAlerts: toBool(merged.notifications.serviceOutageAlerts, true)
    },
    security: {
      minimumPasswordLength: numberInRange(merged.security.minimumPasswordLength, 8, 6, 128),
      requireUppercase: toBool(merged.security.requireUppercase, true),
      requireLowercase: toBool(merged.security.requireLowercase, true),
      requireNumbers: toBool(merged.security.requireNumbers, true),
      requireSpecialCharacters: toBool(merged.security.requireSpecialCharacters, false),
      passwordExpiryDays: numberInRange(merged.security.passwordExpiryDays, 90, 0, 3650),
      sessionTimeoutMinutes: numberInRange(merged.security.sessionTimeoutMinutes, defaults.security.sessionTimeoutMinutes, 5, 1440),
      failedLoginLimit: numberInRange(merged.security.failedLoginLimit, defaults.security.failedLoginLimit, 1, 20),
      cooldownEnabled: toBool(merged.security.cooldownEnabled, true),
      cooldownDurationMinutes: numberInRange(merged.security.cooldownDurationMinutes ?? merged.security.accountLockoutDurationMinutes, defaults.security.cooldownDurationMinutes, 1, 1440),
      escalatingCooldownEnabled: toBool(merged.security.escalatingCooldownEnabled, true),
      maximumCooldownMinutes: numberInRange(merged.security.maximumCooldownMinutes, defaults.security.maximumCooldownMinutes, 1, 1440),
      adminManualUnlockEnabled: toBool(merged.security.adminManualUnlockEnabled, true),
      accountLockoutDurationMinutes: numberInRange(merged.security.cooldownDurationMinutes ?? merged.security.accountLockoutDurationMinutes, defaults.security.accountLockoutDurationMinutes, 1, 1440),
      mfaEnabled: toBool(merged.security.mfaEnabled, false),
      auditLoggingEnabled: toBool(merged.security.auditLoggingEnabled, true)
    },
    assets: {
      autoAssetIdGeneration: toBool(merged.assets.autoAssetIdGeneration, false),
      qrCodeGeneration: toBool(merged.assets.qrCodeGeneration, false),
      warrantyAlertDays: numberInRange(merged.assets.warrantyAlertDays, 30, 1, 3650),
      assetRetentionYears: numberInRange(merged.assets.assetRetentionYears, 5, 1, 100),
      assetLifecyclePolicy: String(merged.assets.assetLifecyclePolicy || defaults.assets.assetLifecyclePolicy).slice(0, 1000)
    },
    email: {
      smtpHost: String(merged.email.smtpHost || "").slice(0, 255),
      smtpPort: numberInRange(merged.email.smtpPort, 587, 1, 65535),
      senderEmail: String(merged.email.senderEmail || "").slice(0, 255),
      smtpUsername: String(merged.email.smtpUsername || "").slice(0, 255),
      smtpPassword: String(merged.email.smtpPassword || "")
    },
    infrastructure: {
      hpepIntranetUrl: String(merged.infrastructure.hpepIntranetUrl || defaults.infrastructure.hpepIntranetUrl).slice(0, 500),
      bhelWebmailUrl: String(merged.infrastructure.bhelWebmailUrl || defaults.infrastructure.bhelWebmailUrl).slice(0, 500),
      monitoringIntervalSeconds: numberInRange(merged.infrastructure.monitoringIntervalSeconds, 60, 10, 3600),
      slowResponseThresholdMs: numberInRange(merged.infrastructure.slowResponseThresholdMs, 500, 50, 60000),
      timeoutThresholdMs: numberInRange(merged.infrastructure.timeoutThresholdMs, 2500, 100, 120000),
      packetLossThresholdPercent: numberInRange(merged.infrastructure.packetLossThresholdPercent, 50, 1, 100)
    },
    audit: {
      auditLogRetentionDays: numberInRange(merged.audit.auditLogRetentionDays, 365, 1, 3650),
      adminActionLogging: toBool(merged.audit.adminActionLogging, true),
      securityEventLogging: toBool(merged.audit.securityEventLogging, true),
      sensitiveDataMasking: toBool(merged.audit.sensitiveDataMasking, true)
    },
    maintenance: {
      databaseBackupSchedule: String(merged.maintenance.databaseBackupSchedule || "manual").slice(0, 120),
      lastBackupTime: String(merged.maintenance.lastBackupTime || "")
    }
  };
}

function maskSensitive(settings: SystemSettings): SystemSettings {
  return {
    ...settings,
    email: {
      ...settings.email,
      smtpPassword: settings.email.smtpPassword ? "********" : ""
    }
  };
}

function clobBind(value: string) {
  return { val: value, type: oracledb.CLOB };
}

function defaultSectionJson(section: SettingsSection) {
  return JSON.stringify((defaults as any)[section]);
}

async function tableExists(connection: any, tableName: string) {
  const result = await connection.execute(
    `SELECT COUNT(*) AS count FROM user_tables WHERE table_name = :tableName`,
    { tableName }
  );
  return Number(((result.rows || [])[0] as { COUNT?: number })?.COUNT || 0) > 0;
}

export async function ensureSettingsTables(connection: any) {
  let settingsSeeded = false;
  if (!await tableExists(connection, "SYSTEM_SETTINGS")) {
    await connection.execute(
      `CREATE TABLE system_settings (
        setting_key VARCHAR2(80) PRIMARY KEY,
        setting_value CLOB CHECK (setting_value IS JSON),
        updated_by NUMBER,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`
    );
  }
  if (!await tableExists(connection, "SETTINGS_HISTORY")) {
    await connection.execute(
      `CREATE TABLE settings_history (
        id NUMBER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        setting_key VARCHAR2(80) NOT NULL,
        old_value CLOB,
        new_value CLOB,
        changed_by NUMBER,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`
    );
    await connection.execute(`CREATE INDEX idx_settings_history_key_time ON settings_history(setting_key, changed_at)`);
  }
  const securityResult = await connection.execute(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'security'`
  );
  const securityRow = ((securityResult.rows || []) as Array<{ SETTING_VALUE?: string }>)[0];
  if (!securityRow) {
    await connection.execute(
      `INSERT INTO system_settings (setting_key, setting_value, updated_by)
       VALUES ('security', :settingValue, NULL)`,
      { settingValue: clobBind(defaultSectionJson("security")) }
    );
    settingsSeeded = true;
  } else {
    let currentSecurity: unknown = {};
    try {
      currentSecurity = JSON.parse(securityRow.SETTING_VALUE || "{}");
    } catch {
      currentSecurity = {};
    }
    const upgradedSecurity = deepMerge(defaults.security, currentSecurity);
    if (JSON.stringify(upgradedSecurity) !== JSON.stringify(currentSecurity)) {
      await connection.execute(
        `UPDATE system_settings
         SET setting_value = :settingValue, updated_at = CURRENT_TIMESTAMP
         WHERE setting_key = 'security'`,
        { settingValue: clobBind(JSON.stringify(upgradedSecurity)) }
      );
      settingsSeeded = true;
    }
  }
  if (settingsSeeded) {
    await connection.commit();
  }
}

async function readSettings(connection: any): Promise<SystemSettings> {
  await ensureSettingsTables(connection);
  const result = await connection.execute(`SELECT setting_key, setting_value FROM system_settings`);
  const settings = cloneDefaults();
  for (const row of (result.rows || []) as Array<{ SETTING_KEY: SettingsSection; SETTING_VALUE: string }>) {
    try {
      (settings as any)[row.SETTING_KEY] = deepMerge((settings as any)[row.SETTING_KEY], JSON.parse(row.SETTING_VALUE || "{}"));
    } catch {
      // Ignore malformed legacy rows and keep defaults.
    }
  }
  return sanitizeSettings(settings);
}

export async function getSystemSettings(options: { masked?: boolean; force?: boolean } = {}) {
  if (!options.force && settingsCache && settingsCache.expiresAt > Date.now()) {
    return options.masked ? maskSensitive(settingsCache.value) : settingsCache.value;
  }
  const connection = await getConnection();
  try {
    const settings = await readSettings(connection);
    settingsCache = { value: settings, expiresAt: Date.now() + 30000 };
    return options.masked ? maskSensitive(settings) : settings;
  } finally {
    await connection.close();
  }
}

export async function updateSystemSettings(input: { actorId: number; section?: SettingsSection; values: unknown }) {
  validateSessionTimeoutUpdate(input.section, input.values);
  const connection = await getConnection();
  try {
    await ensureSettingsTables(connection);
    const current = await readSettings(connection);
    const patch = input.section ? { [input.section]: input.values } : input.values;
    const next = sanitizeSettings(deepMerge(current, patch));
    const sections = input.section ? [input.section] : Object.keys(defaults) as SettingsSection[];

    for (const section of sections) {
      const oldValue = JSON.stringify((current as any)[section]);
      const newValue = JSON.stringify((next as any)[section]);
      if (oldValue === newValue) continue;
      await connection.execute(
        `MERGE INTO system_settings target
         USING (SELECT :settingKey AS setting_key FROM dual) source
         ON (target.setting_key = source.setting_key)
         WHEN MATCHED THEN UPDATE SET setting_value = :settingValue, updated_by = :updatedBy, updated_at = CURRENT_TIMESTAMP
         WHEN NOT MATCHED THEN INSERT (setting_key, setting_value, updated_by) VALUES (:settingKey, :settingValue, :updatedBy)`,
        { settingKey: section, settingValue: clobBind(newValue), updatedBy: input.actorId }
      );
      await connection.execute(
        `INSERT INTO settings_history (setting_key, old_value, new_value, changed_by)
         VALUES (:settingKey, :oldValue, :newValue, :changedBy)`,
        { settingKey: section, oldValue: clobBind(oldValue), newValue: clobBind(newValue), changedBy: input.actorId }
      );
      await writeAuditLog({ userId: input.actorId, action: "settings_updated", details: `${section} settings updated.` }, connection);
    }

    await recalculateActiveTicketSlaDeadlines(connection, next);
    await connection.commit();
    settingsCache = { value: next, expiresAt: Date.now() + 30000 };
    return maskSensitive(next);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

function validateSessionTimeoutUpdate(section: SettingsSection | undefined, values: unknown) {
  if (!values || typeof values !== "object") return;
  const valuesRecord = values as Record<string, unknown>;
  const security = section === "security"
    ? valuesRecord
    : valuesRecord.security && typeof valuesRecord.security === "object"
      ? valuesRecord.security as Record<string, unknown>
      : null;
  if (!security || security.sessionTimeoutMinutes === undefined) return;

  const value = security.sessionTimeoutMinutes;
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new HttpError(400, "Session timeout must be a whole number");
  }
  if (value < 5 || value > 1440) throw new HttpError(400, "Session timeout must be between 5 and 1440 minutes.");
}

async function recalculateActiveTicketSlaDeadlines(connection: any, settings: SystemSettings) {
  const table = await connection.execute(`SELECT COUNT(*) AS count FROM user_tables WHERE table_name = 'TICKETS'`);
  const exists = Number(((table.rows || [])[0] as { COUNT?: number })?.COUNT || 0) > 0;
  if (!exists) return;
  const columnsResult = await connection.execute(`SELECT column_name FROM user_tab_columns WHERE table_name = 'TICKETS'`);
  const columns = new Set(((columnsResult.rows || []) as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME));
  const deadlineColumn = columns.has("SLA_DUE_AT") ? "sla_due_at" : columns.has("SLA_DEADLINE") ? "sla_deadline" : null;
  if (!deadlineColumn || !columns.has("CREATED_AT") || !columns.has("PRIORITY")) return;
  await connection.execute(
    `UPDATE tickets
     SET ${deadlineColumn} = created_at + NUMTODSINTERVAL(
       CASE LOWER(NVL(priority, 'low'))
         WHEN 'critical' THEN :criticalHours
         WHEN 'high' THEN :highHours
         WHEN 'medium' THEN :mediumHours
         ELSE :lowHours
       END,
       'HOUR'
     )
     WHERE LOWER(NVL(status, 'open')) NOT IN ('resolved', 'closed')`,
    {
      criticalHours: settings.sla.criticalHours,
      highHours: settings.sla.highHours,
      mediumHours: settings.sla.mediumHours,
      lowHours: settings.sla.lowHours
    }
  );
}

export async function getSettingsHistory() {
  const connection = await getConnection();
  try {
    await ensureSettingsTables(connection);
    const userColumnsResult = await connection.execute(`SELECT column_name FROM user_tab_columns WHERE table_name = 'USERS'`);
    const userColumns = new Set(((userColumnsResult.rows || []) as Array<{ COLUMN_NAME: string }>).map((row) => row.COLUMN_NAME));
    const loginColumn = userColumns.has("USERNAME") ? "username" : userColumns.has("EMAIL") ? "email" : userColumns.has("LOGIN_ID") ? "login_id" : null;
    const userJoin = loginColumn ? "LEFT JOIN users u ON u.id = h.changed_by" : "";
    const changedByLogin = loginColumn ? `COALESCE(u.${loginColumn}, TO_CHAR(h.changed_by), 'system')` : "COALESCE(TO_CHAR(h.changed_by), 'system')";
    const result = await connection.execute(
      `SELECT h.id, h.setting_key, h.old_value, h.new_value, h.changed_by, h.changed_at,
              ${changedByLogin} AS changed_by_login
       FROM settings_history h
       ${userJoin}
       ORDER BY h.changed_at DESC
       FETCH FIRST 200 ROWS ONLY`
    );
    return ((result.rows || []) as Array<any>).map((row) => ({
      id: row.ID,
      section: row.SETTING_KEY,
      changedBy: row.CHANGED_BY,
      changedByLogin: row.CHANGED_BY_LOGIN,
      changedAt: row.CHANGED_AT,
      oldValue: row.OLD_VALUE,
      newValue: row.NEW_VALUE
    }));
  } finally {
    await connection.close();
  }
}

export async function testEmailSettings(input: { actorId: number; recipient?: string }) {
  const settings = await getSystemSettings({ force: true });
  if (!settings.email.smtpHost || !settings.email.senderEmail) {
    throw new HttpError(400, "SMTP host and sender email are required before testing email.");
  }
  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host: settings.email.smtpHost, port: settings.email.smtpPort });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new HttpError(502, "SMTP connection timed out."));
    }, 7000);
    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.end();
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(new HttpError(502, `SMTP connection failed: ${error.message}`));
    });
  });
  await writeAuditLog({ userId: input.actorId, action: "settings_email_test", details: `SMTP test requested for ${input.recipient || settings.email.senderEmail}.` });
  return {
    ok: true,
    message: `SMTP server ${settings.email.smtpHost}:${settings.email.smtpPort} is reachable.`
  };
}

export async function getSystemHealth() {
  const connection = await getConnection();
  try {
    await connection.execute(`SELECT 1 AS ok FROM dual`);
    const settings = await readSettings(connection);
    return {
      appVersion: process.env.npm_package_version || "1.0.0",
      backendStatus: "online",
      frontendStatus: "online",
      oracleConnectionStatus: "online",
      databaseHealth: "healthy",
      lastBackupTime: settings.maintenance.lastBackupTime || "Not recorded"
    };
  } catch {
    return {
      appVersion: process.env.npm_package_version || "1.0.0",
      backendStatus: "online",
      frontendStatus: "online",
      oracleConnectionStatus: "offline",
      databaseHealth: "unhealthy",
      lastBackupTime: "Unknown"
    };
  } finally {
    await connection.close().catch(() => undefined);
  }
}

export async function runMaintenanceAction(input: { actorId: number; action: string }) {
  const connection = await getConnection();
  try {
    await ensureSettingsTables(connection);
    if (input.action === "clear-notifications") {
      if (await tableExists(connection, "NOTIFICATIONS")) {
        await connection.execute(`DELETE FROM notifications`);
      }
    } else if (input.action === "clear-monitoring-history") {
      if (await tableExists(connection, "SERVICE_HEALTH_HISTORY")) {
        await connection.execute(`DELETE FROM service_health_history`);
      }
    } else if (input.action === "record-backup") {
      const current = await readSettings(connection);
      current.maintenance.lastBackupTime = new Date().toISOString();
      await connection.execute(
        `MERGE INTO system_settings target
         USING (SELECT 'maintenance' AS setting_key FROM dual) source
         ON (target.setting_key = source.setting_key)
         WHEN MATCHED THEN UPDATE SET setting_value = :value, updated_by = :actorId, updated_at = CURRENT_TIMESTAMP
         WHEN NOT MATCHED THEN INSERT (setting_key, setting_value, updated_by) VALUES ('maintenance', :value, :actorId)`,
        { value: clobBind(JSON.stringify(current.maintenance)), actorId: input.actorId }
      );
    } else {
      throw new Error("Unsupported maintenance action.");
    }
    await writeAuditLog({ userId: input.actorId, action: `maintenance_${input.action}`, details: `${input.action} executed from settings.` }, connection);
    await connection.commit();
    settingsCache = null;
    return { ok: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.close();
  }
}

export { defaults as defaultSystemSettings };

export async function validatePasswordPolicy(password: string) {
  const settings = await getSystemSettings();
  const policy = settings.security;
  const failures: string[] = [];
  if (password.length < policy.minimumPasswordLength) failures.push(`at least ${policy.minimumPasswordLength} characters`);
  if (policy.requireUppercase && !/[A-Z]/.test(password)) failures.push("an uppercase letter");
  if (policy.requireLowercase && !/[a-z]/.test(password)) failures.push("a lowercase letter");
  if (policy.requireNumbers && !/[0-9]/.test(password)) failures.push("a number");
  if (policy.requireSpecialCharacters && !/[^A-Za-z0-9]/.test(password)) failures.push("a special character");
  if (failures.length) {
    throw new HttpError(400, `Password must include ${failures.join(", ")}.`);
  }
}
