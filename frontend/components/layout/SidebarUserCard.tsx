"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { getSessionUser, saveSessionUser } from "@/lib/auth";
import type { AuthUser, UserRole } from "@/types/auth";

type UserProfile = AuthUser & {
  userId?: number;
  loginId?: string;
  fullName?: string;
  employeeId?: string;
  department?: string;
};

function roleLabel(role: UserRole) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function SidebarUserCard({ role }: { role: UserRole }) {
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const sessionUser = getSessionUser();
    if (sessionUser) setUser(sessionUser);

    let active = true;
    api.get<{ data?: UserProfile }>("/auth/me")
      .then(({ data }) => {
        if (!active || !data.data) return;
        const profile = {
          ...sessionUser,
          ...data.data,
          id: data.data.id || data.data.userId || sessionUser?.id || 0,
          name: data.data.fullName || data.data.name || data.data.username || sessionUser?.name || "",
          username: data.data.username || data.data.loginId || sessionUser?.username || "",
          email: data.data.email || sessionUser?.email || "",
          role: data.data.role || sessionUser?.role || role
        };
        setUser(profile);
        saveSessionUser(profile);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [role]);

  const fullName = user?.fullName || user?.name || user?.username || "Signed in user";
  const identifier = user?.employeeId || String(user?.id || "Unknown");
  const department = user?.department || "Unassigned";

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-blue-600/20 text-blue-200">
          <UserRound className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{fullName}</p>
          <p className="mt-1 truncate text-xs text-slate-400">ID: {identifier}</p>
          <p className="mt-1 text-xs text-slate-300">Role: {roleLabel(role)}</p>
          {role !== "admin" ? <p className="mt-1 truncate text-xs text-slate-400">Dept: {department}</p> : null}
        </div>
      </div>
    </section>
  );
}
