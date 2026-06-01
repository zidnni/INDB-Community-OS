"use client";

import {motion} from "framer-motion";
import {CalendarDays, ImagePlus, Images, Lightbulb} from "lucide-react";
import {useTranslations} from "next-intl";

import {UserAvatar} from "@/components/layout/user-avatar";
import {Card, CardContent} from "@/components/ui/card";

const quickActions = [
  {key: "photo", icon: ImagePlus},
  {key: "event", icon: CalendarDays},
  {key: "memory", icon: Images},
  {key: "idea", icon: Lightbulb},
] as const;

export function CreatePostCard() {
  const t = useTranslations("FeedComposer");

  return (
    <Card id="create-post" className="border-border/70">
      <CardContent className="space-y-3.5 p-4 sm:space-y-4 sm:p-5">
        <div className="flex items-start gap-3">
          <UserAvatar label={t("title")} className="h-11 w-11 shrink-0" />
          <button
            type="button"
            className="min-h-24 w-full rounded-2xl border border-border/80 bg-muted/35 px-4 py-3 text-start text-sm leading-6 text-muted-foreground transition hover:border-primary/40 hover:bg-muted/55 sm:min-h-28"
            aria-label={t("socialPrompt")}
          >
            {t("socialPrompt")}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {quickActions.map((action, index) => (
            <motion.button
              key={action.key}
              type="button"
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              transition={{delay: index * 0.05, duration: 0.2}}
              whileHover={{y: -2}}
              whileTap={{scale: 0.98}}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/80 bg-card px-3 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground sm:text-sm"
            >
              <action.icon size={16} />
              {t(`quickActions.${action.key}`)}
            </motion.button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
