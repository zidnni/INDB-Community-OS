"use client";

import {motion} from "framer-motion";
import {CalendarDays, MapPin} from "lucide-react";
import {useTranslations} from "next-intl";
import {toast} from "sonner";

import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import type {EventWithCreator} from "@/types/database";

export function EventCard({event}: {event: EventWithCreator}) {
  const t = useTranslations("Events");
  const common = useTranslations("Toasts");

  return (
    <motion.article
      initial={{opacity: 0, y: 12}}
      animate={{opacity: 1, y: 0}}
      whileHover={{y: -2}}
      transition={{duration: 0.25, ease: "easeOut"}}
    >
      <Card className="overflow-hidden border-border/70">
        {event.image_url ? (
          <img src={event.image_url} alt={event.title} className="h-40 w-full object-cover sm:h-44" />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-muted sm:h-44">
            <CalendarDays size={32} className="text-muted-foreground/40" />
          </div>
        )}
        <CardHeader className="pb-2.5">
          <CardTitle className="text-[15px] sm:text-base">{event.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {event.date ? (
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays size={13} />
              {new Date(event.date).toLocaleDateString()}
            </p>
          ) : null}
          {event.location ? (
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={13} />
              {event.location}
            </p>
          ) : null}
          {event.description ? (
            <p className="text-sm text-muted-foreground">{event.description}</p>
          ) : null}
          <Button className="min-h-11 w-full" onClick={() => toast.success(common("comingSoon"))}>{t("rsvp")}</Button>
        </CardContent>
      </Card>
    </motion.article>
  );
}
