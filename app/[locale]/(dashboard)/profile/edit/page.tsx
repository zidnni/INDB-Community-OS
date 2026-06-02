import {redirect} from "@/lib/i18n/routing";

export default async function ProfileEditPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;

  redirect({href: "/profile", locale});
}
