export function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  if (typeof window !== "undefined") {
    const currentHost = window.location.hostname;
    if (currentHost === "localhost" || currentHost === "127.0.0.1") {
      return "http://localhost:5000/api";
    }
    const isLanHost = currentHost && currentHost !== "localhost" && currentHost !== "127.0.0.1";
    if (isLanHost && configured.includes("localhost")) {
      return `http://${currentHost}:5000/api`;
    }
  }
  const trimmed = configured.replace(/\/$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}
