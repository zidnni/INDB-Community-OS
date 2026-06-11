import {NextResponse} from "next/server";

interface TestResult {name: string; status?: number; body?: string; error?: string}
interface Results {tests: TestResult[]; environment?: Record<string, unknown>; environment_error?: string}

export async function GET() {
  const results: Results = {tests: []};

  try {
    const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ar&dt=t&q=" + encodeURIComponent("Good morning");
    const res = await fetch(url, {
      headers: {"User-Agent": "Mozilla/5.0"},
    });
    const status = res.status;
    const body = await res.text();
    results.tests.push({name: "google-get", status, body: body.slice(0, 200)});
  } catch (e) {
    results.tests.push({name: "google-get", error: e instanceof Error ? e.message : String(e)});
  }

  try {
    const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent("Good morning") + "&langpair=en|ar";
    const res = await fetch(url, {
      headers: {"User-Agent": "Mozilla/5.0"},
    });
    const status = res.status;
    const body = await res.text();
    results.tests.push({name: "mymemory-get", status, body: body.slice(0, 200)});
  } catch (e) {
    results.tests.push({name: "mymemory-get", error: e instanceof Error ? e.message : String(e)});
  }

  try {
    const serverFetch = typeof fetch !== "undefined";
    const nodeVersion = process.version;
    results.environment = {serverFetch, nodeVersion, vercelRegion: process.env.VERCEL_REGION ?? "unknown"};
  } catch (e) {
    results.environment_error = String(e);
  }

  return NextResponse.json(results);
}
