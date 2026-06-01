"use client";

import {motion} from "framer-motion";
import {ChevronUp} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";

import {Button} from "@/components/ui/button";
import {voteIdeaAction} from "@/app/[locale]/server-actions";

export function VoteButton({ideaId, votes}: {ideaId: string; votes: number}) {
  const t = useTranslations("Ideas");
  const locale = useLocale();

  return (
    <motion.div whileHover={{scale: 1.02}} whileTap={{scale: 0.98}}>
      <form action={voteIdeaAction} className="inline">
        <input type="hidden" name="ideaId" value={ideaId} />
        <input type="hidden" name="locale" value={locale} />
        <Button variant="accent" className="gap-1.5" type="submit">
          <ChevronUp size={16} />
          {t("vote", {count: votes})}
        </Button>
      </form>
    </motion.div>
  );
}
