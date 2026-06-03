import {getTranslations} from "next-intl/server";

import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";

const targetTypeKeys: Record<string, string> = {
  memory: "memory",
  post: "post",
};

const statusKeys: Record<string, string> = {
  pending: "pending",
};

export async function ModerationQueue({
  items,
}: {
  items: Array<{
    id: string;
    target_type: string;     
    reason: string;
    status: string;
    created_at: string;
  }>;
}) {
  const t = await getTranslations("Admin");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("moderationQueue")}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noPendingReports")}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const targetTypeKey = targetTypeKeys[item.target_type] ?? "post";
              const statusKey = statusKeys[item.status] ?? "pending";

              return (
                <li key={item.id} className="rounded-xl bg-muted/50 p-3 text-sm">
                  <p className="font-medium">
                    {t(`targetType.${targetTypeKey}`)} · {t(`status.${statusKey}`)}
                  </p>
                  <p className="text-muted-foreground">{item.reason}</p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

