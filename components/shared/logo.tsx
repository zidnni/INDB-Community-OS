import Image from "next/image";
import {cn} from "@/lib/utils/cn";

type LogoSize = "sm" | "md" | "lg";

interface LogoProps {
  size?: LogoSize;
  className?: string;
  priority?: boolean;
}

const LOGO_SRC = "/images/logondb.jpeg";
const LOGO_WIDTH = 1408;
const LOGO_HEIGHT = 768;

const sizeMap: Record<LogoSize, string> = {
  sm: "w-12 sm:w-16",
  md: "w-28 sm:w-32",
  lg: "w-24 sm:w-40",
};

export function Logo({size = "md", className, priority = false}: LogoProps) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-sm", sizeMap[size], className)}>
      <Image
        src={LOGO_SRC}
        alt="INDB"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        priority={priority}
        className="h-auto w-full object-contain"
      />
    </span>
  );
}
