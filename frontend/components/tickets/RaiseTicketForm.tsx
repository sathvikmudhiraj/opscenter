"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, X } from "lucide-react";
import { api } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { fileToDataUrl } from "@/lib/tickets";
import type { Ticket } from "@/types/ticket";

type Asset = {
  id: number;
  assetTag: string;
  type: string;
  model: string;
  location: string;
  department?: string;
  block?: string;
  room?: string;
  assignedToLogin?: string;
};

const ISSUE_CATEGORIES = {
  Hardware: ["RAM Failure", "CPU Issue", "Disk Issue"],
  Software: ["App Crash", "Install Issue"],
  "Operating System": ["Boot Failure", "Update Issue"],
  Network: ["WiFi", "LAN", "VPN"],
  Printer: ["Not Printing", "Driver Issue"],
  Performance: ["Slow System"],
  Security: ["Virus", "Unauthorized Access"]
} as const;

type Category = keyof typeof ISSUE_CATEGORIES;
type FormErrors = Partial<Record<"title" | "category" | "subcategory" | "priority" | "description", string>>;

export function RaiseTicketForm() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Hardware" as Category,
    subcategory: "",
    priority: "medium" as Ticket["priority"],
    assetId: "",
    assetTagManual: "",
    department: "",
    block: "",
    roomNumber: ""
  });

  useEffect(() => {
    api.get<{ data: Asset[] }>("/assets").then(({ data }) => setAssets(data.data)).catch(() => setAssets([]));
  }, []);

  const assignedAssets = useMemo(() => {
    const user = getSessionUser();
    const loginId = user?.email?.toLowerCase();
    return assets.filter((asset) => !loginId || asset.assignedToLogin?.toLowerCase() === loginId);
  }, [assets]);

  async function onImage(file?: File) {
    if (!file) return;
    setPreview(await fileToDataUrl(file));
  }

  function updateCategory(category: string) {
    const nextCategory = category as Category;
    setForm({ ...form, category: nextCategory, subcategory: "" });
    setErrors({ ...errors, category: undefined, subcategory: undefined });
  }

  function updateAsset(assetId: string) {
    const asset = assignedAssets.find((candidate) => String(candidate.id) === assetId);
    setForm({
      ...form,
      assetId,
      assetTagManual: assetId ? "" : form.assetTagManual,
      department: asset?.department || form.department,
      block: asset?.block || form.block,
      roomNumber: asset?.room || form.roomNumber
    });
  }

  function validate() {
    const nextErrors: FormErrors = {};
    if (!form.title.trim()) nextErrors.title = "Issue title is required.";
    if (!form.category) nextErrors.category = "Category is required.";
    if (!form.subcategory) nextErrors.subcategory = "Subcategory is required.";
    if (!form.priority) nextErrors.priority = "Priority is required.";
    if (!form.description.trim()) nextErrors.description = "Description is required.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError("");
    if (!validate()) return;

    setLoading(true);
    try {
      const { data } = await api.post<{ data: { ID: number } }>("/tickets", {
        ...form,
        assetId: form.assetId ? Number(form.assetId) : undefined,
        screenshotUrl: preview
      });
      router.push(`/tickets/${data.data.ID}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not submit ticket. Please try again.");
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
            <input value={form.title} placeholder="E.g. Laptop won't boot past BIOS" onChange={(event) => {
              setForm({ ...form, title: event.target.value });
              setErrors({ ...errors, title: undefined });
            }} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
            {errors.title ? <p className="mt-1 text-xs font-medium text-red-600">{errors.title}</p> : null}
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea value={form.description} onChange={(event) => {
              setForm({ ...form, description: event.target.value });
              setErrors({ ...errors, description: undefined });
            }} className="mt-1 min-h-36 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
            {errors.description ? <p className="mt-1 text-xs font-medium text-red-600">{errors.description}</p> : null}
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <Select label="Category" value={form.category} onChange={updateCategory} options={Object.keys(ISSUE_CATEGORIES)} error={errors.category} />
            <Select label="Subcategory" value={form.subcategory} onChange={(value) => {
              setForm({ ...form, subcategory: value });
              setErrors({ ...errors, subcategory: undefined });
            }} options={ISSUE_CATEGORIES[form.category]} placeholder="Select subcategory" error={errors.subcategory} />
            <Select label="Priority" value={form.priority} onChange={(value) => {
              setForm({ ...form, priority: value as Ticket["priority"] });
              setErrors({ ...errors, priority: undefined });
            }} options={["low", "medium", "high", "critical"]} error={errors.priority} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Assigned Asset</span>
              <select value={form.assetId} onChange={(event) => updateAsset(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
                <option value="">No asset selected</option>
                {assignedAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetTag} - {asset.model}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Manual Asset Tag</span>
              <input value={form.assetTagManual} disabled={Boolean(form.assetId)} onChange={(event) => setForm({ ...form, assetTagManual: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100" />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Department</span>
              <input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Block / Building</span>
              <input value={form.block} onChange={(event) => setForm({ ...form, block: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Room Number</span>
              <input value={form.roomNumber} onChange={(event) => setForm({ ...form, roomNumber: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
            </label>
          </div>
          {submitError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{submitError}</p> : null}
        </div>
      </section>
      <aside className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center hover:bg-blue-50">
          <UploadCloud className="mb-3 h-8 w-8 text-blue-700" />
          <span className="text-sm font-semibold text-slate-900">{preview ? "Change screenshot" : "Upload screenshot"}</span>
          <span className="mt-1 text-xs text-slate-500">Image preview is attached to the ticket submission</span>
          <input className="hidden" type="file" accept="image/*" onChange={(event) => onImage(event.target.files?.[0])} />
        </label>
        {preview ? (
          <div className="mt-4">
            <img src={preview} alt="Issue screenshot preview" className="max-h-56 w-full rounded-md object-cover" />
            <button type="button" onClick={() => setPreview("")} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <X className="h-4 w-4" />
              Remove screenshot
            </button>
          </div>
        ) : null}
        <div className="mt-6 grid gap-3">
          <button className="w-full rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60" disabled={loading}>
            {loading ? "Submitting..." : "Submit ticket"}
          </button>
          <button type="button" onClick={() => router.back()} className="w-full rounded-md border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50" disabled={loading}>
            Cancel
          </button>
        </div>
      </aside>
    </form>
  );
}

function Select({ label, value, onChange, options, placeholder, error }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[]; placeholder?: string; error?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-3 text-sm capitalize outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
      </select>
      {error ? <p className="mt-1 text-xs font-medium text-red-600">{error}</p> : null}
    </label>
  );
}
