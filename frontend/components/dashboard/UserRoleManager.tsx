"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import type { UserRole } from "@/types/auth";

type ManagedUser = {
  id: number;
  userId?: number;
  name: string;
  fullName?: string;
  username?: string;
  loginId: string;
  email?: string;
  role: UserRole;
  department?: string;
  employeeId?: string;
  phone?: string;
  status: "active" | "inactive" | "disabled";
  createdAt?: string;
  updatedAt?: string;
};

const roleOptions: UserRole[] = ["employee", "engineer", "admin"];
const statusOptions = ["all", "active", "inactive", "disabled"];
const emptyForm = {
  fullName: "",
  username: "",
  email: "",
  password: "",
  role: "employee" as UserRole,
  department: "",
  employeeId: "",
  phone: "",
  status: "active" as ManagedUser["status"]
};

let usersRequest: Promise<ManagedUser[]> | null = null;
let cachedUsers: ManagedUser[] | null = null;
let cachedUsersAt = 0;

async function fetchManagedUsers(force = false) {
  if (!force && cachedUsers && Date.now() - cachedUsersAt < 5000) return cachedUsers;
  if (!force && usersRequest) return usersRequest;
  usersRequest = api.get<{ data?: ManagedUser[] }>("/users")
    .then(({ data }) => {
      cachedUsers = Array.isArray(data.data) ? data.data : [];
      cachedUsersAt = Date.now();
      return cachedUsers;
    })
    .finally(() => {
      usersRequest = null;
    });
  return usersRequest;
}

