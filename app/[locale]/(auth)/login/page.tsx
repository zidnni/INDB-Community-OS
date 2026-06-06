import {getTranslations} from "next-intl/server";

import {LoginForm} from "@/app/[locale]/(auth)/login/login-form";
import {Logo} from "@/components/layout/Logo";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{error?: string; emailConfirmation?: string; next?: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Auth.login"});
  const {error, emailConfirmation, next} = await searchParams;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex justify-center">
        <Logo size="md" priority />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {emailConfirmation ? <p className="rounded-xl bg-primary/10 p-2 text-xs text-primary">{t("emailConfirmation")}</p> : null}
          {error ? <p className="rounded-xl bg-destructive/10 p-2 text-xs text-destructive">{error}</p> : null}
          <LoginForm locale={locale} next={next} />
        </CardContent>
      </Card>
    </div>
  );
}
