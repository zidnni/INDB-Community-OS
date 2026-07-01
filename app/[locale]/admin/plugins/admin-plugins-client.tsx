"use client";

import {useTransition} from "react";
import {useTranslations} from "next-intl";
import {togglePlugin} from "./actions";

interface PluginRow {
  id: string;
  name: string;
  version: string;
  description: string;
  state: string;
  navKey: string | null;
  routePrefixes: string[];
}

export function AdminPluginsClient({plugins}: {plugins: PluginRow[]}) {
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("Admin.plugins");

  function handleToggle(pluginId: string, currentState: string) {
    startTransition(async () => {
      try {
        await togglePlugin(pluginId, currentState === "disabled");
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to toggle plugin");
      }
    });
  }

  return (
    <div className="rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-start font-medium">{t("columns.plugin")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("columns.version")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("columns.routes")}</th>
            <th className="px-4 py-3 text-start font-medium">{t("columns.state")}</th>
            <th className="px-4 py-3 text-end font-medium">{t("columns.action")}</th>
          </tr>
        </thead>
        <tbody>
          {plugins.map((plugin) => (
            <tr key={plugin.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                <div className="font-medium">{plugin.name}</div>
                <div className="text-xs text-muted-foreground">{plugin.description}</div>
                {plugin.navKey && (
                  <div className="mt-0.5 text-xs text-muted-foreground/60">{t("navLabel")}: {plugin.navKey}</div>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground" dir="ltr">{plugin.version}</td>
              <td className="px-4 py-3 text-muted-foreground font-mono text-xs" dir="ltr">
                {plugin.routePrefixes.join(", ")}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    plugin.state === "enabled"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {plugin.state === "enabled" ? t("state.enabled") : t("state.disabled")}
                </span>
              </td>
              <td className="px-4 py-3 text-end">
                <button
                  onClick={() => handleToggle(plugin.id, plugin.state)}
                  disabled={isPending}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    plugin.state === "enabled"
                      ? "bg-red-50 text-red-600 hover:bg-red-100"
                      : "bg-green-50 text-green-600 hover:bg-green-100"
                  } disabled:opacity-50`}
                >
                  {plugin.state === "enabled" ? t("actions.disable") : t("actions.enable")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {plugins.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      )}
    </div>
  );
}
