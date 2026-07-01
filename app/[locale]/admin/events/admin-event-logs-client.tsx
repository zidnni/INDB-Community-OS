"use client";

import {useTranslations} from "next-intl";
import type {EventLogEntry} from "./actions";

const COLORS: Record<string, string> = {
  'idea': 'text-blue-500',
  'memory': 'text-green-500',
  'graatek': 'text-amber-500',
  'donation': 'text-emerald-500',
  'volunteer': 'text-violet-500',
  'message': 'text-cyan-500',
  'feed': 'text-orange-500',
  'recognition': 'text-pink-500',
  'settings': 'text-gray-500',
};

function eventColor(name: string): string {
  const prefix = name.split('.')[0];
  return COLORS[prefix] ?? 'text-muted-foreground';
}

export function AdminEventLogsClient({logs}: {logs: EventLogEntry[]}) {
  const t = useTranslations("Admin.events");

  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
        {t("empty")}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border">
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 sticky top-0">
              <th className="px-4 py-3 text-start font-medium">{t("columns.event")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("columns.actor")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("columns.type")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("columns.id")}</th>
              <th className="px-4 py-3 text-end font-medium">{t("columns.time")}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <span dir="ltr" className={`font-mono text-xs font-medium ${eventColor(log.event_name)}`}>
                    {log.event_name}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground" dir="ltr">
                  {log.actor_id ? log.actor_id.slice(0, 8) + '…' : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {log.entity_type}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground max-w-[120px] truncate" dir="ltr">
                  {log.entity_id}
                </td>
                <td className="px-4 py-3 text-end text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {t("shown", {count: logs.length})}
      </div>
    </div>
  );
}
