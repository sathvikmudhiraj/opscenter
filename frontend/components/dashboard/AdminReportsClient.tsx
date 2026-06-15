"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { api } from "@/lib/api";

type ChartRow = { LABEL?: string; VALUE?: number; label?: string; value?: number };
type TicketTrendRange = "24h" | "7d" | "30d";
type TicketTrendRow = {
  label: string;
  createdTickets: number;
  resolvedTickets: number;
  openBacklog: number;
};
type ReportsResponse = {
  stats?: {
    totalTickets?: number;
    openTickets?: number;
    closedTickets?: number;
    activeEngineers?: number;
    slaCompliance?: {
      value: number | null;
      label: string;
      subtitle: string;
    };
    assetCount?: number;
    securityAlerts?: number;
    notifications?: number;
  };
  charts?: {
    byStatus?: ChartRow[];
    byPriority?: ChartRow[];
    ticketTrend?: TicketTrendRow[];
    engineerPerformance?: ChartRow[];
  };
};

type SlaDistributionResponse = {
  data?: ChartRow[];
};

function normalizeRows(rows?: ChartRow[]) {
  return Array.isArray(rows) ? rows.map((row) => ({
    label: String(row.label ?? row.LABEL ?? "Unknown"),
    value: Number(row.value ?? row.VALUE ?? 0)
  })) : [];
}

