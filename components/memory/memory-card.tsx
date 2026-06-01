"use client";

import {motion} from "framer-motion";
import {MapPin, UserRound} from "lucide-react";

import {Badge} from "@/components/ui/badge";
import type {MemoryWithContributor} from "@/types/database";
import {Link} from "@/lib/i18n/routing";

export function MemoryCard({memory}: {memory: MemoryWithContributor}) {
  const contributorName = memory.contributor?.full_name ?? memory.contributor?.username ?? "Unknown";

  return (
    <motion.article
      initial={{opacity: 0, y: 14}}
      animate={{opacity: 1, y: 0}}
      whileHover={{y: -3}}
      transition={{duration: 0.28, ease: "easeOut"}}
      className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_16px_36px_rgba(8,33,56,0.10)]"
    >
      <Link href={`/memory/${memory.id}`} className="block">
        <div className="relative">
          {memory.media_url ? (
            <img src={memory.media_url} alt={memory.title} className="h-52 w-full object-cover sm:h-56" />
          ) : (
            <div className="flex h-52 w-full items-center justify-center bg-muted sm:h-56">
              <span className="text-muted-foreground">No image</span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-3">
            <Badge className="bg-card/85 text-foreground">{memory.decade ?? memory.year ?? "?"}</Badge>
          </div>
        </div>

        <div className="space-y-2.5 p-4">
          <h3 className="text-base font-semibold leading-tight sm:text-lg">{memory.title}</h3>
          <p className="text-sm text-muted-foreground">{memory.description ?? memory.title}</p>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {memory.location ? (
              <Badge className="rounded-lg border-primary/15 bg-primary/8 px-2 py-1 text-[11px] font-medium">
                <MapPin size={12} className="me-1" />
                {memory.location}
              </Badge>
            ) : null}
            <Badge className="rounded-lg border-primary/15 bg-primary/8 px-2 py-1 text-[11px] font-medium">
              <UserRound size={12} className="me-1" />
              {contributorName}
            </Badge>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
