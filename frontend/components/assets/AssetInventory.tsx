"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Download, Edit3, Plus, Printer, QrCode, Search, Trash2, X } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { api } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import type { UserRole } from "@/types/auth";
import { StatusBadge } from "@/components/tickets/StatusBadge";

type Asset = {
  id: number;
  assetTag: string;
  assetName: string;
  category: string;
  type: string;
  status: string;
  brand: string;
  model: string;
  serialNumber: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  department: string;
  block: string;
  room: string;
  location: string;
  assignedTo: number | null;
  assignedToName?: string;
  assignedToLogin?: string;
  processor?: string;
  ram?: string;
  storage?: string;
  operatingSystem?: string;
  lifecycleState?: string;
  updatedAt?: string;
};
type User = { id: number; name: string; loginId: string; role: UserRole };
type QrSurface = "edit" | "preview";

const emptyForm = {
  assetTag: "",
  assetName: "",
  category: "Laptop",
  type: "Laptop",
  status: "available",
  brand: "",
  model: "",
  serialNumber: "",
  purchaseDate: "",
  warrantyExpiry: "",
  department: "",
  block: "",
  room: "",
  assignedTo: "",
  lifecycleState: "Available",
  processor: "",
  ram: "",
  storage: "",
  operatingSystem: ""
};

