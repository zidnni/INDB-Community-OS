import {getTranslations} from "next-intl/server";
import {getAllPlugins} from "@/core/plugins/registry";
import {AdminPluginsClient} from "./admin-plugins-client";
import {getPluginStates} from "./actions";

export default async function AdminPluginsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Admin"});
  const dbStates = await getPluginStates();

  const plugins = getAllPlugins().map((entry) => {
    const dbState = dbStates[entry.manifest.id];
    const effectiveState = dbState === "disabled" ? "disabled" : entry.state;
    const itemKey = `plugins.items.${entry.manifest.id}`;
    return {
      id: entry.manifest.id,
      name: t.has(`${itemKey}.name`) ? t(`${itemKey}.name`) : entry.manifest.name,
      version: entry.manifest.version,
      description: t.has(`${itemKey}.description`) ? t(`${itemKey}.description`) : entry.manifest.description,
      state: effectiveState,
      navKey: entry.manifest.nav?.key ?? null,
      routePrefixes: entry.manifest.routePrefixes,
    };
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("nav.plugins")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("plugins.subtitle")}
        </p>
      </div>
      <AdminPluginsClient plugins={plugins} />
    </div>
  );
}
