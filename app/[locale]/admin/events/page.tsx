import {getTranslations} from "next-intl/server";
import {AdminEventLogsClient} from "./admin-event-logs-client";
import {getAdminEventLogs} from "./actions";

export default async function AdminEventsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Admin"});
  const logs = await getAdminEventLogs(200);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("nav.events")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("events.subtitle")}
        </p>
      </div>
      <AdminEventLogsClient logs={logs} />
    </div>
  );
}
