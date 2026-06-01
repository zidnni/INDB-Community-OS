"use client";

import {motion} from "framer-motion";
import {CalendarDays, MapPin} from "lucide-react";
import {useTranslations} from "next-intl";

import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import type {EventItem} from "@/types/community";

export function EventCard({event}: {event: EventItem}) {
  const t = useTranslations("Events");

  return (
    <motion.article
      initial={{opacity: 0, y: 12}}
      animate={{opacity: 1, y: 0}}
      whileHover={{y: -2}}
      transition={{duration: 0.25, ease: "easeOut"}}
    >
      <Card className="overflow-hidden border-border/70">
        <img src={event.image} alt={event.title} className="h-40 w-full object-cover sm:h-44" />
        <CardHeader className="pb-2.5">
          <CardTitle className="text-[15px] sm:text-base">{event.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays size={13} />
            {event.date}
          </p>
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin size={13} />
            {event.location}
          </p>
          <p className="text-sm text-muted-foreground">{event.description}</p>
          <Button className="min-h-11 w-full">{t("rsvp")}</Button>
        </CardContent>
      </Card>
    </motion.article>
  );
}
