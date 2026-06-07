"use client";

import {useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {toast} from "sonner";

import {createPostAction} from "@/app/[locale]/server-actions";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {useRouter} from "@/lib/i18n/routing";

export function CreatePostBox({
  categories,
}: {
  categories: Array<{id: number; name: string}>;
}) {
  const t = useTranslations("FeedComposer");
  const toastT = useTranslations("Toasts");
  const locale = useLocale();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.set("locale", locale);
    try {
      const result = await createPostAction(formData);
      if (result.success) {
        toast.success(toastT("postCreated"));
        router.refresh();
        return;
      }
      toast.error(result.error || t("errors.submitFailed"));
    } catch {
      toast.error(t("errors.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("composerTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input name="title" placeholder={t("form.title")} required />
          <Textarea name="content" placeholder={t("form.content")} required />
          <Input name="mediaUrl" placeholder={t("form.mediaUrl")} />
          <select
            name="categoryId"
            required
            className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
            defaultValue=""
          >
            <option disabled value="">
              {t("form.selectCategory")}
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={submitting}>
            {submitting ? t("posting") : t("form.publish")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

