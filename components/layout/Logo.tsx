"use client";

import Image from "next/image";
import {useTranslations} from "next-intl";

import {cn} from "@/lib/utils/cn";

type LogoVariant = "icon" | "full";
type LogoSize = "sm" | "md" | "lg";

interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
  priority?: boolean;
}

const FULL_LOGO_SRC = "/images/logondb.png";
const ICON_LOGO_SRC: string | null = null;
const LOGO_WIDTH = 1408;
const LOGO_HEIGHT = 768;

const sizeMap: Record<LogoSize, string> = {
  sm: "w-24 sm:w-28",
  md: "w-32 sm:w-36",
  lg: "w-44 sm:w-52",
};

export function Logo({
  variant = "full",
  size = "md",
  className,
  priority = false,
}: LogoProps) {
  const t = useTranslations("Brand");
  const shouldUseIconFile = variant === "icon" && Boolean(ICON_LOGO_SRC);
  const src = shouldUseIconFile ? (ICON_LOGO_SRC as string) : FULL_LOGO_SRC;

  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", sizeMap[size], className)}>
      <Image
        src={src}
        alt={t("alt")}
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        priority={priority}
        sizes="(max-width: 640px) 120px, (max-width: 1024px) 160px, 208px"
        className="h-auto w-full object-contain"
      />
    </span>
  );
}
