"use client";

import { useEffect, useState } from "react";
import { CheckCheck } from "lucide-react";
import { api } from "@/lib/api";

type Notification = { id: number; title: string; body: string; readAt: string | null; createdAt: string };

export function NotificationList() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<{ data: Notification[] }>("/notifications");
      setItems(data.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: number) {
    await api.patch(`/notifications/${id}/read`);
    await load();
  }

  async function markAllRead() {
    await api.patch("/notifications/read-all");
    await load();
  }

  const unread = items.filter((item) => !item.readAt).length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Notification Center</h2>
          <p className="mt-1 text-sm text-slate-500">{unread} unread alerts across the current mock workflow.</p>
        </div>
        <button type="button" onClick={markAllRead} className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">
          <CheckCheck className="h-4 w-4" />
          Mark all read
        </button>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                {!item.readAt ? <span className="h-2 w-2 rounded-full bg-blue-600" /> : null}
                <h3 className="font-semibold text-slate-950">{item.title}</h3>
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-600">{item.body}</p>
              <p className="mt-2 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
            </div>
            {!item.readAt ? <button type="button" onClick={() => markRead(item.id)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Mark read</button> : <span className="text-xs font-semibold text-green-700">Read</span>}
          </div>
        ))}
      </div>
      {!loading && !items.length ? <div className="p-8 text-center text-sm text-slate-500">No notifications yet.</div> : null}
      {loading ? <div className="p-8 text-center text-sm text-slate-500">Loading notifications...</div> : null}
    </section>
  );
}
