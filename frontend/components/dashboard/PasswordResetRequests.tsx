"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, X } from "lucide-react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/tickets/StatusBadge";

type ResetRequest = {
  id: number;
  username: string;
  fullName: string;
  role: string;
  department: string;
  requestedAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
};

type PasswordPolicy = {
  minimumPasswordLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialCharacters: boolean;
};

const fallbackPolicy: PasswordPolicy = {
  minimumPasswordLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialCharacters: false
};

export function PasswordResetRequests() {
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [message, setMessage] = useState("");
  const [resetting, setResetting] = useState<ResetRequest | null>(null);
  const [passwords, setPasswords] = useState({ temporaryPassword: "", confirmPassword: "" });
  const [policy, setPolicy] = useState<PasswordPolicy>(fallbackPolicy);

  async function load() {
    const [{ data }, settings] = await Promise.all([
      api.get<{ data: ResetRequest[] }>("/password-resets"),
      api.get<{ data?: { security?: Partial<PasswordPolicy> } }>("/settings").catch(() => ({ data: { data: { security: fallbackPolicy } } }))
    ]);
    setRequests(data.data || []);
    setPolicy({ ...fallbackPolicy, ...(settings.data.data?.security || {}) });
  }

  useEffect(() => {
    load().catch(() => setRequests([]));
  }, []);

  async function setStatus(request: ResetRequest, status: "APPROVED" | "REJECTED") {
    setMessage("");
    await api.patch(`/password-resets/${request.id}/status`, { status });
    await load();
  }

  async function openReset(request: ResetRequest) {
    const { data } = await api.get<{ data: { temporaryPassword: string } }>("/password-resets/generate");
    setPasswords({ temporaryPassword: data.data.temporaryPassword, confirmPassword: data.data.temporaryPassword });
    setResetting(request);
  }

  async function completeReset(event: FormEvent) {
    event.preventDefault();
    if (!resetting) return;
    setMessage("");
    const validation = validateTemporaryPassword(passwords.temporaryPassword, passwords.confirmPassword, policy);
    if (validation) {
      setMessage(validation);
      return;
    }
    try {
      await api.post(`/password-resets/${resetting.id}/complete`, passwords);
      setMessage(`${resetting.username} password reset completed. Temporary password: ${passwords.temporaryPassword}`);
      setResetting(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not complete password reset.");
    }
  }

  return (
    <section className="space-y-4">
      {message ? <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">{message}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Request ID</th>
              <th className="px-5 py-3">Username</th>
              <th className="px-5 py-3">Full Name</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Department</th>
              <th className="px-5 py-3">Requested Date</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map((request) => (
              <tr key={request.id} className="hover:bg-blue-50/50">
                <td className="px-5 py-4 font-semibold">#{request.id}</td>
                <td className="px-5 py-4 font-semibold text-slate-950">{request.username}</td>
                <td className="px-5 py-4">{request.fullName}</td>
                <td className="px-5 py-4 capitalize">{request.role}</td>
                <td className="px-5 py-4">{request.department || "Unassigned"}</td>
                <td className="px-5 py-4">{new Date(request.requestedAt).toLocaleString()}</td>
                <td className="px-5 py-4"><StatusBadge status={request.status.toLowerCase()} /></td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    <button disabled={request.status !== "PENDING"} onClick={() => setStatus(request, "APPROVED")} className="rounded-md border border-green-200 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50">Approve</button>
                    <button disabled={request.status !== "PENDING"} onClick={() => setStatus(request, "REJECTED")} className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Reject</button>
                    <button disabled={request.status === "REJECTED" || request.status === "COMPLETED"} onClick={() => openReset(request)} className="rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50">Reset Password</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!requests.length ? <div className="p-8 text-center text-sm text-slate-500">No password reset requests yet.</div> : null}
      </div>

      {resetting ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={completeReset} className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Reset Password</h2>
                <p className="mt-1 text-sm text-slate-500">{resetting.username}</p>
              </div>
              <button type="button" onClick={() => setResetting(null)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-5 space-y-4">
              <Field label="Temporary Password" value={passwords.temporaryPassword} onChange={(temporaryPassword) => setPasswords({ ...passwords, temporaryPassword })} />
              <Field label="Confirm Password" value={passwords.confirmPassword} onChange={(confirmPassword) => setPasswords({ ...passwords, confirmPassword })} />
              <p className="rounded-md bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{policyText(policy)}</p>
            </div>
            <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800">
              <KeyRound className="h-4 w-4" />
              Complete Reset
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function validateTemporaryPassword(password: string, confirmPassword: string, policy: PasswordPolicy) {
  if (password !== confirmPassword) return "Passwords must match.";
  if (password.length < policy.minimumPasswordLength) return `Password must be at least ${policy.minimumPasswordLength} characters.`;
  if (policy.requireUppercase && !/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (policy.requireLowercase && !/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (policy.requireNumbers && !/[0-9]/.test(password)) return "Password must include a number.";
  if (policy.requireSpecialCharacters && !/[^A-Za-z0-9]/.test(password)) return "Password must include a special character.";
  return "";
}

function policyText(policy: PasswordPolicy) {
  const requirements = [`${policy.minimumPasswordLength}+ characters`];
  if (policy.requireUppercase) requirements.push("uppercase");
  if (policy.requireLowercase) requirements.push("lowercase");
  if (policy.requireNumbers) requirements.push("number");
  if (policy.requireSpecialCharacters) requirements.push("special character");
  return `Password policy: ${requirements.join(", ")}.`;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input required value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
    </label>
  );
}
