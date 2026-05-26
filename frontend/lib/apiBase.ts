export function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const trimmed = configured.replace(/\/$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}
