"use client";

import {motion} from "framer-motion";
import {Lightbulb} from "lucide-react";

import {IdeaStatusBadge} from "@/components/ideas/idea-status-badge";
import {VoteButton} from "@/components/ideas/vote-button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import type {IdeaWithAuthor} from "@/types/database";

export function IdeaCard({idea}: {idea: IdeaWithAuthor}) {
  return (
    <motion.article
      initial={{opacity: 0, y: 14}}
      animate={{opacity: 1, y: 0}}
      transition={{duration: 0.28, ease: "easeOut"}}
    >
      <Card>
        {idea.image_url ? (
          <img src={idea.image_url} alt={idea.title} className="h-48 w-full rounded-t-2xl object-cover" />
        ) : null}
        <CardHeader className="pb-2.5">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="inline-flex items-center gap-2 text-[15px] sm:text-base">
              <Lightbulb size={16} />
              {idea.title}
            </CardTitle>
            <IdeaStatusBadge status={idea.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5 pt-0 sm:space-y-3">
          <p className="text-sm text-muted-foreground">{idea.description}</p>
          <VoteButton ideaId={idea.id} votes={idea.votes_count} />
        </CardContent>
      </Card>
    </motion.article>
  );
}
