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

    // Handle 429 Too Many Requests with retry and exponential backoff
    if (error.response && error.response.status === 429) {
      const config = error.config;
      // Initialize retry count if not present
      if (!config.__retryCount) {
        config.__retryCount = 0;
      }
      // If we've retried 3 times, don't retry again (so total 4 attempts)
      if (config.__retryCount >= 3) {
        console.error("[API Error] Max retries exceeded for 429 error");
        const message = error.response?.data?.message || error.message || "OpsCenter API request failed";
        console.error("[API Error]", message);
        return Promise.reject(new Error(message));
      }
      // Increment retry count
      config.__retryCount += 1;
      // Exponential backoff: 1000ms, 2000ms, 4000ms
      const delay = Math.pow(2, config.__retryCount) * 1000;
      console.log(`[API Response] 429 Too Many Requests, retrying in ${delay}ms (attempt ${config.__retryCount})`);
      // Wait for the delay
      await new Promise(resolve => setTimeout(resolve, delay));
      // Retry the request using the same api instance
      return api(config);
    }

    const message = error?.response?.data?.message || error?.message || "OpsCenter API request failed";
    console.error("[API Error]", message);
    return Promise.reject(new Error(message));
  }
);