"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { UserRole } from "@/types/auth";

type ManagedUser = {
  id: number;
  name: string;
  loginId: string;
  role: UserRole;
  status: string;
};

const roleOptions: UserRole[] = ["employee", "engineer", "admin"];

export function UserRoleManager() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  async function loadUsers() {
    const { data } = await api.get<{ data: ManagedUser[] }>("/users");
    setUsers(data.data);
  }

  useEffect(() => {
    loadUsers().catch(() => setMessage("Could not load users. Login as admin and retry."));
  }, []);

  async function changeRole(user: ManagedUser, role: UserRole) {
    setSavingId(user.id);
    setMessage("");
    try {
      await api.patch(`/users/${user.id}/role`, { role });
      await loadUsers();
      setMessage(`${user.loginId} now routes to /${role}/dashboard`);
    } catch {
      setMessage("Could not update role.");
    } finally {
      setSavingId(null);
    }
  }

  async function changeStatus(user: ManagedUser) {
    setSavingId(user.id);
    setMessage("");
    try {
      const status = user.status === "active" ? "disabled" : "active";
      await api.patch(`/users/${user.id}/status`, { status });
      await loadUsers();
      setMessage(`${user.loginId} is now ${status}`);
    } catch {
      setMessage("Could not update user status.");
    } finally {
      setSavingId(null);
    }
  }

  async function resetPassword(user: ManagedUser) {
    setSavingId(user.id);
    setMessage("");
    try {
      await api.post(`/users/${user.id}/reset-password`);
      setMessage(`${user.loginId} password reset to Ops@12345`);
    } catch {
      setMessage("Could not reset password.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section id="users" className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950">User Role Assignment</h2>
        <p className="mt-1 text-sm text-slate-600">Set each login ID to the dashboard it should open after sign-in.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Login ID</th>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Current Role</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Dashboard</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-blue-50/50">
                <td className="px-5 py-4 font-semibold text-slate-900">{user.loginId}</td>
                <td className="px-5 py-4 text-slate-700">{user.name}</td>
                <td className="px-5 py-4">
                  <select
                    className="w-40 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm capitalize outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                    value={user.role}
                    disabled={savingId === user.id || user.loginId === "admin"}
                    onChange={(event) => changeRole(user, event.target.value as UserRole)}
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-4 capitalize text-slate-700">{user.status}</td>
                <td className="px-5 py-4 text-slate-700">/{user.role}/dashboard</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={savingId === user.id || user.loginId === "admin"} onClick={() => changeStatus(user)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                      {user.status === "active" ? "Disable" : "Enable"}
                    </button>
                    <button type="button" disabled={savingId === user.id} onClick={() => resetPassword(user)} className="rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                      Reset password
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message ? <p className="border-t border-slate-200 px-5 py-3 text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
