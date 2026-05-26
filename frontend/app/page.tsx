import { redirect } from "next/navigation";
import { getApiBaseUrl } from "@/lib/apiBase";

async function hasUsers() {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/auth/bootstrap`, { cache: "no-store" });
    if (!response.ok) return true;
    const data = (await response.json()) as { setupRequired: boolean };
    return !data.setupRequired;
  } catch {
    return true;
  }
}

export default async function HomePage() {
  const configured = await hasUsers();
  redirect(configured ? "/login" : "/setup-admin");
}
