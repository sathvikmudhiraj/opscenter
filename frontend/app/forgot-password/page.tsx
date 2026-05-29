"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, RadioTower, UserRound } from "lucide-react";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = userId.trim();
    if (trimmed.length < 2) {
      setStatus("error");
      return;
    }
    try {
      await api.post("/password-resets/request", { username: trimmed });
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative flex min-h-[46vh] overflow-hidden bg-[radial-gradient(circle_at_15%_15%,rgba(37,99,235,0.38),transparent_34%),linear-gradient(135deg,#020617_0%,#0f172a_48%,#082f49_100%)] px-6 py-10 lg:min-h-screen lg:px-14">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:38px_38px]" />
        <div className="relative z-10 flex max-w-2xl flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 shadow-2xl backdrop-blur">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-blue-500/20 text-cyan-200">
                <RadioTower className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-100">OpsCenter</span>
            </div>
            <h1 className="mt-14 max-w-3xl text-4xl font-semibold leading-tight text-white md:text-5xl">Secure account recovery for enterprise operations.</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300">Submit your User ID and the OpsCenter administrator will help restore account access.</p>
          </div>
        </div>
      </section>

      <section className="flex min-h-[54vh] items-center justify-center bg-[#07111f] px-5 py-10 lg:min-h-screen lg:px-10">
        <div className="w-full max-w-md animate-[fadeIn_500ms_ease-out] rounded-lg border border-white/10 bg-slate-900/80 p-7 shadow-2xl shadow-blue-950/30 backdrop-blur md:p-8">
          <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-300 transition hover:text-blue-200">
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
          <div className="mb-7 mt-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-300">Account Recovery</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Forgot Password?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Enter your User ID to request password reset assistance.</p>
          </div>

          <form className="space-y-5" onSubmit={onSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-slate-300">User ID</span>
              <span className="mt-2 flex items-center gap-3 rounded-md border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white shadow-inner transition focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10">
                <UserRound className="h-4 w-4 text-slate-500" />
                <input
                  required
                  value={userId}
                  onChange={(event) => {
                    setUserId(event.target.value);
                    setStatus("idle");
                  }}
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                />
              </span>
            </label>

            {status === "success" ? (
              <p className="flex items-center gap-2 rounded-md border border-green-400/20 bg-green-500/10 px-3 py-2 text-sm font-medium text-green-200">
                <CheckCircle2 className="h-4 w-4" />
                Recovery request submitted. Please contact your administrator.
              </p>
            ) : null}
            {status === "error" ? <p className="rounded-md border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200">Enter a valid User ID.</p> : null}

            <button className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-500">
              <KeyRound className="h-4 w-4" />
              Request Reset
            </button>
            <p className="text-center text-xs font-medium text-slate-500">Secure login. All activity is monitored.</p>
          </form>
        </div>
      </section>
    </main>
  );
}
