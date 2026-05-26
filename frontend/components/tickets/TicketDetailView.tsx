"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { normalizeTicketDetail, statusLabel } from "@/lib/tickets";
import type { TicketDetail } from "@/types/ticket";
import { StatusBadge } from "./StatusBadge";

export function TicketDetailView({ id }: { id: string }) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [error, setError] = useState("");
  const [image, setImage] = useState("");

  useEffect(() => {
    let active = true;
    setError("");
    setTicket(null);
    api.get<{ data: any }>(`/tickets/${id}`)
      .then(({ data }) => {
        if (active) setTicket(normalizeTicketDetail(data.data));
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Ticket could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Ticket unavailable</h2>
        <p className="mt-2 text-sm text-slate-600">{error}</p>
      </div>
    );
  }

  if (!ticket) return <div className="rounded-lg bg-white p-6 text-sm text-slate-600">Loading ticket...</div>;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <Info label="Ticket ID" value={`#${ticket.id}`} />
        <Info label="Status" value={<StatusBadge status={ticket.status} />} />
        <Info label="Priority" value={<StatusBadge status={ticket.priority} />} />
        <Info label="Retention" value={`${ticket.imageRetentionDays || 60} days after closure`} />
      </section>
      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">{ticket.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{ticket.description}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Info label="Employee" value={`${ticket.employee?.name || ticket.requesterName} (${ticket.employee?.loginId || ""})`} />
            <Info label="Department" value={ticket.employee?.department || "N/A"} />
            <Info label="Location" value={ticket.employee?.location || "N/A"} />
            <Info label="Asset" value={ticket.asset ? `${ticket.asset.assetTag} - ${ticket.asset.model}` : "No asset linked"} />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Images</h3>
          {ticket.screenshotUrl ? <img src={ticket.screenshotUrl} alt="Employee screenshot" onClick={() => setImage(ticket.screenshotUrl || "")} className="mt-4 max-h-48 w-full cursor-zoom-in rounded-md object-cover" /> : <p className="mt-4 text-sm text-slate-500">No employee screenshot uploaded.</p>}
          {ticket.serviceImageUrl ? <img src={ticket.serviceImageUrl} alt="Service image" onClick={() => setImage(ticket.serviceImageUrl || "")} className="mt-4 max-h-48 w-full cursor-zoom-in rounded-md object-cover" /> : null}
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Timeline</h2>
        <div className="mt-4 space-y-3">
          {ticket.timeline.map((item, index) => (
            <div key={`${item.timestamp}-${index}`} className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold capitalize text-slate-900">{statusLabel(item.action)}</p>
              <p className="mt-1 text-sm text-slate-600">{item.details}</p>
              <p className="mt-2 text-xs text-slate-500">{item.user} - {new Date(item.timestamp).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Engineer Updates</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Info label="Assigned Engineer" value={ticket.engineer ? `${ticket.engineer.loginId} - ${ticket.engineer.name}` : "Awaiting assignment"} />
          <Info label="Remarks" value={ticket.remarks || "No engineer remarks yet"} />
          <Info label="Engineer Notes" value={ticket.engineerNotes || "Pending"} />
          <Info label="Root Cause" value={ticket.rootCause || "Pending"} />
          <Info label="Corrective Action" value={ticket.correctiveAction || "Pending"} />
          <Info label="Preventive Action" value={ticket.preventiveAction || "Pending"} />
          <Info label="Parts Used" value={ticket.partsUsed || "None recorded"} />
        </div>
      </section>
      {image ? (
        <button className="fixed inset-0 z-50 bg-slate-950/80 p-8" onClick={() => setImage("")}>
          <img src={image} alt="Expanded ticket image" className="mx-auto max-h-full rounded-lg object-contain" />
        </button>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}
