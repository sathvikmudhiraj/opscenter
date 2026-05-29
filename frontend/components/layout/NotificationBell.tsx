"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";

type Notification = { id: number; title: string; body: string; readAt: string | null; createdAt: string };

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<{ data: Notification[] }>("/notifications").then(({ data }) => setItems(data.data)).catch(() => setItems([]));
  }, []);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  const unread = items.filter((item) => !item.readAt).length;

  return (
    <div className="relative z-50 self-start sm:self-auto" ref={containerRef}>
      <button
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
        onClick={() => setOpen(!open)}
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread ? (
          <span className="absolute -right-2 -top-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="fixed left-4 right-4 top-20 z-50 rounded-lg border border-slate-200 bg-white p-3 shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
          <p className="px-2 pb-2 text-sm font-semibold text-slate-950">Notifications</p>
          <div className="max-h-80 space-y-2 overflow-auto">
            {items.map((item) => (
              <div key={item.id} className="rounded-md bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{item.body}</p>
              </div>
            ))}
            {!items.length ? <p className="p-3 text-sm text-slate-500">No notifications.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
