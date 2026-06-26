import {AboutPlatformClient} from "@/components/about/about-platform-client";

export default async function HomePage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return <AboutPlatformClient locale={locale} />;
}
