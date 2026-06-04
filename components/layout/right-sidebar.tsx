import {History} from "lucide-react";
import {getTranslations} from "next-intl/server";

import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {getApprovedMemories} from "@/lib/data/memories";

export async function RightSidebar() {
  const t = await getTranslations("RightSidebar");
  const featuredMemories = await getApprovedMemories();

  return (
    <div className="sticky top-22 space-y-4">
      {featuredMemories.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-lg">
              <History size={18} />
              {t("featuredMemories")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {featuredMemories.slice(0, 3).map((memory) => (
              <div key={memory.id} className="rounded-xl bg-muted/60 p-2">
                <p className="text-base font-semibold">{memory.title}</p>
                <p className="text-sm text-muted-foreground">{memory.year ?? memory.decade ?? "?"}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
