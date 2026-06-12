import {NextResponse} from "next/server";

import {globalSearch} from "@/lib/data/search";
import {checkRateLimit, getRequestIdentifier} from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const locale = searchParams.get("locale") ?? "fr";
  const limit = Number(searchParams.get("limit") ?? "5");
  const rateLimit = await checkRateLimit("search", getRequestIdentifier(request));

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {error: "rate_limited"},
      {status: 429, headers: {"Retry-After": String(rateLimit.retryAfter)}},
    );
  }

  try {
    const results = await globalSearch(query, locale, {
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 20) : 5,
    });

    return NextResponse.json({results});
  } catch {
    return NextResponse.json(
      {error: "search_failed"},
      {status: 500},
    );
  }
}
