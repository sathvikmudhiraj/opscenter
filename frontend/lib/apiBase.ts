function withApiPath(url: URL) {
  const pathname = url.pathname.replace(/\/$/, "");
  url.pathname = pathname.endsWith("/api") ? pathname : `${pathname}/api`;
  return url.toString().replace(/\/$/, "");
}

function isLocalNetworkHost(hostname: string) {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

export function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
  const url = new URL(configured);

  if (typeof window !== "undefined" && isLocalNetworkHost(url.hostname)) {
    url.hostname = window.location.hostname;
  }

  return withApiPath(url);
}

export function getAppBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
