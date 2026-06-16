import type {Metadata, Viewport} from "next";
import {cookies, headers} from "next/headers";
import {hasLocale} from "next-intl";

import {routing} from "@/lib/i18n/routing";
import "./globals.css";

export const metadata: Metadata = {
  title: "I love NDB | INDB Community OS",
  description:
    "Nouadhibou community platform for civic memory, participation, and solutions.",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "INDB",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "I love NDB | INDB Community OS",
    description:
      "Nouadhibou community platform for civic memory, participation, and solutions.",
    url: "https://indb-community-os.vercel.app",
    siteName: "INDB Community OS",
    images: [
      {
        url: "/images/logondb.jpeg",
        width: 1408,
        height: 768,
        alt: "INDB Community OS",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "I love NDB | INDB Community OS",
    description:
      "Nouadhibou community platform for civic memory, participation, and solutions.",
    images: ["/images/logondb.jpeg"],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "theme-color": "#f5f7fa",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "INDB",
    "apple-mobile-web-app-status-bar-style": "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{children: React.ReactNode}>) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const requestedLocale =
    headerStore.get("x-next-intl-locale") ?? cookieStore.get("NEXT_LOCALE")?.value;
  const locale = hasLocale(routing.locales, requestedLocale)
    ? requestedLocale
    : routing.defaultLocale;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const isQrVisitor =
    cookieStore.get("qr_ref")?.value === "1" ||
    cookieStore.get("entry")?.value === "qr";
  const cookieTheme = cookieStore.get("theme")?.value;
  const initialTheme = isQrVisitor ? "light" : cookieTheme === "dark" ? "dark" : "light";
  const themeInitScript = `(function(){var d=document.documentElement,c=document.cookie||"",m=c.match(/(?:^|; )theme=([^;]+)/),ct=m?decodeURIComponent(m[1]):"",forced=/(?:^|; )qr_ref=1(?:;|$)/.test(c)||/(?:^|; )entry=qr(?:;|$)/.test(c),stored;try{stored=localStorage.getItem("theme")}catch(e){}var theme=forced?"light":(ct==="dark"||ct==="light"?ct:(stored==="dark"||stored==="light"?stored:"light"));if(forced||ct==="dark"||ct==="light"||!stored){try{localStorage.setItem("theme",theme)}catch(e){}}d.classList.toggle("dark",theme==="dark");d.style.colorScheme=theme;})();`;
  return (
    <html
      lang={locale}
      dir={dir}
      className={initialTheme === "dark" ? "dark" : undefined}
      suppressHydrationWarning
      style={{colorScheme: initialTheme} as React.CSSProperties}
    >
      <head>
        <script dangerouslySetInnerHTML={{__html: themeInitScript}} />
      </head>
      <body className="antialiased">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.addEventListener("touchstart",function(e){var t=e.target.closest("button,a,[role=button],summary");if(t)t.classList.add("touch-pressed")},{passive:true});document.addEventListener("touchend",function(e){var t=e.target.closest("button,a,[role=button],summary");if(t)setTimeout(function(){t.classList.remove("touch-pressed")},120)},{passive:true});`,
          }}
        />
        {process.env.NODE_ENV === "development" ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `document.addEventListener("DOMContentLoaded",()=>{const w=document.documentElement.clientWidth;document.querySelectorAll("*").forEach(el=>{if(el.scrollWidth>w&&el!==document.documentElement&&el!==document.body){console.warn("[OVFL]",el.tagName,el.className,el.scrollWidth+">"+w)}})})`,
            }}
          />
        ) : null}
      </body>
    </html>
  );
}
