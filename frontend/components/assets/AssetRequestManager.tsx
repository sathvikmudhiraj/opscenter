"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/tickets/StatusBadge";

type AssetRequest = { id: number; requesterName: string; requesterLogin: string; assetType: string; justification: string; status: "pending" | "approved" | "rejected"; createdAt: string; decidedByLogin?: string };

export function AssetRequestManager() {
  const [requests, setRequests] = useState<AssetRequest[]>([]);

  async function load() {
    const { data } = await api.get<{ data: AssetRequest[] }>("/assets/requests");
    setRequests(data.data);
  }

  useEffect(() => {
    load().catch(() => setRequests([]));
  }, []);

  async function decide(id: number, status: "approved" | "rejected") {
    await api.patch(`/assets/requests/${id}`, { status });
    await load();
  }

  return (
    <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">Request</th>
            <th className="px-5 py-3">Requester</th>
            <th className="px-5 py-3">Justification</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {requests.map((request) => (
            <tr key={request.id} className="hover:bg-blue-50/50">
              <td className="px-5 py-4">
                <p className="font-semibold text-slate-950">#{request.id} {request.assetType}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(request.createdAt).toLocaleString()}</p>
              </td>
              <td className="px-5 py-4">{request.requesterLogin} - {request.requesterName}</td>
              <td className="px-5 py-4 text-slate-600">{request.justification}</td>
              <td className="px-5 py-4"><StatusBadge status={request.status} /></td>
              <td className="px-5 py-4">
                {request.status === "pending" ? (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => decide(request.id, "approved")} className="rounded-md bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-800">Approve</button>
                    <button type="button" onClick={() => decide(request.id, "rejected")} className="rounded-md bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800">Reject</button>
                  </div>
                ) : <span className="text-xs text-slate-500">Decided by {request.decidedByLogin || "admin"}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!requests.length ? <div className="p-8 text-center text-sm text-slate-500">No asset requests.</div> : null}
    </section>
  );
}
