import {NextResponse} from "next/server";

import {checkRateLimit} from "@/lib/security/rate-limit";
import {createClient} from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({error: "unauthorized"}, {status: 401});
  }

  const rateLimit = await checkRateLimit("upload", user.id);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {error: "rate_limited"},
      {status: 429, headers: {"Retry-After": String(rateLimit.retryAfter)}},
    );
  }

  return NextResponse.json({ok: true});
}
