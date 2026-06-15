import createMiddleware from "next-intl/middleware";
import {type NextRequest, NextResponse} from "next/server";

import {routing} from "@/lib/i18n/routing";
import {getSupabaseEnv} from "@/lib/constants/env";
import {createServerClient} from "@supabase/ssr";

const handleI18nRouting = createMiddleware(routing);

const protectedPaths = ["/feed", "/profile", "/ideas", "/memory", "/admin", "/events", "/fadla", "/polls", "/projects", "/search", "/timeline", "/post", "/onboarding"];
const authPaths = ["/login", "/register", "/forgot-password"];

function matchPath(pathname: string, patterns: string[]): boolean {
  return patterns.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default async function middleware(request: NextRequest) {
  const {pathname, searchParams} = request.nextUrl;
  request.headers.set("x-indb-pathname", pathname);

  // OAuth code param detected — redirect to callback page immediately
  const oauthCode = searchParams.get("code");
  if (oauthCode) {
    const locale = routing.locales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) ?? routing.defaultLocale;
    const cbUrl = new URL("/auth/callback", request.url);
    cbUrl.searchParams.set("code", oauthCode);
    cbUrl.searchParams.set("locale", locale);
    return NextResponse.redirect(cbUrl);
  }

  const locale = routing.locales.find((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`) ?? routing.defaultLocale;
  const pathWithoutLocale = "/" + pathname.split("/").slice(2).join("/");

  const needsAuth = matchPath(pathWithoutLocale, protectedPaths);
  const isAuthPage = matchPath(pathWithoutLocale, authPaths);

  const response = handleI18nRouting(request);

  try {
    const env = getSupabaseEnv();
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
  } catch {
    // Session refresh failed, continue with i18n routing
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|auth|.*\\..*).*)"],
};
