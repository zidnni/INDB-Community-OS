"use client";

import {AnimatePresence, motion} from "framer-motion";
import {Bell} from "lucide-react";
import {useState} from "react";
import {useTranslations} from "next-intl";

import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";

const notificationKeys = ["cleanup", "memoryAdded", "ideaVotes"] as const;

export function NotificationDropdown() {
  const t = useTranslations("Notifications");
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        aria-label={t("button")}
        onClick={() => setOpen((prev) => !prev)}
        className="min-h-11 min-w-11 rounded-full p-0"
      >
        <Bell size={18} />
      </Button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{opacity: 0, y: 8}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: 8}}
            transition={{duration: 0.2}}
            className="absolute end-0 top-12 z-40 w-[min(90vw,290px)]"
          >
            <Card className="border-border/80 bg-card">
              <CardHeader>
                <CardTitle className="text-sm">{t("title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {notificationKeys.map((key) => (
                  <p key={key} className="rounded-xl bg-muted/60 p-2 text-xs text-muted-foreground">
                    {t(`items.${key}`)}
                  </p>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

