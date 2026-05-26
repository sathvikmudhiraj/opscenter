import { statusLabel } from "@/lib/tickets";

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "critical" || status === "escalated" || status === "breached"
      ? "bg-red-50 text-red-700"
      : status === "resolved" || status === "closed" || status === "normal"
        ? "bg-green-50 text-green-700"
        : status === "waiting_for_parts" || status === "at_risk"
          ? "bg-amber-50 text-amber-700"
          : "bg-blue-50 text-blue-700";

  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold capitalize ${tone}`}>{statusLabel(status)}</span>;
}
