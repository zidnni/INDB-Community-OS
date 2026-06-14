import {getTranslations} from "next-intl/server";

import {ForgotPasswordForm} from "@/app/[locale]/(auth)/forgot-password/forgot-password-form";
import {Logo} from "@/components/layout/Logo";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Auth.forgotPassword"});

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
          <ForgotPasswordForm locale={locale} />
        </CardContent>
      </Card>
    </div>
  );
}
