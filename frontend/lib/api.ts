import axios from "axios";
import { getApiBaseUrl } from "./apiBase";
import { clearSession } from "./auth";

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    "Content-Type": "application/json"
  }
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("opscenter_token");
    if (token) {
      console.log("[API Request] Adding token to Authorization header");
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.log("[API Request] No token found in localStorage");
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (typeof window !== "undefined" && error?.response?.status === 401) {
      console.log("[API Response] 401 Unauthorized, clearing session");
      clearSession();
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }

    if (error.response && error.response.status === 429) {
      const method = String(error.config?.method || "GET").toUpperCase();
      const url = String(error.config?.url || "unknown URL");
      const message = `Rate limit exceeded for ${method} ${url}`;
      console.error("[API Error]", message);
      return Promise.reject(new Error(message));
    }

    const message = error?.response?.data?.message || error?.message || "OpsCenter API request failed";
    console.error("[API Error]", message);
    return Promise.reject(new Error(message));
  }
);
