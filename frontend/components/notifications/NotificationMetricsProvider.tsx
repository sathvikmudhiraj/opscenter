"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { getApiBaseUrl } from "@/lib/apiBase";
import { getSessionToken } from "@/lib/auth";

type NotificationMetricsContextValue = {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
};

const NotificationMetricsContext = createContext<NotificationMetricsContextValue | null>(null);

export function NotificationMetricsProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [tokenVersion, setTokenVersion] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!getSessionToken()) {
      setUnreadCount(0);
      return;
    }
    const { data } = await api.get<{ unreadCount: number }>("/notifications/unread-count");
    setUnreadCount(Number(data.unreadCount || 0));
  }, []);

  useEffect(() => {
    refreshUnreadCount().catch(() => setUnreadCount(0));

    const interval = window.setInterval(() => {
      refreshUnreadCount().catch(() => undefined);
    }, 30000);

    const refreshOnFocus = () => {
      if (!document.hidden) refreshUnreadCount().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [refreshUnreadCount]);

  useEffect(() => {
    let lastToken = getSessionToken();
    const interval = window.setInterval(() => {
      const nextToken = getSessionToken();
      if (nextToken !== lastToken) {
        lastToken = nextToken;
        setTokenVersion((version) => version + 1);
        if (nextToken) {
          refreshUnreadCount().catch(() => undefined);
        } else {
          setUnreadCount(0);
        }
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [refreshUnreadCount]);

  useEffect(() => {
    const token = getSessionToken();
    if (!token) return;

    const events = new EventSource(`${getApiBaseUrl()}/notifications/events?token=${encodeURIComponent(token)}`);
    events.addEventListener("unread-count", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as { unreadCount?: number };
        setUnreadCount(Number(payload.unreadCount || 0));
      } catch {
        refreshUnreadCount().catch(() => undefined);
      }
    });
    events.onerror = () => {
      refreshUnreadCount().catch(() => undefined);
    };

    return () => events.close();
  }, [refreshUnreadCount, tokenVersion]);

  const value = useMemo(() => ({ unreadCount, refreshUnreadCount }), [refreshUnreadCount, unreadCount]);

  return (
    <NotificationMetricsContext.Provider value={value}>
      {children}
    </NotificationMetricsContext.Provider>
  );
}

export function useNotificationMetrics() {
  const context = useContext(NotificationMetricsContext);
  if (!context) {
    throw new Error("useNotificationMetrics must be used inside NotificationMetricsProvider");
  }
  return context;
}