export function AdminReportsClient() {
  const [data, setData] = useState<ReportsResponse>({});
  const [ticketTrendRange, setTicketTrendRange] = useState<TicketTrendRange>("24h");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ticketCategories, setTicketCategories] = useState<Array<{ label: string; value: number }>>([]);
  const [slaDistribution, setSlaDistribution] = useState<Array<{ label: string; value: number }>>([]);
  const [assetStatus, setAssetStatus] = useState<Array<{ label: string; value: number }>>([]);
  const [departmentDistribution, setDepartmentDistribution] = useState<Array<{ label: string; value: number }>>([]);
  const [engineerPerformanceDonut, setEngineerPerformanceDonut] = useState<Array<{ label: string; value: number }>>([]);
  const [engineerPerformanceRaw, setEngineerPerformanceRaw] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    const fetchReports = async () => {
      try {
        const reportsResp = await api.get<{ data?: ReportsResponse }>(`/reports?ticketTrendRange=${ticketTrendRange}`);
        if (!active) return;
        setData(reportsResp.data.data || {});
        setError("");
      } catch (requestError) {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "Reports could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchReports();
    return () => {
      active = false;
    };
  }, [ticketTrendRange]);

  useEffect(() => {
    let active = true;
    const fetchAuxiliaryReports = async () => {
      try {
        const ticketCategoriesResp = await api.get("/reports/ticket-categories");
        if (!active) return;
        setTicketCategories(normalizeRows(ticketCategoriesResp.data.data || []));

        const slaDistributionResp = await api.get<SlaDistributionResponse>("/reports/sla-distribution");
        if (!active) return;
        if (slaDistributionResp.data?.data) {
          setSlaDistribution(normalizeRows(slaDistributionResp.data.data));
        } else {
          setSlaDistribution([]);
        }

        const assetStatusResp = await api.get("/reports/asset-status");
        if (!active) return;
        setAssetStatus(normalizeRows(assetStatusResp.data.data || []));

        const departmentDistributionResp = await api.get("/reports/department-distribution");
        if (!active) return;
        setDepartmentDistribution(normalizeRows(departmentDistributionResp.data.data || []));

        const engineerPerformanceResp = await api.get("/reports/engineer-performance");
        if (!active) return;
        const engineerData = engineerPerformanceResp.data.data || [];
        setEngineerPerformanceRaw(engineerData);
        setEngineerPerformanceDonut(
          normalizeRows(
            engineerData.map((engineer: any) => ({
              label: engineer.engineerName,
              value: engineer.resolvedTicketCount
            }))
          )
        );
      } catch (requestError) {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "Reports could not be loaded.");
      }
    };

    fetchAuxiliaryReports();
    return () => {
      active = false;
    };
  }, []);

  // Compute charts data for the existing charts (without useMemo)
  const byStatus = normalizeRows(data.charts?.byStatus);
  const byPriority = normalizeRows(data.charts?.byPriority);
  const ticketTrend = Array.isArray(data.charts?.ticketTrend) ? data.charts.ticketTrend : [];
  const engineerPerformance = normalizeRows(data.charts?.engineerPerformance);

  if (loading) return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Loading reports...</div>;
  if (error) return <div className="rounded-lg border border-red-200 bg-white p-6 text-sm text-red-700 shadow-sm">{error}</div>;

  return (
    <div className="space-y-6">
      {/* Existing charts */}
      <div className="gap-5 xl:grid-cols-2">
        <ReportChart title="Tickets by Status" data={byStatus} type="bar" />
        <ReportChart title="Tickets by Priority" data={byPriority} type="bar" />
        <TicketTrendChart data={ticketTrend} range={ticketTrendRange} onRangeChange={setTicketTrendRange} />
        <ReportChart title="Engineer Workload" data={engineerPerformance} type="bar" />
      </div>

      {/* New donut charts */}
      <div className="gap-5 xl:grid-cols-3">
        {/* Ticket Categories */}
        <DonutChart title="Ticket Categories" data={ticketCategories} formatter={(value) => `${value} tickets`} />
        
        {/* SLA Compliance */}
        {slaDistribution.length > 0 ? (
          <>
            <DonutChart 
              title="SLA Compliance" 
              data={slaDistribution} 
              formatter={(value) => `${value} tickets`} 
            />
            <div className="mt-2 text-sm text-slate-600">
              <p>Compliance: {Math.round((slaDistribution.find(d => d.label === "Within SLA")?.value || 0) / 
                (slaDistribution.reduce((sum, d) => sum + d.value, 0) || 1) * 100)}%</p>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">SLA Compliance</h2>
            <div className="mt-4 h-72 w-full flex items-center justify-center">
              <p className="text-sm text-slate-500">No SLA data</p>
            </div>
          </div>
        )}
        
        {/* Asset Status */}
        <DonutChart title="Asset Status" data={assetStatus} formatter={(value) => `${value} assets`} />
        
        {/* Department Distribution */}
        <DonutChart title="Department Distribution" data={departmentDistribution} formatter={(value) => `${value} tickets`} />
        
        {/* Engineer Resolution Share */}
        {engineerPerformanceDonut.length > 0 ? (
          <DonutChart 
            title="Engineer Resolution Share" 
            data={engineerPerformanceDonut} 
            formatter={(value, name) => {
              // Find the percentage from the original raw data
              const engineer = engineerPerformanceRaw.find((e: any) => e.engineerName === name);
              const percentage = engineer ? engineer.percentageContribution : 0;
              return `${value} tickets (${percentage}%)`;
            }}
          />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">Engineer Resolution Share</h2>
            <div className="mt-4 h-72 w-full flex items-center justify-center">
              <p className="text-sm text-slate-500">No resolved tickets yet</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TicketTrendChart({ data, range, onRangeChange }: { data: TicketTrendRow[]; range: TicketTrendRange; onRangeChange: (range: TicketTrendRange) => void }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Ticket Trend</h2>
          <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-700" />Created Tickets</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />Resolved Tickets</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Open Backlog</span>
          </div>
        </div>
        <div className="inline-flex rounded-md border border-slate-300 bg-slate-50 p-1">
          {(["24h", "7d", "30d"] as TicketTrendRange[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onRangeChange(item)}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition ${range === item ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-white"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 h-72">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 288 }}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="createdTickets" name="Created Tickets" stroke="#1d4ed8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="resolvedTickets" name="Resolved Tickets" stroke="#059669" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="openBacklog" name="Open Backlog" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : <div className="grid h-full place-items-center text-sm text-slate-500">No ticket trend data yet.</div>}
      </div>
    </section>
  );
}

function ReportChart({ title, data, type }: { title: string; data: Array<{ label: string; value: number }>; type: "bar" | "line" }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 h-72">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 288 }}>
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
