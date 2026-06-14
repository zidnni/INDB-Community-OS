import {MailCheck} from "lucide-react";
import {getTranslations} from "next-intl/server";

import {LoginForm} from "@/app/[locale]/(auth)/login/login-form";
import {Logo} from "@/components/layout/Logo";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Link} from "@/lib/i18n/routing";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{next?: string; emailConfirmation?: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Auth.login"});
  const {next, emailConfirmation} = await searchParams;
  const isEmailConfirmation = emailConfirmation === "1";

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="flex justify-center pt-4">
        <Logo size="md" priority />
      </div>
      {isEmailConfirmation ? (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <MailCheck size={28} className="text-green-600" />
              </div>
              <p className="text-sm text-muted-foreground">{t("emailConfirmation")}</p>
            </div>
            <Link href={`/${locale}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="block">
              <Button className="w-full bg-[#ED2124] hover:bg-[#ED2124]/90 text-white">{t("title")}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-semibold tracking-tight">{t("title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <LoginForm locale={locale} next={next} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
