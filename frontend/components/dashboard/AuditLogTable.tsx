"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type AuditLog = { id: number; user: string; action: string; timestamp: string; details: string };

export function AuditLogTable() {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    api.get<{ data: AuditLog[] }>("/notifications/audit-logs").then(({ data }) => setLogs(data.data)).catch(() => setLogs([]));
  }, []);

  return (
    <section className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">User</th>
            <th className="px-5 py-3">Action</th>
            <th className="px-5 py-3">Time</th>
            <th className="px-5 py-3">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="px-5 py-4 font-semibold text-slate-900">{log.user}</td>
              <td className="px-5 py-4 text-slate-700">{log.action}</td>
              <td className="px-5 py-4 text-slate-700">{new Date(log.timestamp).toLocaleString()}</td>
              <td className="px-5 py-4 text-slate-700">{log.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
