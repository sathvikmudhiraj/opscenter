"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import type { UserRole } from "@/types/auth";

export function RoleGuard({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const user = getSessionUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== role) {
      router.replace(`/${user.role}/dashboard`);
      return;
    }
    setAllowed(true);
  }, [role, router]);

  if (!allowed) {
    return <div className="grid min-h-screen place-items-center bg-slate-950 text-sm font-medium text-white">Validating access...</div>;
  }

  return children;
}
