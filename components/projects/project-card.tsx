"use client";

import {motion} from "framer-motion";
import {Users} from "lucide-react";
import {useTranslations} from "next-intl";

import {Badge} from "@/components/ui/badge";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import type {ProjectWithCreator} from "@/types/database";

export function ProjectCard({project}: {project: ProjectWithCreator}) {
  const t = useTranslations("Projects");

  return (
    <motion.article
      initial={{opacity: 0, y: 12}}
      animate={{opacity: 1, y: 0}}
      whileHover={{y: -2}}
      transition={{duration: 0.25, ease: "easeOut"}}
    >
      <Card className="overflow-hidden border-border/70">
        {project.image_url ? (
          <img src={project.image_url} alt={project.title} className="h-40 w-full object-cover sm:h-44" />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-muted sm:h-44">
            <Users size={32} className="text-muted-foreground/40" />
          </div>
        )}
        <CardHeader className="pb-2.5">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-[15px] sm:text-base">{project.title}</CardTitle>
            <Badge>{t(`status.${project.status}`)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5 pt-0 sm:space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <p>{t("progress")}</p>
              <p>{project.progress}%</p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{width: `${project.progress}%`}} />
            </div>
          </div>
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users size={13} />
            {t("volunteers", {count: project.volunteers_count})}
          </p>
        </CardContent>
      </Card>
    </motion.article>
  );
}
