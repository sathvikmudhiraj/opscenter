"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Activity, Bell, Building2, Database, HardDrive, Mail, Monitor, Pencil, Plus, Save, Shield, SlidersHorizontal, Trash2, Wrench, X } from "lucide-react";
import { api } from "@/lib/api";

type SectionKey = "general" | "sla" | "notifications" | "security" | "assets" | "email" | "infrastructure" | "audit" | "maintenance" | "health";
type Settings = Record<string, any>;
type InfrastructureService = {
  id: string;
  name: string;
  url: string;
  category: string;
  description: string;
  supportTeam: string;
  contactNumber: string;
  supportEmail: string;
  escalationNote: string;
  monitoringEnabled: boolean;
  isDefault: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

const tabs: Array<{ key: SectionKey; label: string; icon: any }> = [
  { key: "general", label: "General", icon: Building2 },
  { key: "sla", label: "SLA", icon: SlidersHorizontal },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "security", label: "Security", icon: Shield },
  { key: "assets", label: "Assets", icon: HardDrive },
  { key: "email", label: "SMTP", icon: Mail },
  { key: "infrastructure", label: "Infrastructure", icon: Monitor },
  { key: "audit", label: "Audit", icon: Activity },
  { key: "maintenance", label: "Maintenance", icon: Database },
  { key: "health", label: "Health", icon: Wrench }
];

const sectionTitles: Record<SectionKey, string> = {
  general: "General Settings",
  sla: "SLA Configuration",
  notifications: "Notification Settings",
  security: "Security Policies",
  assets: "Asset Management Settings",
  email: "SMTP / Email Configuration",
  infrastructure: "Infrastructure Monitoring Settings",
  audit: "Audit & Compliance",
  maintenance: "Backup & Maintenance",
  health: "System Health"
};

