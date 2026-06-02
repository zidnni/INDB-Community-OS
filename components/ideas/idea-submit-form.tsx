"use client";

import {ImagePlus, X} from "lucide-react";
import {useState} from "react";
import {useTranslations} from "next-intl";
import {useFormStatus} from "react-dom";

import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {submitIdeaAction} from "@/app/[locale]/server-actions";

function SubmitButton({label, loading}: {label: string; loading: string}) {
  const {pending} = useFormStatus();
  return (
    <Button type="submit" className="min-h-11 w-full" disabled={pending}>
      {pending ? loading : label}
    </Button>
  );
}

export function IdeaSubmitForm({
  categories,
  locale,
}: {
  categories: Array<{id: number; name: string}>;
  locale: string;
}) {
  const t = useTranslations("IdeaForm");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={submitIdeaAction} className="space-y-3" encType="multipart/form-data">
          <input type="hidden" name="locale" value={locale} />
          <Input name="title" placeholder={t("fields.title")} required />
          <Textarea name="description" placeholder={t("fields.description")} required />
          <select
            name="categoryId"
            className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
            defaultValue=""
          >
            <option value="">{t("fields.category")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground hover:text-foreground">
            <ImagePlus size={16} />
            Add image
            <input
              name="imageFile"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setImagePreview(URL.createObjectURL(file));
              }}
            />
          </label>
          {imagePreview ? (
            <div className="relative overflow-hidden rounded-xl bg-muted">
              <img src={imagePreview} alt="" className="max-h-48 w-full object-contain" />
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  const input = document.querySelector<HTMLInputElement>('input[name="imageFile"]');
                  if (input) input.value = "";
                }}
                className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-foreground hover:bg-background"
              >
                <X size={14} />
              </button>
            </div>
          ) : null}
          <SubmitButton label={t("submit")} loading={t("submitting")} />
        </form>
      </CardContent>
    </Card>
  );
}
