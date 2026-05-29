"use client";

import { FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";
import { api } from "@/lib/api";
import { getDashboardPath, getSessionUser, saveSessionUser } from "@/lib/auth";

export default function ChangePasswordPage() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const user = getSessionUser();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      await api.post("/password-resets/change-password", form);
      if (user) {
        saveSessionUser({ ...user, forcePasswordChange: false });
        window.location.assign(getDashboardPath(user.role));
      } else {
        window.location.assign("/login");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not change password.");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-5 text-white">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-lg border border-white/10 bg-slate-900/80 p-7 shadow-2xl">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-300">Required Action</p>
          <h1 className="mt-2 text-3xl font-semibold">Change Password</h1>
          <p className="mt-2 text-sm text-slate-400">You are using a temporary password. Create a new password to continue.</p>
        </div>
        <Field label="Current Password" value={form.currentPassword} onChange={(currentPassword) => setForm({ ...form, currentPassword })} />
        <Field label="New Password" value={form.newPassword} onChange={(newPassword) => setForm({ ...form, newPassword })} />
        <Field label="Confirm Password" value={form.confirmPassword} onChange={(confirmPassword) => setForm({ ...form, confirmPassword })} />
        {message ? <p className="mt-4 rounded-md border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200">{message}</p> : null}
        <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500">
          <KeyRound className="h-4 w-4" />
          Change Password
        </button>
      </form>
    </main>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-4 block">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <input required type="password" value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" />
    </label>
  );
}