export function SettingsCenter() {
  const [settings, setSettings] = useState<Settings>({});
  const [original, setOriginal] = useState<Settings>({});
  const [active, setActive] = useState<SectionKey>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [health, setHealth] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<any[]>([]);
  const [infrastructureServices, setInfrastructureServices] = useState<InfrastructureService[]>([]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [{ data: settingsResp }, { data: healthResp }, { data: auditResp }, { data: servicesResp }] = await Promise.all([
        api.get<{ data: Settings }>("/settings"),
        api.get<{ data: Record<string, string> }>("/settings/system-health"),
        api.get<{ data: any[] }>("/settings/audit"),
        api.get<{ data: InfrastructureService[] }>("/infrastructure-services")
      ]);
      setSettings(settingsResp.data || {});
      setOriginal(settingsResp.data || {});
      setHealth(healthResp.data || {});
      setHistory(auditResp.data || []);
      setInfrastructureServices(servicesResp.data || []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const section = settings[active] || {};

  function update(path: string, value: unknown) {
    setSettings((current) => {
      const next = structuredClone(current);
      const [sectionKey, field] = path.split(".");
      next[sectionKey] = { ...(next[sectionKey] || {}), [field]: value };
      return next;
    });
  }

  async function save(sectionKey: SectionKey) {
    if (sectionKey === "health") return;
    setSaving(sectionKey);
    setError("");
    try {
      const payload = sectionKey === "email" && settings.email?.smtpPassword === "********"
        ? { ...settings.email, smtpPassword: original.email?.smtpPassword || "" }
        : settings[sectionKey];
      const { data } = await api.put<{ data: Settings }>("/settings", { section: sectionKey, values: payload });
      setSettings(data.data || settings);
      setOriginal(data.data || settings);
      setToast(`${sectionTitles[sectionKey]} saved.`);
      window.setTimeout(() => setToast(""), 2500);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Settings could not be saved.");
    } finally {
      setSaving("");
    }
  }

  function reset(sectionKey: SectionKey) {
    setSettings((current) => ({ ...current, [sectionKey]: original[sectionKey] }));
  }

  async function testEmail() {
    setSaving("email-test");
    try {
      const { data } = await api.post<{ message: string }>("/settings/test-email", {});
      setToast(data.message || "Email configuration tested.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Test email failed.");
    } finally {
      setSaving("");
    }
  }

  async function maintenance(action: string) {
    setSaving(action);
    try {
      await api.post("/settings/maintenance", { action });
      setToast(`${action} completed.`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Maintenance action failed.");
    } finally {
      setSaving("");
    }
  }

  const dirty = useMemo(() => JSON.stringify(settings[active] || {}) !== JSON.stringify(original[active] || {}), [active, original, settings]);

  if (loading) return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Loading enterprise settings...</div>;

  return (
    <div className="space-y-5">
      {toast ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{toast}</div> : null}
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[260px_1fr]">
        <nav className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActive(tab.key)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition ${active === tab.key ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-slate-50"}`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">{sectionTitles[active]}</h2>
              <p className="mt-1 text-sm text-slate-500">Enterprise configuration persisted in Oracle.</p>
            </div>
            {active !== "health" ? (
              <div className="flex gap-2">
                <button type="button" onClick={() => reset(active)} disabled={!dirty || Boolean(saving)} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Reset</button>
                <button type="button" onClick={() => save(active)} disabled={!dirty || Boolean(saving)} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />Save</button>
              </div>
            ) : null}
          </div>

          <div className="mt-5">
            {active === "general" ? <General section={section} update={update} /> : null}
            {active === "sla" ? <Sla section={section} update={update} /> : null}
            {active === "notifications" ? <Notifications section={section} update={update} /> : null}
            {active === "security" ? <Security section={section} update={update} /> : null}
            {active === "assets" ? <Assets section={section} update={update} /> : null}
            {active === "email" ? <Email section={section} update={update} testEmail={testEmail} testing={saving === "email-test"} /> : null}
            {active === "infrastructure" ? <Infrastructure section={section} update={update} services={infrastructureServices} reload={load} setToast={setToast} setError={setError} /> : null}
            {active === "audit" ? <Audit section={section} update={update} history={history} /> : null}
            {active === "maintenance" ? <Maintenance section={section} update={update} run={maintenance} saving={saving} /> : null}
            {active === "health" ? <Health health={health} reload={load} /> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", suffix }: { label: string; value: any; onChange: (value: any) => void; type?: string; suffix?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1 flex rounded-md border border-slate-300 bg-white focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100">
        <input type={type} value={value ?? ""} onChange={(event) => onChange(type === "number" ? Number(event.target.value) : event.target.value)} className="min-w-0 flex-1 rounded-md px-3 py-2 text-sm outline-none" />
        {suffix ? <span className="border-l border-slate-200 px-3 py-2 text-sm text-slate-500">{suffix}</span> : null}
      </div>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-md border border-slate-200 px-3 py-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-700" />
    </label>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function General({ section, update }: any) {
  function logo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 750_000) {
      window.alert("Logo must be under 750 KB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update("general.companyLogoDataUrl", String(reader.result || ""));
    reader.readAsDataURL(file);
  }
  return <Grid><Field label="Organization Name" value={section.organizationName} onChange={(v) => update("general.organizationName", v)} /><label className="block"><span className="text-sm font-medium text-slate-700">Company Logo Upload</span><input type="file" accept="image/*" onChange={logo} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label><Field label="Time Zone" value={section.timeZone} onChange={(v) => update("general.timeZone", v)} /><Field label="Date Format" value={section.dateFormat} onChange={(v) => update("general.dateFormat", v)} /><Field label="Time Format" value={section.timeFormat} onChange={(v) => update("general.timeFormat", v)} /><Field label="Default Language" value={section.defaultLanguage} onChange={(v) => update("general.defaultLanguage", v)} /></Grid>;
}

function Sla({ section, update }: any) {
  return <Grid><Field type="number" label="Critical SLA Hours" value={section.criticalHours} onChange={(v) => update("sla.criticalHours", v)} /><Field type="number" label="High SLA Hours" value={section.highHours} onChange={(v) => update("sla.highHours", v)} /><Field type="number" label="Medium SLA Hours" value={section.mediumHours} onChange={(v) => update("sla.mediumHours", v)} /><Field type="number" label="Low SLA Hours" value={section.lowHours} onChange={(v) => update("sla.lowHours", v)} /><Field type="number" label="SLA Warning Threshold" value={section.warningThresholdPercent} suffix="%" onChange={(v) => update("sla.warningThresholdPercent", v)} /></Grid>;
}

function Notifications({ section, update }: any) {
  return <Grid>{Object.entries({ inAppEnabled: "Enable In-App Notifications", emailEnabled: "Enable Email Notifications", ticketAssignmentAlerts: "Ticket Assignment Alerts", ticketResolutionAlerts: "Ticket Resolution Alerts", slaBreachAlerts: "SLA Breach Alerts", assetAssignmentAlerts: "Asset Assignment Alerts", assetRequestAlerts: "Asset Request Alerts", serviceOutageAlerts: "Service Outage Alerts" }).map(([key, label]) => <Toggle key={key} label={label} checked={section[key]} onChange={(v) => update(`notifications.${key}`, v)} />)}</Grid>;
}

function Security({ section, update }: any) {
  return <Grid><Field type="number" label="Minimum Password Length" value={section.minimumPasswordLength} onChange={(v) => update("security.minimumPasswordLength", v)} /><Toggle label="Require Uppercase" checked={section.requireUppercase} onChange={(v) => update("security.requireUppercase", v)} /><Toggle label="Require Lowercase" checked={section.requireLowercase} onChange={(v) => update("security.requireLowercase", v)} /><Toggle label="Require Numbers" checked={section.requireNumbers} onChange={(v) => update("security.requireNumbers", v)} /><Toggle label="Require Special Characters" checked={section.requireSpecialCharacters} onChange={(v) => update("security.requireSpecialCharacters", v)} /><Field type="number" label="Password Expiry Days" value={section.passwordExpiryDays} onChange={(v) => update("security.passwordExpiryDays", v)} /><Field type="number" label="Session Timeout Minutes" value={section.sessionTimeoutMinutes} onChange={(v) => update("security.sessionTimeoutMinutes", v)} /><Field type="number" label="Failed Login Limit" value={section.failedLoginLimit} onChange={(v) => update("security.failedLoginLimit", v)} /><Field type="number" label="Account Lockout Duration" value={section.accountLockoutDurationMinutes} suffix="min" onChange={(v) => update("security.accountLockoutDurationMinutes", v)} /><Toggle label="MFA Toggle" checked={section.mfaEnabled} onChange={(v) => update("security.mfaEnabled", v)} /><Toggle label="Audit Logging Toggle" checked={section.auditLoggingEnabled} onChange={(v) => update("security.auditLoggingEnabled", v)} /></Grid>;
}

function Assets({ section, update }: any) {
  return <Grid><Toggle label="Auto Asset ID Generation" checked={section.autoAssetIdGeneration} onChange={(v) => update("assets.autoAssetIdGeneration", v)} /><Toggle label="QR Code Generation" checked={section.qrCodeGeneration} onChange={(v) => update("assets.qrCodeGeneration", v)} /><Field type="number" label="Warranty Alert Days" value={section.warrantyAlertDays} onChange={(v) => update("assets.warrantyAlertDays", v)} /><Field type="number" label="Asset Retention Years" value={section.assetRetentionYears} onChange={(v) => update("assets.assetRetentionYears", v)} /><Field label="Asset Lifecycle Policy" value={section.assetLifecyclePolicy} onChange={(v) => update("assets.assetLifecyclePolicy", v)} /></Grid>;
}

function Email({ section, update, testEmail, testing }: any) {
  return <><Grid><Field label="SMTP Host" value={section.smtpHost} onChange={(v) => update("email.smtpHost", v)} /><Field type="number" label="SMTP Port" value={section.smtpPort} onChange={(v) => update("email.smtpPort", v)} /><Field label="Sender Email" value={section.senderEmail} onChange={(v) => update("email.senderEmail", v)} /><Field label="SMTP Username" value={section.smtpUsername} onChange={(v) => update("email.smtpUsername", v)} /><Field type="password" label="SMTP Password" value={section.smtpPassword} onChange={(v) => update("email.smtpPassword", v)} /></Grid><button type="button" onClick={testEmail} disabled={testing} className="mt-4 rounded-md border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50">Test Email</button></>;
}

function Infrastructure({ section, update, services, reload, setToast, setError }: any) {
  const defaultServices = services.filter((service: InfrastructureService) => service.isDefault);
  const customServices = services.filter((service: InfrastructureService) => !service.isDefault);
  const [editing, setEditing] = useState<InfrastructureService | null>(null);
  const [form, setForm] = useState({ name: "", url: "", category: "", description: "", supportTeam: "", contactNumber: "", supportEmail: "", escalationNote: "", monitoringEnabled: true });
  const [saving, setSaving] = useState(false);

  function startAdd() {
    setEditing(null);
    setForm({ name: "", url: "", category: "Custom", description: "", supportTeam: "", contactNumber: "", supportEmail: "", escalationNote: "", monitoringEnabled: true });
  }

  function startEdit(service: InfrastructureService) {
    setEditing(service);
    setForm({
      name: service.name,
      url: service.url,
      category: service.category,
      description: service.description,
      supportTeam: service.supportTeam || "",
      contactNumber: service.contactNumber || "",
      supportEmail: service.supportEmail || "",
      escalationNote: service.escalationNote || "",
      monitoringEnabled: service.monitoringEnabled
    });
  }

  function validate() {
    if (editing?.isDefault) return "";
    if (!form.name.trim()) return "Service name is required.";
    if (!form.url.trim()) return "URL is required.";
    if (!/^https?:\/\//i.test(form.url.trim())) return "URL must start with http:// or https://.";
    const duplicate = services.some((service: InfrastructureService) => service.url.toLowerCase() === form.url.trim().toLowerCase() && service.id !== editing?.id);
    if (duplicate) return "A service with this URL already exists.";
    return "";
  }

  async function submit() {
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await api.put(`/infrastructure-services/${editing.id}`, form);
        setToast(editing.isDefault ? "Infrastructure support contact updated." : "Infrastructure service updated.");
      } else {
        await api.post("/infrastructure-services", form);
        setToast("Infrastructure service added.");
      }
      setEditing(null);
      setForm({ name: "", url: "", category: "", description: "", supportTeam: "", contactNumber: "", supportEmail: "", escalationNote: "", monitoringEnabled: true });
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Infrastructure service could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(service: InfrastructureService) {
    if (!window.confirm("Are you sure you want to delete this infrastructure service?")) return;
    setSaving(true);
    setError("");
    try {
      await api.delete(`/infrastructure-services/${service.id}`);
      setToast("Infrastructure service deleted.");
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Infrastructure service could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(service: InfrastructureService) {
    setSaving(true);
    setError("");
    try {
      await api.put(`/infrastructure-services/${service.id}`, { ...service, monitoringEnabled: !service.monitoringEnabled });
      setToast("Infrastructure monitoring updated.");
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Infrastructure service could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  const formOpen = editing || form.name || form.url || form.category || form.description || form.supportTeam || form.contactNumber || form.supportEmail || form.escalationNote;

  return (
    <div className="space-y-6">
      <Grid><Field label="HPEP Intranet URL" value={section.hpepIntranetUrl} onChange={(v) => update("infrastructure.hpepIntranetUrl", v)} /><Field label="BHEL Webmail URL" value={section.bhelWebmailUrl} onChange={(v) => update("infrastructure.bhelWebmailUrl", v)} /><Field type="number" label="Monitoring Interval Seconds" value={section.monitoringIntervalSeconds} onChange={(v) => update("infrastructure.monitoringIntervalSeconds", v)} /><Field type="number" label="Slow Response Threshold" value={section.slowResponseThresholdMs} suffix="ms" onChange={(v) => update("infrastructure.slowResponseThresholdMs", v)} /><Field type="number" label="Timeout Threshold" value={section.timeoutThresholdMs} suffix="ms" onChange={(v) => update("infrastructure.timeoutThresholdMs", v)} /><Field type="number" label="Packet Loss Threshold" value={section.packetLossThresholdPercent} suffix="%" onChange={(v) => update("infrastructure.packetLossThresholdPercent", v)} /></Grid>

      <section className="rounded-md border border-slate-200 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-slate-950">Infrastructure Services</h3>
          <button type="button" onClick={startAdd} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" />+ Add Service</button>
        </div>

        {formOpen ? (
          <div className="mt-4 rounded-md border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">{editing?.isDefault ? "Edit Default Support Contact" : editing ? "Edit Custom Service" : "Add Custom Service"}</p>
              <button type="button" onClick={() => { setEditing(null); setForm({ name: "", url: "", category: "", description: "", supportTeam: "", contactNumber: "", supportEmail: "", escalationNote: "", monitoringEnabled: true }); }} className="rounded-md border border-slate-300 p-2 text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {!editing?.isDefault ? (
                <>
                  <Field label="Service Name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
                  <Field label="Service URL" value={form.url} onChange={(value) => setForm((current) => ({ ...current, url: value }))} />
                  <Field label="Category" value={form.category} onChange={(value) => setForm((current) => ({ ...current, category: value }))} />
                  <Toggle label="Monitoring Enabled" checked={form.monitoringEnabled} onChange={(value) => setForm((current) => ({ ...current, monitoringEnabled: value }))} />
                  <label className="block md:col-span-2">
                    <span className="text-sm font-medium text-slate-700">Description</span>
                    <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                  </label>
                </>
              ) : null}
              <Field label="Support Team Name" value={form.supportTeam} onChange={(value) => setForm((current) => ({ ...current, supportTeam: value }))} />
              <Field label="Contact Number / Extension" value={form.contactNumber} onChange={(value) => setForm((current) => ({ ...current, contactNumber: value }))} />
              <Field label="Support Email" value={form.supportEmail} onChange={(value) => setForm((current) => ({ ...current, supportEmail: value }))} />
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Escalation Note</span>
                <textarea value={form.escalationNote} onChange={(event) => setForm((current) => ({ ...current, escalationNote: event.target.value }))} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{editing ? "Save Service" : "Add Service"}</button>
            </div>
          </div>
        ) : null}

        <ServiceGroup title="Default Services" services={defaultServices} onEdit={startEdit} />
        <ServiceGroup title="Custom Services" services={customServices} onEdit={startEdit} onDelete={remove} onToggle={toggle} saving={saving} />
      </section>
    </div>
  );
}

function ServiceGroup({ title, services, onEdit, onDelete, onToggle, saving }: { title: string; services: InfrastructureService[]; onEdit?: (service: InfrastructureService) => void; onDelete?: (service: InfrastructureService) => void; onToggle?: (service: InfrastructureService) => void; saving?: boolean }) {
  return (
    <div className="mt-5">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <div className="mt-3 overflow-x-auto rounded-md border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Service</th><th className="px-4 py-3">URL</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Monitoring</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {services.map((service) => (
              <tr key={service.id}>
                <td className="px-4 py-3"><p className="font-semibold text-slate-950">{service.name}</p><p className="text-xs text-slate-500">{service.description || "No description"}</p></td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-600">{service.url}</td>
                <td className="px-4 py-3 text-slate-600">{service.category}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${service.monitoringEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{service.monitoringEnabled ? "Enabled" : "Disabled"}</span></td>
                <td className="px-4 py-3"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{service.isDefault ? "Default" : "Custom"}</span></td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {!service.isDefault ? (
                      <>
                      <button type="button" onClick={() => onToggle?.(service)} disabled={saving} className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50">{service.monitoringEnabled ? "Disable" : "Enable"}</button>
                      <button type="button" onClick={() => onDelete?.(service)} disabled={saving} className="rounded-md border border-red-200 p-1.5 text-red-700 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
                      </>
                    ) : null}
                    <button type="button" onClick={() => onEdit?.(service)} disabled={saving} className="rounded-md border border-slate-300 p-1.5 text-slate-700 disabled:opacity-50"><Pencil className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!services.length ? <p className="p-4 text-sm text-slate-500">No services configured.</p> : null}
      </div>
    </div>
  );
}

function Audit({ section, update, history }: any) {
  return <div className="space-y-5"><Grid><Field type="number" label="Audit Log Retention Days" value={section.auditLogRetentionDays} onChange={(v) => update("audit.auditLogRetentionDays", v)} /><Toggle label="Admin Action Logging" checked={section.adminActionLogging} onChange={(v) => update("audit.adminActionLogging", v)} /><Toggle label="Security Event Logging" checked={section.securityEventLogging} onChange={(v) => update("audit.securityEventLogging", v)} /><Toggle label="Sensitive Data Masking" checked={section.sensitiveDataMasking} onChange={(v) => update("audit.sensitiveDataMasking", v)} /></Grid><History rows={history} /></div>;
}

function Maintenance({ section, update, run, saving }: any) {
  return <div className="space-y-5"><Grid><Field label="Database Backup Schedule" value={section.databaseBackupSchedule} onChange={(v) => update("maintenance.databaseBackupSchedule", v)} /><Field label="Last Backup Time" value={section.lastBackupTime} onChange={(v) => update("maintenance.lastBackupTime", v)} /></Grid><div className="flex flex-wrap gap-2">{["record-backup", "clear-notifications", "clear-monitoring-history"].map((action) => <button key={action} type="button" onClick={() => run(action)} disabled={saving === action} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{action.replaceAll("-", " ")}</button>)}</div></div>;
}

function Health({ health, reload }: { health: Record<string, string>; reload: () => void }) {
  return <div className="space-y-4"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Object.entries(health).map(([key, value]) => <div key={key} className="rounded-md border border-slate-200 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{key.replace(/([A-Z])/g, " $1")}</p><p className="mt-2 text-base font-semibold text-slate-950">{String(value)}</p></div>)}</div><button type="button" onClick={reload} className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white">Refresh Health</button></div>;
}

function History({ rows }: { rows: any[] }) {
  return <div className="overflow-x-auto rounded-md border border-slate-200"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Section</th><th className="px-4 py-3">Changed By</th><th className="px-4 py-3">Changed At</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.slice(0, 8).map((row) => <tr key={row.id}><td className="px-4 py-3 font-semibold text-slate-900">{row.section}</td><td className="px-4 py-3">{row.changedByLogin}</td><td className="px-4 py-3">{new Date(row.changedAt).toLocaleString()}</td></tr>)}</tbody></table>{!rows.length ? <p className="p-4 text-sm text-slate-500">No settings changes recorded yet.</p> : null}</div>;
}
