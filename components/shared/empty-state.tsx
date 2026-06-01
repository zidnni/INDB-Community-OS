import type {LucideIcon} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";
import {Link} from "@/lib/i18n/routing";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
}: EmptyStateProps) {
  return (
    <Card className="border-dashed border-border/80">
      <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/12 text-primary">
          <Icon size={20} />
        </span>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        {ctaLabel && ctaHref ? (
          <Link href={ctaHref as never}>
            <Button className="mt-2 min-h-11 px-5">{ctaLabel}</Button>
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
