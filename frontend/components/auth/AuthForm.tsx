"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { getDashboardPath, saveSession } from "@/lib/auth";
import type { AuthResponse } from "@/types/auth";

const REMEMBER_USER_KEY = "opscenter_remember_user_id";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const remembered = window.localStorage.getItem(REMEMBER_USER_KEY);
    if (remembered) {
      setEmail(remembered);
      setRememberMe(true);
    }
  }, []);

  function errorMessage(message: string) {
    const normalized = message.toLowerCase();
    if (normalized.includes("disabled")) return "Account disabled. Please contact your administrator.";
    if (normalized.includes("not found")) return "User not found. Check your User ID.";
    if (normalized.includes("invalid")) return "Invalid credentials. Check your User ID and password.";
    return "Unable to sign in right now. Please try again.";
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post<AuthResponse>("/auth/login", { email, password });
      if (rememberMe) {
        window.localStorage.setItem(REMEMBER_USER_KEY, email);
      } else {
        window.localStorage.removeItem(REMEMBER_USER_KEY);
      }
      saveSession(data);
      window.location.assign(data.user.forcePasswordChange ? "/change-password" : getDashboardPath(data.user.role));
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "";
      setError(errorMessage(message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <LoginInput label="User ID" value={email} onChange={setEmail} icon={UserRound} autoComplete="username" />
      <LoginInput
        label="Password"
        value={password}
        onChange={setPassword}
        icon={KeyRound}
        type={showPassword ? "text" : "password"}
        autoComplete="current-password"
        trailing={
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-white" aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
      />

      <div className="flex items-center justify-between gap-3">
        <Link href="/forgot-password" className="text-sm font-semibold text-blue-300 transition hover:text-blue-200">Forgot Password?</Link>
      </div>

      <label className="flex items-center gap-3 text-sm font-medium text-slate-300">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(event) => setRememberMe(event.target.checked)}
          className="h-4 w-4 rounded border-white/20 bg-slate-950 text-blue-600 focus:ring-2 focus:ring-blue-400/40"
        />
        Remember me
      </label>

      {error ? <p className="rounded-md border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200">{error}</p> : null}
      <button className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-500 disabled:translate-y-0 disabled:opacity-60" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {loading ? "Signing in..." : "Sign In"}
      </button>
      <p className="text-center text-xs font-medium text-slate-500">Secure login. All activity is monitored.</p>
    </form>
  );
}

export function SetupAdminForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post<AuthResponse>("/auth/setup-admin", form);
      saveSession(data);
      window.location.assign("/admin/dashboard");
    } catch {
      setError("Admin setup is unavailable or already completed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <Input label="Full name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
      <Input label="Admin ID" value={form.email} onChange={(email) => setForm({ ...form, email })} />
      <Input label="Password" value={form.password} onChange={(password) => setForm({ ...form, password })} type="password" />
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      <button className="w-full rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-60" disabled={loading}>
        {loading ? "Creating admin..." : "Create first admin"}
      </button>
    </form>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        required
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

function LoginInput({ label, value, onChange, icon: Icon, type = "text", autoComplete, trailing }: { label: string; value: string; onChange: (value: string) => void; icon: typeof UserRound; type?: string; autoComplete?: string; trailing?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <span className="mt-2 flex items-center gap-3 rounded-md border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white shadow-inner transition focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10">
        <Icon className="h-4 w-4 text-slate-500" />
        <input
          required
          type={type}
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
        />
        {trailing}
      </span>
    </label>
  );
}
