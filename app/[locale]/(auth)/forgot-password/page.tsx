import {getTranslations} from "next-intl/server";

import {ForgotPasswordForm} from "@/app/[locale]/(auth)/forgot-password/forgot-password-form";
import {Logo} from "@/components/layout/Logo";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";

export default async function ForgotPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{sent?: string; error?: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Auth.forgotPassword"});
  const {sent, error} = await searchParams;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex justify-center">
        <Logo size="lg" priority className="w-36 sm:w-44" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sent ? <p className="rounded-xl bg-primary/10 p-2 text-xs text-primary">{t("sent")}</p> : null}
          {error ? <p className="rounded-xl bg-destructive/10 p-2 text-xs text-destructive">{error}</p> : null}
          <ForgotPasswordForm locale={locale} />
        </CardContent>
      </Card>
    </div>
  );
}
