export function AuthCard({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#dbeafe,#eef3f8_45%,#f8fafc)] px-4">
      <section className="w-full max-w-md rounded-lg border border-white/70 bg-white/80 p-8 shadow-glass backdrop-blur">
        <div className="mb-7">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">OpsCenter</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
