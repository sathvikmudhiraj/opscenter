"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { clearSession, getSessionToken, getSessionUser } from "@/lib/auth";
import type { UserRole } from "@/types/auth";
import { TicketDetailView } from "./TicketDetailView";

type TicketDetailRouteProps = {
  id: string;
};

const DETAIL_ROLES: UserRole[] = ["employee", "admin"];

export function TicketDetailRoute({ id }: TicketDetailRouteProps) {
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const token = getSessionToken();
    const user = getSessionUser();

    if (!token || !user) {
      clearSession();
      window.location.replace("/login");
      return;
    }

    if (user.forcePasswordChange) {
      window.location.replace("/change-password");
      return;
    }

    if (user.role === "engineer") {
      window.location.replace(`/engineer/tickets/${encodeURIComponent(id)}`);
      return;
    }

    if (!DETAIL_ROLES.includes(user.role)) {
      clearSession();
      window.location.replace("/login");
      return;
    }

    setRole(user.role);
  }, [id]);

  if (!role) {
    return <div className="grid min-h-screen place-items-center bg-slate-950 text-sm font-medium text-white">Opening ticket...</div>;
  }

  const copy = role === "admin"
    ? {
        title: "Ticket Detail",
        subtitle: "Review ticket context, requester details, evidence, and engineer updates."
      }
    : {
        title: "My Ticket Detail",
        subtitle: "Track support progress, assigned engineer, and service history."
      };

  return (
    <DashboardShell role={role} title={copy.title} subtitle={copy.subtitle}>
      <TicketDetailView id={id} />
    </DashboardShell>
  );
}
