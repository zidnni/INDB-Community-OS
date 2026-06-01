"use client";

import {motion} from "framer-motion";
import {MapPin, UserRound} from "lucide-react";

import {Badge} from "@/components/ui/badge";
import type {MemoryItem} from "@/lib/constants/mock-data";
import {Link} from "@/lib/i18n/routing";

export function MemoryCard({memory}: {memory: MemoryItem}) {
  return (
    <motion.article
      initial={{opacity: 0, y: 14}}
      animate={{opacity: 1, y: 0}}
      whileHover={{y: -3}}
      transition={{duration: 0.28, ease: "easeOut"}}
      className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_16px_36px_rgba(8,33,56,0.10)]"
    >
      <Link href={`/memory/${memory.slug}` as never} className="block">
        <div className="relative">
          <img src={memory.image} alt={memory.title} className="h-56 w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-3">
            <Badge className="bg-card/85 text-foreground">{memory.year}</Badge>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <h3 className="text-lg font-semibold leading-tight">{memory.title}</h3>
          <p className="text-sm text-muted-foreground">{memory.summary}</p>

          <div className="flex flex-wrap gap-2">
            <Badge className="rounded-lg border-primary/15 bg-primary/8 px-2 py-1 text-[11px] font-medium">
              <MapPin size={12} className="me-1" />
              {memory.location}
            </Badge>
            <Badge className="rounded-lg border-primary/15 bg-primary/8 px-2 py-1 text-[11px] font-medium">
              <UserRound size={12} className="me-1" />
              {memory.contributor}
            </Badge>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