export function AssetInventory({ mode }: { mode: "employee" | "admin" }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [qrAsset, setQrAsset] = useState<Asset | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [qrCodeGeneration, setQrCodeGeneration] = useState(false);
  const [filters, setFilters] = useState({ search: "", lifecycle: "all", department: "all", warranty: "all" });
  const user = getSessionUser();

  async function load() {
    const [{ data: assetData }, userResponse, settingsResponse] = await Promise.all([
      api.get<{ data: Asset[] }>(mode === "employee" ? "/assets?mine=true" : "/assets"),
      mode === "admin" ? api.get<{ data: User[] }>("/users") : Promise.resolve({ data: { data: [] as User[] } }),
      mode === "admin"
        ? api.get<{ data?: { assets?: { qrCodeGeneration?: boolean } } }>("/settings").catch(() => ({ data: { data: { assets: { qrCodeGeneration: false } } } }))
        : Promise.resolve({ data: { data: { assets: { qrCodeGeneration: false } } } })
    ]);
    if (mode === "employee") {
      console.info("[assets] Employee asset lookup", {
        loggedInEmployeeIdentifier: { id: user?.id, username: user?.username, email: user?.email },
        query: "/assets?mine=true",
        returnedAssignedIdentifiers: assetData.data.map((asset) => ({
          assetTag: asset.assetTag,
          assignedTo: asset.assignedTo,
          assignedToLogin: asset.assignedToLogin
        }))
      });
    }
    setAssets(assetData.data);
    setUsers(userResponse.data.data);
    setQrCodeGeneration(Boolean(settingsResponse.data.data?.assets?.qrCodeGeneration));
  }

  useEffect(() => {
    load().catch(() => setAssets([]));
  }, []);

  useEffect(() => {
    if (!qrCodeGeneration) setQrAsset(null);
  }, [qrCodeGeneration]);

  const departments = useMemo(() => ["all", ...Array.from(new Set(assets.map((asset) => asset.department).filter(Boolean)))], [assets]);
  const visible = useMemo(() => {
    const scoped = assets;
    return scoped.filter((asset) => {
      const haystack = `${asset.assetTag} ${asset.assetName} ${asset.brand} ${asset.model} ${asset.serialNumber} ${asset.department} ${asset.assignedToName} ${asset.processor} ${asset.ram} ${asset.storage} ${asset.operatingSystem}`.toLowerCase();
      return (
        haystack.includes(filters.search.toLowerCase()) &&
        (filters.lifecycle === "all" || assetLifecycle(asset) === filters.lifecycle) &&
        (filters.department === "all" || asset.department === filters.department) &&
        (filters.warranty === "all" || warrantyState(asset.warrantyExpiry) === filters.warranty)
      );
    });
  }, [assets, filters]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setMessage("");
    setModalOpen(true);
  }

  function openEdit(asset: Asset) {
    setEditing(asset);
    setForm({
      assetTag: asset.assetTag,
      assetName: asset.assetName,
      category: asset.category,
      type: asset.type,
      status: asset.status,
      brand: asset.brand,
      model: asset.model,
      serialNumber: asset.serialNumber,
      purchaseDate: formatDateInput(asset.purchaseDate),
      warrantyExpiry: formatDateInput(asset.warrantyExpiry),
      department: asset.department,
      block: asset.block,
      room: asset.room,
      assignedTo: asset.assignedTo ? String(asset.assignedTo) : "",
      lifecycleState: assetLifecycle(asset),
      processor: asset.processor || "",
      ram: asset.ram || "",
      storage: asset.storage || "",
      operatingSystem: asset.operatingSystem || ""
    });
    setMessage("");
    setModalOpen(true);
  }

  async function saveAsset(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const payload = {
      ...form,
      assignedTo: form.assignedTo ? Number(form.assignedTo) : null
    };
    try {
      if (editing) {
        await api.patch(`/assets/${editing.id}`, payload);
      } else {
        await api.post("/assets", payload);
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save asset.");
    }
  }

  async function assign(asset: Asset, assignedTo: string) {
    setMessage("");
    try {
      if (assignedTo) await api.patch(`/assets/${asset.id}/assign`, { employeeId: Number(assignedTo) });
      else await api.patch(`/assets/${asset.id}`, { assignedTo: null, status: "available", lifecycleState: "Available" });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not assign asset.");
    }
  }

  async function deleteAsset(asset: Asset) {
    if (!window.confirm(`Delete ${asset.assetTag}?`)) return;
    setMessage("");
    try {
      await api.delete(`/assets/${asset.id}`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete asset.");
    }
  }

  function downloadQr(asset: Asset, surface: QrSurface) {
    const canvas = document.getElementById(qrCanvasId(asset, surface)) as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${asset.assetTag}-qr.png`;
    link.click();
  }

  function printQr(asset: Asset, surface: QrSurface) {
    const canvas = document.getElementById(qrCanvasId(asset, surface)) as HTMLCanvasElement | null;
    const dataUrl = canvas?.toDataURL("image/png");
    if (!dataUrl) return;
    const printWindow = window.open("", "_blank", "width=420,height=560");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>${asset.assetTag} QR</title></head>
        <body style="font-family: Arial, sans-serif; padding: 24px; text-align: center;">
          <h2 style="margin: 0 0 6px;">${asset.assetTag}</h2>
          <p style="margin: 0 0 18px;">${asset.assetName || "Asset QR Code"}</p>
          <img src="${dataUrl}" style="width: 240px; height: 240px;" />
          <p style="margin-top: 18px; font-family: monospace;">${assetQrPayload(asset)}</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <section className="space-y-5">
      {mode === "admin" ? (
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-5">
            <label className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search assets" className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
            </label>
            <Filter value={filters.lifecycle} onChange={(lifecycle) => setFilters({ ...filters, lifecycle })} options={["all", "Available", "Assigned", "Under Repair", "Retired"]} />
            <Filter value={filters.department} onChange={(department) => setFilters({ ...filters, department })} options={departments} />
            <Filter value={filters.warranty} onChange={(warranty) => setFilters({ ...filters, warranty })} options={["all", "valid", "expiring", "expired", "missing"]} />
          </div>
          <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800">
            <Plus className="h-4 w-4" />
            Add Asset
          </button>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Asset</th>
              <th className="px-5 py-3">Device</th>
              <th className="px-5 py-3">Serial</th>
              <th className="px-5 py-3">Lifecycle</th>
              <th className="px-5 py-3">Location</th>
              <th className="px-5 py-3">Assigned Employee</th>
              <th className="px-5 py-3">Warranty</th>
              <th className="px-5 py-3">Specs</th>
              {mode === "admin" ? <th className="px-5 py-3">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((asset) => (
              <tr key={asset.id} className="hover:bg-blue-50/50">
                <td className="px-5 py-4">
                  <p className="font-semibold text-slate-950">{asset.assetTag}</p>
                  <p className="mt-1 text-xs text-slate-500">{asset.assetName}</p>
                </td>
                <td className="px-5 py-4">
                  <p>{asset.category}</p>
                  <p className="mt-1 text-xs text-slate-500">{asset.brand} {asset.model}</p>
                </td>
                <td className="px-5 py-4 font-mono text-xs">{asset.serialNumber}</td>
                <td className="px-5 py-4"><StatusBadge status={assetLifecycle(asset)} /></td>
                <td className="px-5 py-4">{[asset.department, asset.block && `Block ${asset.block}`, asset.room && `Room ${asset.room}`].filter(Boolean).join(" / ")}</td>
                <td className="px-5 py-4">
                  {mode === "admin" ? (
                    <select value={asset.assignedTo ? String(asset.assignedTo) : ""} onChange={(event) => assign(asset, event.target.value)} className="w-48 rounded-md border border-slate-300 px-2 py-2 text-sm">
                      <option value="">Unassigned</option>
                      {users.filter((candidate) => candidate.role === "employee").map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.loginId} - {candidate.name}</option>)}
                    </select>
                  ) : asset.assignedToLogin || "Unassigned"}
                </td>
                <td className="px-5 py-4"><WarrantyBadge value={asset.warrantyExpiry} /></td>
                <td className="px-5 py-4 text-xs text-slate-600">{[asset.processor, asset.ram, asset.storage, asset.operatingSystem].filter(Boolean).join(" / ")}</td>
                {mode === "admin" ? (
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      {qrCodeGeneration ? (
                        <button type="button" onClick={() => setQrAsset(asset)} className="rounded-md border border-blue-200 p-2 text-blue-700 hover:bg-blue-50" aria-label="Preview asset QR code">
                          <QrCode className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button type="button" onClick={() => openEdit(asset)} className="rounded-md border border-slate-300 p-2 text-slate-700 hover:bg-slate-50" aria-label="Edit asset">
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => deleteAsset(asset)} className="rounded-md border border-red-200 p-2 text-red-700 hover:bg-red-50" aria-label="Delete asset">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length ? <div className="p-8 text-center text-sm text-slate-500">No assets found.</div> : null}
      </div>
      {modalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl overflow-hidden rounded-lg border border-slate-700 bg-slate-950 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Asset Registry</p>
                <h2 className="mt-1 text-xl font-semibold text-white">{editing ? "Edit Asset" : "Add Enterprise Asset"}</h2>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-slate-700 p-2 text-slate-300 hover:bg-slate-900">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={saveAsset} className="max-h-[78vh] space-y-6 overflow-y-auto p-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field required label="Asset Tag / Asset ID" value={form.assetTag} onChange={(assetTag) => setForm({ ...form, assetTag })} />
                <Field required label="Asset Name" value={form.assetName} onChange={(assetName) => setForm({ ...form, assetName })} />
                <Field required label="Serial Number" value={form.serialNumber} onChange={(serialNumber) => setForm({ ...form, serialNumber })} />
                <Select label="Category / Device Type" value={form.category} onChange={(category) => setForm({ ...form, category, type: category })} options={["Laptop", "Desktop", "Monitor", "Printer", "Network", "Peripheral", "Other"]} />
                <Select label="Lifecycle State" value={form.lifecycleState} onChange={(lifecycleState) => setForm({ ...form, lifecycleState, status: statusFromLifecycle(lifecycleState) })} options={["Available", "Assigned", "Under Repair", "Retired"]} />
                <Field required label="Brand" value={form.brand} onChange={(brand) => setForm({ ...form, brand })} />
                <Field required label="Model" value={form.model} onChange={(model) => setForm({ ...form, model })} />
                <Field label="Purchase Date" type="date" value={form.purchaseDate} onChange={(purchaseDate) => setForm({ ...form, purchaseDate })} />
                <Field label="Warranty Expiry" type="date" value={form.warrantyExpiry} onChange={(warrantyExpiry) => setForm({ ...form, warrantyExpiry })} />
                <Field required label="Department" value={form.department} onChange={(department) => setForm({ ...form, department })} />
                <Field required label="Block" value={form.block} onChange={(block) => setForm({ ...form, block })} />
                <Field required label="Room" value={form.room} onChange={(room) => setForm({ ...form, room })} />
                <label className="block">
                  <span className="text-sm font-medium text-slate-200">Assigned Employee</span>
                  <select value={form.assignedTo} onChange={(event) => setForm({ ...form, assignedTo: event.target.value, status: event.target.value ? "assigned" : form.status, lifecycleState: event.target.value ? "Assigned" : form.lifecycleState })} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20">
                    <option value="">Unassigned</option>
                    {users.filter((candidate) => candidate.role === "employee").map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.loginId} - {candidate.name}</option>)}
                  </select>
                </label>
                <Field label="Processor" value={form.processor} onChange={(processor) => setForm({ ...form, processor })} />
                <Field label="RAM" value={form.ram} onChange={(ram) => setForm({ ...form, ram })} />
                <Field label="Storage" value={form.storage} onChange={(storage) => setForm({ ...form, storage })} />
                <Field label="Operating System" value={form.operatingSystem} onChange={(operatingSystem) => setForm({ ...form, operatingSystem })} />
              </div>
              {qrCodeGeneration && editing ? (
                <AssetQrSection asset={editing} surface="edit" onDownload={downloadQr} onPrint={printQr} />
              ) : null}
              {message ? <p className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">{message}</p> : null}
              <div className="sticky bottom-0 -mx-6 flex justify-end gap-3 border-t border-slate-800 bg-slate-950 px-6 pt-5">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-900">Cancel</button>
                <button type="submit" className="rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500">{editing ? "Save Changes" : "Create Asset"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {qrCodeGeneration && qrAsset ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-700 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Asset QR Code</p>
                <h2 className="mt-1 text-lg font-semibold text-white">{qrAsset.assetTag}</h2>
              </div>
              <button type="button" onClick={() => setQrAsset(null)} className="rounded-md border border-slate-700 p-2 text-slate-300 hover:bg-slate-900">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-5 p-6">
              <AssetQrSection asset={qrAsset} surface="preview" onDownload={downloadQr} onPrint={printQr} />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AssetQrSection({ asset, surface, onDownload, onPrint }: { asset: Asset; surface: QrSurface; onDownload: (asset: Asset, surface: QrSurface) => void; onPrint: (asset: Asset, surface: QrSurface) => void }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="rounded-md bg-white p-3">
          <QRCodeCanvas id={qrCanvasId(asset, surface)} value={assetQrPayload(asset)} size={180} includeMargin />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-white">QR Code</h3>
          <p className="mt-1 break-all font-mono text-xs text-blue-200">{assetQrPayload(asset)}</p>
          <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
            <Info label="Asset Name" value={asset.assetName} />
            <Info label="Serial Number" value={asset.serialNumber} />
            <Info label="Category" value={asset.category} />
            <Info label="Department" value={asset.department} />
            <Info label="Location" value={[asset.department, asset.block && `Block ${asset.block}`, asset.room && `Room ${asset.room}`].filter(Boolean).join(" / ")} />
            <Info label="Assigned Employee" value={asset.assignedToName || asset.assignedToLogin || "Unassigned"} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => onDownload(asset, surface)} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500">
              <Download className="h-4 w-4" />
              Download QR
            </button>
            <button type="button" onClick={() => onPrint(asset, surface)} className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-900">
              <Printer className="h-4 w-4" />
              Print QR
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 truncate font-semibold text-slate-100">{value || "N/A"}</p>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-200">{label}</span>
      <input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20" />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-200">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Filter({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function assetLifecycle(asset: Asset) {
  if (asset.lifecycleState) return asset.lifecycleState;
  return lifecycleFromStatus(asset.status);
}

function lifecycleFromStatus(status: string) {
  if (status === "assigned") return "Assigned";
  if (status === "repair" || status === "under repair") return "Under Repair";
  if (status === "retired") return "Retired";
  return "Available";
}

function statusFromLifecycle(lifecycle: string) {
  if (lifecycle === "Assigned") return "assigned";
  if (lifecycle === "Under Repair") return "repair";
  if (lifecycle === "Retired") return "retired";
  return "available";
}

function warrantyState(value?: string) {
  if (!value) return "missing";
  const expiry = new Date(value).getTime();
  if (Number.isNaN(expiry)) return "missing";
  const days = Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "valid";
}

function assetQrPayload(asset: Asset) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://10.5.5.178:3000").replace(/\/$/, "");
  return `${appUrl}/asset/${encodeURIComponent(asset.assetTag)}`;
}

function qrCanvasId(asset: Asset, surface: QrSurface) {
  return `asset-qr-${surface}-${String(asset.id || asset.assetTag).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function WarrantyBadge({ value }: { value?: string }) {
  const state = warrantyState(value);
  const label = value ? new Date(value).toLocaleDateString() : "Not recorded";
  const tone = state === "expired" ? "bg-red-50 text-red-700" : state === "expiring" ? "bg-amber-50 text-amber-700" : state === "valid" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function formatDateInput(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}
