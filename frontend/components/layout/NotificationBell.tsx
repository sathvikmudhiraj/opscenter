"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";

type Notification = { id: number; title: string; body: string; readAt: string | null; createdAt: string };

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    api.get<{ data: Notification[] }>("/notifications").then(({ data }) => setItems(data.data)).catch(() => setItems([]));
  }, []);

  const unread = items.filter((item) => !item.readAt).length;

  return (
    <div className="relative">
      <button className="relative rounded-md border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50" onClick={() => setOpen(!open)} type="button" aria-label="Notifications">
        <Bell className="h-4 w-4" />
        {unread ? <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{unread}</span> : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
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
