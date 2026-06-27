"use client";

import {CheckCircle2} from "lucide-react";
import {useTranslations} from "next-intl";
import {Card, CardContent} from "@/components/ui/card";

interface ProfileCompletenessProps {
  hasAvatar: boolean;
  hasCover: boolean;
  hasBio: boolean;
  hasCity: boolean;
  phoneVerified: boolean;
  emailVerified: boolean;
  hasWork: boolean;
  hasEducation: boolean;
  hasInterests: boolean;
  hasLinks: boolean;
}

const ITEMS = [
  {key: "avatar", weight: 12},
  {key: "cover", weight: 8},
  {key: "bio", weight: 15},
  {key: "city", weight: 8},
  {key: "phoneVerified", weight: 15},
  {key: "emailVerified", weight: 12},
  {key: "work", weight: 10},
  {key: "education", weight: 8},
  {key: "interests", weight: 6},
  {key: "links", weight: 6},
] as const;

export function ProfileCompleteness(props: ProfileCompletenessProps) {
  const t = useTranslations("ProfileAbout");

  const status: Record<string, boolean> = {
    avatar: props.hasAvatar,
    cover: props.hasCover,
    bio: props.hasBio,
    city: props.hasCity,
    phoneVerified: props.phoneVerified,
    emailVerified: props.emailVerified,
    work: props.hasWork,
    education: props.hasEducation,
    interests: props.hasInterests,
    links: props.hasLinks,
  };

  const completed = ITEMS.filter((item) => status[item.key]).length;
  const total = ITEMS.length;
  const percent = Math.round((completed / total) * 100);

  if (percent >= 100) return null;

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">{t("profileCompleteness")}</p>
          <span className="text-lg font-bold text-primary">{percent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{width: `${percent}%`}}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("completeYourProfile")}</p>
        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
          {ITEMS.map((item) => {
            const done = status[item.key];
            return (
              <div
                key={item.key}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs ${
                  done ? "text-foreground" : "text-muted-foreground/60"
                }`}
              >
                <CheckCircle2
                  size={14}
                  className={`shrink-0 ${done ? "text-primary" : "text-muted-foreground/30"}`}
                />
                <span className={done ? "font-medium" : ""}>
                  {t(`completenessItems.${item.key}`)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
