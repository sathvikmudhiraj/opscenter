"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowUpCircle, Boxes, Flag, ShieldCheck, Timer } from "lucide-react";
import { api } from "@/lib/api";
import { fileToDataUrl, formatSlaRemaining, getSlaDueAt, getSlaStatus, normalizeTicketDetail, slaStatusLabel, statusLabel } from "@/lib/tickets";
import type { TicketDetail } from "@/types/ticket";
import { StatusBadge } from "./StatusBadge";

const statuses = ["open", "assigned", "in_progress", "waiting_for_parts", "escalated", "resolved", "closed"];

export function EngineerTicketWorkbench({ id }: { id: string }) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState("");
  const [form, setForm] = useState({ engineerNotes: "", rootCause: "", correctiveAction: "", preventiveAction: "", partsUsed: "", status: "in_progress", remarks: "" });

  async function load() {
    setError("");
    setLoading(true);
    try {
      const { data } = await api.get<{ data: any }>(`/tickets/${id}`);
      const detail = normalizeTicketDetail(data.data);
      setTicket(detail);
      setForm({
        engineerNotes: detail.engineerNotes || "",
        rootCause: detail.rootCause || "",
        correctiveAction: detail.correctiveAction || "",
        preventiveAction: detail.preventiveAction || "",
        partsUsed: detail.partsUsed || "",
        status: detail.status,
        remarks: detail.remarks || ""
      });
      setPreview(detail.serviceImageUrl || "");
    } catch (requestError) {
      setTicket(null);
      setError(requestError instanceof Error ? requestError.message : "Ticket could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await saveEngineerAction(form.status, "Engineer update saved.");
  }

  async function saveEngineerAction(status: string, successMessage: string) {
    setError("");
    setNotice("");
    setSaving(true);
    try {
      await api.patch(`/tickets/${id}/engineer-action`, { ...form, status, serviceImageUrl: preview });
      setNotice(successMessage);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Engineer update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status: string, message: string) {
    setError("");
    setNotice("");
    setSaving(true);
    try {
      await api.patch(`/tickets/${id}/status`, { status, message });
      setNotice(message);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Status update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function escalate() {
    setError("");
    setNotice("");
    setSaving(true);
    try {
      await api.patch(`/tickets/${id}/escalate`);
      setNotice("Ticket escalated.");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Escalation failed.");
    } finally {
      setSaving(false);
    }
  }

  async function requestAsset() {
    setError("");
    setNotice("");
    setSaving(true);
    try {
      await api.post("/assets/requests", {
        assetType: ticket?.asset?.category ? `Replacement ${ticket.asset.category}` : "Service part",
        justification: `Requested from engineer workbench for ticket #${id}. Parts used: ${form.partsUsed || "Pending diagnosis"}.`
      });
      setNotice("Asset request submitted.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Asset request failed.");
    } finally {
      setSaving(false);
    }
  }

  const sla = useMemo(() => {
    if (!ticket) return null;
    const status = getSlaStatus(ticket);
    return {
      status,
      dueAt: getSlaDueAt(ticket),
      remaining: formatSlaRemaining(ticket)
    };
  }, [ticket]);

  if (error && !ticket) {
    return (
      <div className="rounded-lg border border-red-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Ticket unavailable</h2>
        <p className="mt-2 text-sm text-slate-600">{error}</p>
      </div>
    );
  }

  if (loading || !ticket) return <div className="rounded-lg bg-white p-6 text-sm text-slate-600">Loading ticket...</div>;

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      {notice ? <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">{notice}</div> : null}
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Info label="Ticket ID" value={`#${ticket.id}`} />
        <Info label="Asset ID" value={ticket.asset?.assetTag || "N/A"} />
        <Info label="User" value={ticket.employee?.name || ticket.requesterName} />
        <Info label="Department" value={ticket.employee?.department || "N/A"} />
        <Info label="Location" value={ticket.employee?.location || "N/A"} />
        <Info label="SLA Timer" value={sla ? <span className="inline-flex items-center gap-2"><Timer className="h-4 w-4" />{sla.remaining}</span> : "N/A"} />
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Info label="Created" value={new Date(ticket.createdAt).toLocaleString()} />
        <Info label="SLA Due" value={sla ? sla.dueAt.toLocaleString() : "N/A"} />
        <Info label="SLA Status" value={sla ? <StatusBadge status={sla.status} /> : "N/A"} />
        <Info label="SLA Indicator" value={sla ? slaStatusLabel(sla.status) : "N/A"} />
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button type="button" disabled={saving} onClick={() => updateStatus("in_progress", "Work started.")} className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
            <ArrowUpCircle className="h-4 w-4" />
            Start Work
          </button>
          <button type="button" disabled={saving} onClick={() => saveEngineerAction("resolved", "Ticket resolved.")} className="inline-flex items-center justify-center gap-2 rounded-md bg-green-700 px-3 py-3 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60">
            <ShieldCheck className="h-4 w-4" />
            Resolve
          </button>
          <button type="button" disabled={saving} onClick={escalate} className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60">
            <Flag className="h-4 w-4" />
            Escalate
          </button>
          <button type="button" disabled={saving} onClick={requestAsset} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <Boxes className="h-4 w-4" />
            Request Asset
          </button>
        </div>
      </section>
      {ticket.asset ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Linked Asset Details</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Info label="Asset Name" value={ticket.asset.assetName || ticket.asset.assetTag} />
            <Info label="Device" value={`${ticket.asset.category || ticket.asset.type} / ${ticket.asset.brand || ""} ${ticket.asset.model}`} />
            <Info label="Serial Number" value={ticket.asset.serialNumber || "N/A"} />
            <Info label="Warranty Expiry" value={ticket.asset.warrantyExpiry || "N/A"} />
            <Info label="Location" value={`${ticket.asset.department || "N/A"} / Block ${ticket.asset.block || "N/A"} / Room ${ticket.asset.room || "N/A"}`} />
            <Info label="Processor" value={ticket.asset.processor || "N/A"} />
            <Info label="RAM / Storage" value={`${ticket.asset.ram || "N/A"} / ${ticket.asset.storage || "N/A"}`} />
            <Info label="Operating System" value={ticket.asset.operatingSystem || "N/A"} />
          </div>
        </section>
      ) : null}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Employee Complaint</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{ticket.description}</p>
          {ticket.screenshotUrl ? <img src={ticket.screenshotUrl} alt="Employee screenshot" className="mt-4 max-h-64 w-full rounded-md object-cover" /> : null}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Status Control</h2>
          <div className="mt-4 grid gap-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Status</span>
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-sm capitalize outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
                {statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Remarks</span>
              <textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
            </label>
          </div>
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-950">Engineer Action</h2>
          <StatusBadge status={ticket.status} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(["engineerNotes", "rootCause", "correctiveAction", "preventiveAction", "partsUsed"] as const).map((field) => (
            <label key={field} className="block">
              <span className="text-sm font-medium capitalize text-slate-700">{field.replace(/([A-Z])/g, " $1")}</span>
              <textarea value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
            </label>
          ))}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Service image</span>
            <input type="file" accept="image/*" onChange={async (event) => setPreview(event.target.files?.[0] ? await fileToDataUrl(event.target.files[0]) : preview)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-sm" />
            {preview ? <img src={preview} alt="Service preview" className="mt-3 max-h-40 rounded-md object-cover" /> : null}
          </label>
        </div>
        <button disabled={saving} className="mt-6 rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{saving ? "Saving..." : "Save engineer update"}</button>
      </section>
    </form>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-sm font-semibold text-slate-950">{value}</p></div>;
}
