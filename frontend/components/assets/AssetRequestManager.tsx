"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/tickets/StatusBadge";

type AssetRequestStatus = "pending" | "approved" | "rejected";

type AssetRequest = {
  id: number;
  requesterId: number;
  requesterName: string;
  requesterLogin: string;
  requesterFullName: string;
  requesterEmployeeId: string;
  requesterRole: string;
  requesterDepartment: string;
  department: string;
  assetType: string;
  justification: string;
  status: AssetRequestStatus;
  requestedAt: string;
  createdAt: string;
  approvedBy?: string;
  decidedByLogin?: string;
};

const statusOptions = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "All", value: "all" }
] as const;

function roleLabel(role?: string) {
  const normalized = String(role || "employee").toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function AssetRequestManager() {
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof statusOptions)[number]["value"]>("pending");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<number | null>(null);

  async function load() {
    const { data } = await api.get<{ data: AssetRequest[] }>("/assets/requests");
    setRequests(data.data);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => {
      setRequests([]);
      setLoading(false);
    });
  }, []);

  async function decide(id: number, status: Exclude<AssetRequestStatus, "pending">) {
    setDecidingId(id);
    setToast("");
    try {
      await api.patch(`/assets/requests/${id}`, { status });
      await load();
      setToast(status === "approved" ? "Asset request approved successfully" : "Asset request rejected successfully");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Asset request update failed");
    } finally {
      setDecidingId(null);
    }
  }

  const filteredRequests = statusFilter === "all" ? requests : requests.filter((request) => request.status === statusFilter);

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Asset Request Management</h2>
          <p className="mt-1 text-sm text-slate-500">Review employee asset requests and record approval decisions in Oracle.</p>
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      {toast ? (
        <div className={`mx-5 mt-5 rounded-md px-4 py-3 text-sm font-semibold ${toast.includes("successfully") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {toast}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-[1120px] divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Request ID</th>
              <th className="px-5 py-3">Requester</th>
              <th className="px-5 py-3">Asset Type</th>
              <th className="px-5 py-3">Department</th>
              <th className="px-5 py-3">Justification</th>
              <th className="px-5 py-3">Requested Date</th>
              <th className="px-5 py-3">Approved By</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRequests.map((request) => (
              <tr key={request.id} className="hover:bg-blue-50/50">
                <td className="px-5 py-4 font-semibold text-slate-950">#{request.id}</td>
                <td className="px-5 py-4">
                  <p className="font-semibold text-slate-950">
                    {request.requesterFullName || request.requesterName || request.requesterLogin} <span className="font-medium text-slate-500">({roleLabel(request.requesterRole)})</span>
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-600">{request.requesterEmployeeId || request.requesterId}</p>
                  <p className="mt-1 text-xs text-slate-500">{request.requesterDepartment || "Unassigned"}</p>
                </td>
                <td className="px-5 py-4 font-medium text-slate-800">{request.assetType}</td>
                <td className="px-5 py-4 text-slate-600">{request.department || request.requesterDepartment || "Unassigned"}</td>
                <td className="max-w-xs px-5 py-4 text-slate-600">{request.justification}</td>
                <td className="px-5 py-4 text-slate-600">{new Date(request.requestedAt || request.createdAt).toLocaleString()}</td>
                <td className="px-5 py-4 text-slate-600">{request.approvedBy || request.decidedByLogin || "Pending"}</td>
                <td className="px-5 py-4"><StatusBadge status={request.status} /></td>
                <td className="px-5 py-4">
                  {request.status === "pending" ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={decidingId === request.id}
                        onClick={() => decide(request.id, "approved")}
                        className="rounded-md bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={decidingId === request.id}
                        onClick={() => decide(request.id, "rejected")}
                        className="rounded-md bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  ) : <span className="text-xs text-slate-500">Decision recorded</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filteredRequests.length ? (
        <div className="p-8 text-center text-sm text-slate-500">{loading ? "Loading asset requests..." : "No asset requests found for this filter."}</div>
      ) : null}
    </section>
  );
}
