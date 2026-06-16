"use client";

import {MoonStar, SunMedium} from "lucide-react";
import {useTranslations} from "next-intl";
import {useTheme} from "next-themes";

import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils/cn";

export function ThemeToggle({className}: {className?: string}) {
  const {theme, setTheme} = useTheme();
  const t = useTranslations("Theme");
  const isDark = theme === "dark";
  const nextTheme = isDark ? "light" : "dark";

  function handleToggle() {
    setTheme(nextTheme);
    document.cookie = `theme=${nextTheme};path=/;max-age=31536000;samesite=lax`;
  }

  return (
    <Button
      aria-label={t("toggle")}
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      className={cn("min-h-11 min-w-11 rounded-full p-0", className)}
    >
      {isDark ? <SunMedium size={16} /> : <MoonStar size={16} />}
    </Button>
  );
}
