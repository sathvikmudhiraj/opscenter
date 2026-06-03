import { notFound } from "next/navigation";

type AssetVerification = {
  assetTag: string;
  assetName: string;
  serialNumber: string;
  category: string;
  type: string;
  brand: string;
  model: string;
  lifecycleState: string;
  department: string;
  block: string;
  room: string;
  location: string;
  assignedEmployee: string;
  warrantyExpiry?: string;
  verificationStatus: string;
};

type AssetVerificationPageProps = {
  params: Promise<{ assetId: string }>;
};

function apiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const trimmed = configured.replace(/\/$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

async function getAsset(assetId: string) {
  const response = await fetch(`${apiBaseUrl()}/public/assets/${encodeURIComponent(assetId)}`, {
    cache: "no-store"
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("Asset verification lookup failed");
  }

  const payload = await response.json() as { data: AssetVerification };
  return payload.data;
}

function formatDate(value?: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleDateString();
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/80 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-100">{value || "N/A"}</p>
    </div>
  );
}

export default async function AssetVerificationPage({ params }: AssetVerificationPageProps) {
  const { assetId } = await params;
  const asset = await getAsset(assetId);

  if (!asset) notFound();

  const location = asset.location || [asset.department, asset.block && `Block ${asset.block}`, asset.room && `Room ${asset.room}`].filter(Boolean).join(" / ");

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="border-b border-slate-800 bg-slate-950 px-5 py-5 sm:px-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">OpsCenter Asset Verification</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-white">{asset.assetTag}</h1>
                <p className="mt-1 text-sm text-slate-400">{asset.assetName || "Registered enterprise asset"}</p>
              </div>
              <span className="inline-flex w-fit rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold capitalize text-emerald-200">
                {asset.verificationStatus}
              </span>
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-7">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Asset ID" value={asset.assetTag} />
              <Field label="Asset Name" value={asset.assetName} />
              <Field label="Serial Number" value={asset.serialNumber} />
              <Field label="Category / Device Type" value={asset.type || asset.category} />
              <Field label="Brand" value={asset.brand} />
              <Field label="Model" value={asset.model} />
              <Field label="Lifecycle State" value={asset.lifecycleState} />
              <Field label="Department" value={asset.department} />
              <Field label="Block" value={asset.block} />
              <Field label="Room" value={asset.room} />
              <Field label="Assigned Employee" value={asset.assignedEmployee} />
              <Field label="Warranty Expiry" value={formatDate(asset.warrantyExpiry)} />
            </div>

            <div className="rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">Verified Location</p>
              <p className="mt-1 text-sm font-semibold text-white">{location || "N/A"}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
