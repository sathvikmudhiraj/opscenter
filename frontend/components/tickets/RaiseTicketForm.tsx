"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { api } from "@/lib/api";
import { fileToDataUrl } from "@/lib/tickets";
import type { Ticket } from "@/types/ticket";

type Asset = { id: number; assetTag: string; type: string; model: string; location: string };

export function RaiseTicketForm() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Hardware",
    priority: "medium" as Ticket["priority"],
    assetId: ""
  });

  useEffect(() => {
    api.get<{ data: Asset[] }>("/assets").then(({ data }) => setAssets(data.data)).catch(() => setAssets([]));
  }, []);

  async function onImage(file?: File) {
    if (!file) return;
    setPreview(await fileToDataUrl(file));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post<{ data: { ID: number } }>("/tickets", {
        ...form,
        assetId: form.assetId ? Number(form.assetId) : undefined,
        screenshotUrl: preview
      });
      router.push(`/tickets/${data.data.ID}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-6 lg:grid-cols-[1fr_360px]" onSubmit={onSubmit}>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Title</span>
            <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 min-h-36 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <Select label="Category" value={form.category} onChange={(value) => setForm({ ...form, category: value })} options={["Hardware", "Network", "Software", "Assets"]} />
            <Select label="Priority" value={form.priority} onChange={(value) => setForm({ ...form, priority: value as Ticket["priority"] })} options={["low", "medium", "high", "critical"]} />
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Asset</span>
              <select value={form.assetId} onChange={(event) => setForm({ ...form, assetId: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
                <option value="">No asset selected</option>
                {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetTag} - {asset.model}</option>)}
              </select>
            </label>
          </div>
        </div>
      </section>
      <aside className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center hover:bg-blue-50">
          <UploadCloud className="mb-3 h-8 w-8 text-blue-700" />
          <span className="text-sm font-semibold text-slate-900">Upload screenshot</span>
          <span className="mt-1 text-xs text-slate-500">Image preview is stored in mock mode</span>
          <input className="hidden" type="file" accept="image/*" onChange={(event) => onImage(event.target.files?.[0])} />
        </label>
        {preview ? <img src={preview} alt="Issue screenshot preview" className="mt-4 max-h-56 w-full rounded-md object-cover" /> : null}
        <button className="mt-6 w-full rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60" disabled={loading}>
          {loading ? "Submitting..." : "Submit ticket"}
        </button>
      </aside>
    </form>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-sm capitalize outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
        {options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
      </select>
    </label>
  );
}
