"use client";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { TicketTable } from "@/components/dashboard/TicketTable";
import { UserRoleManager } from "@/components/dashboard/UserRoleManager";
import { AdminMetrics } from "@/components/dashboard/AdminMetrics";
import { InfrastructureMonitoring } from "@/components/dashboard/InfrastructureMonitoring";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AdminDashboard() {
  const [ticketCategories, setTicketCategories] = useState<Array<{ label: string; value: number }>>([]);
  const [slaDistribution, setSlaDistribution] = useState<Array<{ label: string; value: number }>>([]);
  const [assetStatus, setAssetStatus] = useState<Array<{ label: string; value: number }>>([]);
  const [departmentDistribution, setDepartmentDistribution] = useState<Array<{ label: string; value: number }>>([]);

  // Normalize function to handle Oracle's uppercase field names
  const normalizeRows = (rows?: any[]) => {
    return Array.isArray(rows) ? rows.map((row) => ({
      label: String(row.label ?? row.LABEL ?? "Unknown"),
      value: Number(row.value ?? row.VALUE ?? 0)
    })) : [];
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Delay function to prevent 429 errors
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        // Ticket Categories
        const ticketCategoriesResp = await api.get("/reports/ticket-categories");
        console.log("Ticket Categories API response:", ticketCategoriesResp.data);
        setTicketCategories(normalizeRows(ticketCategoriesResp.data.data || []));
        await delay(800);

        // SLA Distribution
        const slaDistributionResp = await api.get("/reports/sla-distribution");
        console.log("SLA Distribution API response:", slaDistributionResp.data);
        setSlaDistribution(normalizeRows(slaDistributionResp.data.data || []));
        await delay(800);

        // Asset Status
        const assetStatusResp = await api.get("/reports/asset-status");
        console.log("Asset Status API response:", assetStatusResp.data);
        setAssetStatus(normalizeRows(assetStatusResp.data.data || []));
        await delay(800);

        // Department Distribution
        const departmentDistributionResp = await api.get("/reports/department-distribution");
        console.log("Department Distribution API response:", departmentDistributionResp.data);
        setDepartmentDistribution(normalizeRows(departmentDistributionResp.data.data || []));
      } catch (error) {
        console.error("Failed to fetch dashboard chart data:", error);
      }
    };

    fetchData();
  }, []);

  return (
    <DashboardShell role="admin" title="Operations Command Center" subtitle="Control users, support capacity, assets, security posture, and enterprise service levels.">
      <AdminMetrics />
      <InfrastructureMonitoring />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DonutChart title="Ticket Category Distribution" data={ticketCategories} />
        <DonutChart title="SLA Compliance Distribution" data={slaDistribution} />
        <DonutChart title="Asset Status Distribution" data={assetStatus} />
        <DonutChart title="Department Ticket Distribution" data={departmentDistribution} />
      </div>
      <UserRoleManager />
      <TicketTable />
    </DashboardShell>
  );
}
