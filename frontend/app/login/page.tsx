import { LoginForm } from "@/components/auth/AuthForm";
import { Bell, Boxes, ChartNoAxesCombined, ClipboardCheck, RadioTower } from "lucide-react";

export default function LoginPage() {
  const features = [
    { label: "Smart Ticket Management", icon: ClipboardCheck },
    { label: "Asset & Lifecycle Management", icon: Boxes },
    { label: "Real-time Monitoring & Analytics", icon: ChartNoAxesCombined },
    { label: "Instant Notifications & Alerts", icon: Bell }
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative flex min-h-[46vh] overflow-hidden bg-[radial-gradient(circle_at_15%_15%,rgba(37,99,235,0.38),transparent_34%),linear-gradient(135deg,#020617_0%,#0f172a_48%,#082f49_100%)] px-6 py-10 lg:min-h-screen lg:px-14">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:38px_38px]" />
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full border border-cyan-300/20" />
        <div className="absolute bottom-10 right-10 h-52 w-52 rounded-full border border-blue-300/20" />
        <div className="relative z-10 flex max-w-2xl flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 shadow-2xl backdrop-blur">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-blue-500/20 text-cyan-200">
                <RadioTower className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-100">OpsCenter</span>
            </div>
            <h1 className="mt-14 max-w-3xl text-4xl font-semibold leading-tight text-white md:text-5xl">
              Smart Support. Faster Resolution. Stronger Operations.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300">
              OpsCenter helps enterprises streamline IT support, manage tickets, track assets, and deliver operational excellence.
            </p>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-2">
            {features.map(({ label, icon: Icon }) => (
              <div key={label} className="group rounded-md border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-white/[0.09]">
                <Icon className="h-5 w-5 text-cyan-200" />
                <p className="mt-3 text-sm font-semibold text-slate-100">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex min-h-[54vh] items-center justify-center bg-[#07111f] px-5 py-10 lg:min-h-screen lg:px-10">
        <div className="w-full max-w-md animate-[fadeIn_500ms_ease-out] rounded-lg border border-white/10 bg-slate-900/80 p-7 shadow-2xl shadow-blue-950/30 backdrop-blur md:p-8">
          <div className="mb-7">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-300">Secure Access</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Welcome Back!</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Sign in to continue to OpsCenter</p>
          </div>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
