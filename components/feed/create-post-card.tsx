"use client";

import {useState} from "react";
import {motion} from "framer-motion";
import {CalendarDays, ImagePlus, Images, Lightbulb, X} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {useFormStatus} from "react-dom";

import {UserAvatar} from "@/components/layout/user-avatar";
import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";
import {Textarea} from "@/components/ui/textarea";
import {createPostAction} from "@/app/[locale]/server-actions";

function SubmitButton({label, loading}: {label: string; loading: string}) {
  const {pending} = useFormStatus();
  return (
    <Button type="submit" className="min-h-11" disabled={pending}>
      {pending ? loading : label}
    </Button>
  );
}

export function CreatePostCard({avatarUrl}: {avatarUrl?: string | null}) {
  const t = useTranslations("FeedComposer");
  const locale = useLocale();
  const [showForm, setShowForm] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  if (!showForm) {
    return (
      <Card id="create-post" className="border-border/70">
        <CardContent className="space-y-3.5 p-4 sm:space-y-4 sm:p-5">
          <div className="flex items-start gap-3">
            <UserAvatar label={t("title")} avatarUrl={avatarUrl} className="h-11 w-11 shrink-0" />
            <button
              type="button"
              onClick={() => setShowForm(true)}
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
                onClick={() => setShowForm(true)}
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

  return (
    <Card id="create-post" className="border-border/70">
      <CardContent className="space-y-3.5 p-4 sm:space-y-4 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{t("socialPrompt")}</p>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X size={18} />
          </button>
        </div>
        <form action={createPostAction} className="space-y-3" encType="multipart/form-data">
          <input type="hidden" name="locale" value={locale} />
          <Textarea name="content" placeholder={t("socialPrompt")} required />
          <div className="flex items-center gap-2">
            <select
              name="type"
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm"
              defaultValue="community"
            >
              <option value="community">{t("quickActions.text")}</option>
              <option value="news">Local news</option>
              <option value="memory">{t("quickActions.memory")}</option>
              <option value="idea">{t("quickActions.idea")}</option>
              <option value="event">{t("quickActions.event")}</option>
              <option value="project">Project</option>
            </select>
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground hover:text-foreground">
              <ImagePlus size={16} />
              {t("quickActions.image")}
              <input
                name="imageFile"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setImagePreview(URL.createObjectURL(file));
                }}
              />
            </label>
          </div>
          {imagePreview ? (
            <div className="relative overflow-hidden rounded-xl bg-muted">
              <img src={imagePreview} alt="" className="max-h-48 w-full object-contain" />
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  const input = document.querySelector<HTMLInputElement>('input[name="imageFile"]');
                  if (input) input.value = "";
                }}
                className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-foreground hover:bg-background"
              >
                <X size={14} />
              </button>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="min-h-11">
              {t("cancel")}
            </Button>
            <SubmitButton label={t("post")} loading={t("posting")} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

const quickActions = [
  {key: "photo", icon: ImagePlus},
  {key: "event", icon: CalendarDays},
  {key: "memory", icon: Images},
  {key: "idea", icon: Lightbulb},
] as const;
