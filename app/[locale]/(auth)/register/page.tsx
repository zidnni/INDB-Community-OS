import {getTranslations} from "next-intl/server";

import {RegisterForm} from "@/app/[locale]/(auth)/register/register-form";
import {Logo} from "@/components/layout/Logo";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{error?: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Auth.register"});
  const {error} = await searchParams;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex justify-center">
        <Logo variant="full" size="lg" priority className="w-36 sm:w-44" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <p className="rounded-xl bg-primary/10 p-2 text-xs text-primary">{error}</p> : null}
          <RegisterForm />
        </CardContent>
      </Card>
    </div>
  );
}