export function UserRoleManager() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ search: "", role: "all", department: "all", status: "all" });
  const [manualUnlockEnabled, setManualUnlockEnabled] = useState(true);

  async function loadUsers(force = false) {
    setLoading(true);
    try {
      setUsers(await fetchManagedUsers(force));
      setError("");
    } catch (requestError) {
      setUsers([]);
      setError(requestError instanceof Error ? requestError.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    api.get<{ data?: { security?: { adminManualUnlockEnabled?: boolean } } }>("/settings")
      .then(({ data }) => setManualUnlockEnabled(data.data?.security?.adminManualUnlockEnabled !== false))
      .catch(() => setManualUnlockEnabled(true));
  }, []);

  const departments = useMemo(() => ["all", ...Array.from(new Set(users.map((user) => user.department).filter(Boolean))) as string[]], [users]);
  const visible = useMemo(() => users.filter((user) => {
    const haystack = `${user.id} ${user.fullName || user.name} ${user.username || user.loginId} ${user.email || ""} ${user.department || ""} ${user.employeeId || ""} ${user.phone || ""}`.toLowerCase();
    return (
      haystack.includes(filters.search.toLowerCase()) &&
      (filters.role === "all" || user.role === filters.role) &&
      (filters.department === "all" || user.department === filters.department) &&
      (filters.status === "all" || user.status === filters.status)
    );
  }), [filters, users]);

  function openCreate(role: UserRole = "employee") {
    setEditing(null);
    setForm({ ...emptyForm, role });
    setMessage("");
    setError("");
    setModalOpen(true);
  }

  function openEdit(user: ManagedUser) {
    setEditing(user);
    setForm({
      fullName: user.fullName || user.name || "",
      username: user.username || user.loginId || "",
      email: user.email || "",
      password: "",
      role: user.role,
      department: user.department || "",
      employeeId: user.employeeId || "",
      phone: user.phone || "",
      status: user.status || "active"
    });
    setMessage("");
    setError("");
    setModalOpen(true);
  }

  async function saveUser(event: FormEvent) {
    event.preventDefault();
    setSavingId(editing?.id || -1);
    setError("");
    setMessage("");
    try {
      if (editing) {
        const { password: _password, ...payload } = form;
        await api.patch(`/users/${editing.id}`, payload);
        setMessage(`${form.username} updated.`);
      } else {
        await api.post("/users", form);
        setMessage(`${form.username} created.`);
      }
      setModalOpen(false);
      await loadUsers(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save user.");
    } finally {
      setSavingId(null);
    }
  }

  async function changeRole(user: ManagedUser, role: UserRole) {
    setSavingId(user.id);
    setMessage("");
    try {
      await api.patch(`/users/${user.id}/role`, { role });
      await loadUsers(true);
      setMessage(`${user.loginId} now routes to /${role}/dashboard`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update role.");
    } finally {
      setSavingId(null);
    }
  }

  async function changeStatus(user: ManagedUser) {
    setSavingId(user.id);
    setMessage("");
    try {
      const status = user.status === "active" ? "inactive" : "active";
      await api.patch(`/users/${user.id}/status`, { status });
      await loadUsers(true);
      setMessage(`${user.loginId} is now ${status}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update user status.");
    } finally {
      setSavingId(null);
    }
  }

  async function resetPassword(user: ManagedUser) {
    setSavingId(user.id);
    setMessage("");
    try {
      const { data } = await api.post<{ data?: { temporaryPassword?: string } }>(`/users/${user.id}/reset-password`);
      const temporaryPassword = data.data?.temporaryPassword;
      setMessage(temporaryPassword ? `${user.loginId} password reset. Temporary password: ${temporaryPassword}` : `${user.loginId} password reset.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not reset password.");
    } finally {
      setSavingId(null);
    }
  }

  async function unlockAccount(user: ManagedUser) {
    setSavingId(user.id);
    setMessage("");
    setError("");
    try {
      await api.post("/users/unlock-account", { username: user.username || user.loginId });
      setMessage("Account unlocked");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not unlock account.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteUser(user: ManagedUser) {
    if (!window.confirm(`Permanently delete ${user.loginId}? Password-reset records and optional assignments linked to this user will also be cleared.`)) return;
    setSavingId(user.id);
    setMessage("");
    try {
      await api.delete(`/users/${user.id}`);
      await loadUsers(true);
      setMessage(`${user.loginId} deleted.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not delete user.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section id="users" className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">User Management</h2>
          <p className="mt-1 text-sm text-slate-600">Create employees, engineers, and admins with role-based access.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openCreate("employee")} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Plus className="h-4 w-4" />
            Add Employee
          </button>
          <button type="button" onClick={() => openCreate("engineer")} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">
            <Plus className="h-4 w-4" />
            Add Engineer
          </button>
        </div>
      </div>

      <div className="grid gap-3 border-b border-slate-200 p-5 md:grid-cols-4">
        <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search users" className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
        <Select value={filters.role} onChange={(role) => setFilters({ ...filters, role })} options={["all", ...roleOptions]} />
        <Select value={filters.department} onChange={(department) => setFilters({ ...filters, department })} options={departments} />
        <Select value={filters.status} onChange={(status) => setFilters({ ...filters, status })} options={statusOptions} />
      </div>

      {error ? <p className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm font-medium text-red-700">{error}</p> : null}
      {message ? <p className="border-b border-slate-200 px-5 py-3 text-sm text-slate-600">{message}</p> : null}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">User ID</th>
              <th className="px-5 py-3">Full Name</th>
              <th className="px-5 py-3">Username</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Department</th>
              <th className="px-5 py-3">Employee ID</th>
              <th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3">Updated</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && visible.map((user) => (
              <tr key={user.id} className="hover:bg-blue-50/50">
                <td className="px-5 py-4 font-semibold text-slate-900">#{user.id}</td>
                <td className="px-5 py-4 text-slate-700">{user.fullName || user.name}</td>
                <td className="px-5 py-4 font-semibold text-slate-900">{user.username || user.loginId}</td>
                <td className="px-5 py-4 text-slate-700">{user.email || "N/A"}</td>
                <td className="px-5 py-4">
                  <select
                    className="w-36 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm capitalize outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                    value={user.role}
                    disabled={savingId === user.id || user.loginId === "admin"}
                    onChange={(event) => changeRole(user, event.target.value as UserRole)}
                  >
                    {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </td>
                <td className="px-5 py-4 text-slate-700">{user.department || "Unassigned"}</td>
                <td className="px-5 py-4 text-slate-700">{user.employeeId || "N/A"}</td>
                <td className="px-5 py-4 text-slate-700">{user.phone || "N/A"}</td>
                <td className="px-5 py-4 capitalize text-slate-700">{user.status}</td>
                <td className="px-5 py-4 text-slate-700">{formatDateTime(user.createdAt)}</td>
                <td className="px-5 py-4 text-slate-700">{formatDateTime(user.updatedAt)}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={savingId === user.id} onClick={() => openEdit(user)} className="rounded-md border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50" aria-label="Edit user">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button type="button" disabled={savingId === user.id || user.loginId === "admin"} onClick={() => changeStatus(user)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                      {user.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                    <button type="button" disabled={savingId === user.id} onClick={() => resetPassword(user)} className="rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                      Reset
                    </button>
                    <button type="button" disabled={savingId === user.id || !manualUnlockEnabled} onClick={() => unlockAccount(user)} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50">
                      Unlock Account
                    </button>
                    <button type="button" disabled={savingId === user.id || user.loginId === "admin"} onClick={() => deleteUser(user)} className="rounded-md border border-red-200 p-2 text-red-700 hover:bg-red-50 disabled:opacity-50" aria-label="Delete user">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? <div className="p-8 text-center text-sm text-slate-500">Loading users...</div> : null}
        {!loading && !visible.length ? <div className="p-8 text-center text-sm text-slate-500">No users found.</div> : null}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4">
          <form onSubmit={saveUser} className="w-full max-w-3xl rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">{editing ? "Edit User" : "Add User"}</h3>
                <p className="mt-1 text-sm text-slate-500">Manage identity, role, department, and account status.</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field required label="Full Name" value={form.fullName} onChange={(fullName) => setForm({ ...form, fullName })} />
              <Field required label="Username" value={form.username} onChange={(username) => setForm({ ...form, username })} />
              <Field required label="Email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
              {!editing ? <Field required label="Password" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} /> : null}
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Role</span>
                <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm capitalize outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
                  {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
              <Field label="Department" value={form.department} onChange={(department) => setForm({ ...form, department })} />
              <Field required label="Employee ID" value={form.employeeId} onChange={(employeeId) => setForm({ ...form, employeeId })} />
              <Field label="Phone Number" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Status</span>
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ManagedUser["status"] })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm capitalize outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={savingId !== null} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{editing ? "Save Changes" : "Create User"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
    </label>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString();
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm capitalize outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}
