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
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined" && error?.response?.status === 401) {
      clearSession();
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }
    const message = error?.response?.data?.message || error?.message || "OpsCenter API request failed";
    return Promise.reject(new Error(message));
  }
);
