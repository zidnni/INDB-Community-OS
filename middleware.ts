import createMiddleware from "next-intl/middleware";
import {type NextRequest, NextResponse} from "next/server";

import {routing} from "@/lib/i18n/routing";
import {getSupabaseEnv} from "@/lib/constants/env";
import {createServerClient} from "@supabase/ssr";

const handleI18nRouting = createMiddleware(routing);

const protectedPaths = ["/feed", "/profile", "/ideas/submit", "/memory/submit", "/admin"];
const authPaths = ["/login", "/register", "/forgot-password"];

function matchPath(pathname: string, patterns: string[]): boolean {
  return patterns.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default async function middleware(request: NextRequest) {
  const {pathname} = request.nextUrl;

  const locale = routing.locales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) ?? routing.defaultLocale;
  const pathWithoutLocale = "/" + pathname.split("/").slice(2).join("/");

  const needsAuth = matchPath(pathWithoutLocale, protectedPaths);
  const isAuthPage = matchPath(pathWithoutLocale, authPaths);

  if (needsAuth || isAuthPage) {
    const env = getSupabaseEnv();
    const response = handleI18nRouting(request);

    const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({name, value}) => request.cookies.set(name, value));
          cookiesToSet.forEach(({name, value, options}) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {data} = await supabase.auth.getUser();
    const user = data.user;

    if (needsAuth && !user) {
      const authUrl = new URL(`/${locale}/register`, request.url);
      authUrl.searchParams.set("next", pathWithoutLocale);
      return NextResponse.redirect(authUrl);
    }

    if (isAuthPage && user) {
      return NextResponse.redirect(new URL(`/${locale}/feed`, request.url));
    }

    return response;
  }

  return handleI18nRouting(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
