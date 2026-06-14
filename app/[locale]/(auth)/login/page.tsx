import {getTranslations} from "next-intl/server";

import {LoginForm} from "@/app/[locale]/(auth)/login/login-form";
import {Logo} from "@/components/layout/Logo";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{next?: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Auth.login"});
  const {next} = await searchParams;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="flex justify-center pt-4">
        <Logo size="md" priority />
      </div>
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-semibold tracking-tight">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm locale={locale} next={next} />
        </CardContent>
      </Card>
    </div>
  );
}
