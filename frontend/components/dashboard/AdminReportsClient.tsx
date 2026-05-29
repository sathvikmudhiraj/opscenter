"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";

type ChartRow = { LABEL?: string; VALUE?: number; label?: string; value?: number };
type ReportsResponse = {
  stats?: Record<string, number>;
  charts?: {
    byStatus?: ChartRow[];
    byPriority?: ChartRow[];
    ticketTrend?: ChartRow[];
    engineerPerformance?: ChartRow[];
  };
};

function normalizeRows(rows?: ChartRow[]) {
  return Array.isArray(rows) ? rows.map((row) => ({
    label: String(row.label ?? row.LABEL ?? "Unknown"),
    value: Number(row.value ?? row.VALUE ?? 0)
  })) : [];
}

export function AdminReportsClient() {
  const [data, setData] = useState<ReportsResponse>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get<{ data?: ReportsResponse }>("/reports")
      .then(({ data: response }) => {
        if (!active) return;
        setData(response.data || {});
        setError("");
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "Reports could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const charts = useMemo(() => ({
    byStatus: normalizeRows(data.charts?.byStatus),
    byPriority: normalizeRows(data.charts?.byPriority),
    ticketTrend: normalizeRows(data.charts?.ticketTrend),
    engineerPerformance: normalizeRows(data.charts?.engineerPerformance)
  }), [data]);

  if (loading) return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Loading reports...</div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-white p-6 text-sm text-red-700 shadow-sm">{error}</div>;

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ReportChart title="Tickets by Status" data={charts.byStatus} type="bar" />
      <ReportChart title="Tickets by Priority" data={charts.byPriority} type="bar" />
      <ReportChart title="Ticket Trend" data={charts.ticketTrend} type="line" />
      <ReportChart title="Engineer Workload" data={charts.engineerPerformance} type="bar" />
    </div>
  );
}

function ReportChart({ title, data, type }: { title: string; data: Array<{ label: string; value: number }>; type: "bar" | "line" }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 h-72">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            {type === "bar" ? (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#1d4ed8" strokeWidth={2} />
              </LineChart>
            )}
          </ResponsiveContainer>
        ) : <div className="grid h-full place-items-center text-sm text-slate-500">No report data yet.</div>}
      </div>
    </section>
  );
}

