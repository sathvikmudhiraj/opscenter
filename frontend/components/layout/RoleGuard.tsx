"use client";

import { useEffect, useState } from "react";
import { clearSession, getSessionUser } from "@/lib/auth";
import type { UserRole } from "@/types/auth";

const VALID_ROLES: UserRole[] = ["employee", "engineer", "admin"];

export function RoleGuard({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("Validating access...");

  useEffect(() => {
    let redirected = false;

    const redirect = (path: string) => {
      redirected = true;
      window.location.replace(path);
    };

    const fallback = window.setTimeout(() => {
      if (!redirected) {
        clearSession();
        redirect("/login");
      }
    }, 2500);

    const user = getSessionUser();
    if (!user || !VALID_ROLES.includes(user.role)) {
      clearSession();
      setMessage("Redirecting to login...");
      redirect("/login");
      return () => window.clearTimeout(fallback);
    }

    if (user.role !== role) {
      setMessage("Redirecting to your dashboard...");
      redirect(`/${user.role}/dashboard`);
      return () => window.clearTimeout(fallback);
    }

    if (user.forcePasswordChange) {
      setMessage("Redirecting to password change...");
      redirect("/change-password");
      return () => window.clearTimeout(fallback);
    }

    redirected = true;
    window.clearTimeout(fallback);
    setAllowed(true);

    return () => window.clearTimeout(fallback);
  }, [role]);

  if (!allowed) {
    return <div className="grid min-h-screen place-items-center bg-slate-950 text-sm font-medium text-white">{message}</div>;
  }

  return children;
}
