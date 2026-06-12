"use server";

import {createAdminClient} from "@/lib/supabase/admin";
import {createClient} from "@/lib/supabase/server";
import {detectContentLanguage} from "@/lib/i18n/detectContentLanguage";
import type {ContentLanguage} from "@/types/database";
import crypto from "crypto";

const MAX_LENGTH = 3000;

async function getCachedTranslation(
  contentType: string,
  contentId: string,
  targetLang: string,
): Promise<string | null> {
  const supabase = await createClient();
  const {data} = await supabase
    .from("content_translations")
    .select("translated_text")
    .eq("content_type", contentType)
    .eq("content_id", contentId)
    .eq("target_lang", targetLang)
    .single();
  return data?.translated_text ?? null;
}

async function saveTranslation(
  contentType: string,
  contentId: string,
  sourceLang: ContentLanguage,
  targetLang: ContentLanguage,
  originalHash: string,
  translatedText: string,
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const {error} = await admin.from("content_translations").upsert(
    {
      content_type: contentType,
      content_id: contentId,
      source_lang: sourceLang,
      target_lang: targetLang,
      original_hash: originalHash,
      translated_text: translatedText,
    },
    {onConflict: "content_type,content_id,target_lang"},
  );
  if (error) {
    console.error("translateContentAction: saveTranslation failed", error);
  }
}

function hashText(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

const GOOGLE_SUPPORTED_LANGS = new Set(["ar", "bg", "bn", "ca", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "gu", "he", "hi", "hr", "hu", "id", "it", "ja", "kn", "ko", "lt", "lv", "ml", "mr", "ms", "nl", "no", "pl", "pt", "ro", "ru", "sk", "sl", "sr", "sv", "sw", "ta", "te", "th", "tl", "tr", "uk", "ur", "vi", "zh"]);

function parseGoogleTranslate(data: unknown): string | null {
  try {
    const parts = data as unknown[][];
    const translated: string = (parts?.[0] ?? [])
      .map((part: unknown) => Array.isArray(part) ? String(part[0] ?? "") : "")
      .filter(Boolean)
      .join("");
    return translated || null;
  } catch {
    return null;
  }
}

async function callGoogleTranslate(text: string, targetLang: string): Promise<string | null> {
  if (!GOOGLE_SUPPORTED_LANGS.has(targetLang)) return null;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      headers: {"User-Agent": "Mozilla/5.0 (compatible; GoogleTranslate/1.0)"},
    });
    if (!res.ok) {
      console.error("translateContentAction: Google Translate returned", res.status);
      return null;
    }
    return parseGoogleTranslate(await res.json());
  } catch (e) {
    console.error("translateContentAction: Google Translate failed", e);
    return null;
  }
}

async function callMyMemoryTranslate(text: string, targetLang: string): Promise<string | null> {
  try {
    const langPair = `en|${targetLang}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
    const res = await fetch(url, {
      headers: {"User-Agent": "Mozilla/5.0"},
    });
    if (!res.ok) return null;
    const data = await res.json();
    const translated: string = data?.responseData?.translatedText ?? "";
    return translated || null;
  } catch (e) {
    console.error("translateContentAction: MyMemory failed", e);
    return null;
  }
}

async function callTranslationApi(
  text: string,
  _sourceLang: string,
  targetLang: string,
): Promise<string | null> {
  const result = await callGoogleTranslate(text, targetLang);
  if (result) return result;
  console.error("translateContentAction: Google failed, trying MyMemory fallback");
  return callMyMemoryTranslate(text, targetLang);
}

export interface TranslateResult {
  translatedText: string;
  sourceLang: ContentLanguage;
  error?: string;
}

export async function translateContentAction(
  contentType: string,
  contentId: string,
  text: string,
  targetLang: string,
): Promise<TranslateResult> {
  try {
    if (text.length > MAX_LENGTH) {
      return {translatedText: "", sourceLang: "en", error: "Content too long (max 3000 chars)"};
    }

    const detected = detectContentLanguage(text);
    const sourceLang = detected;

    if (sourceLang === targetLang) {
      return {translatedText: text, sourceLang};
    }

    const cached = await getCachedTranslation(contentType, contentId, targetLang);
    if (cached) {
      return {translatedText: cached, sourceLang};
    }

    const originalHash = hashText(text);
    const apiResult = await callTranslationApi(text, sourceLang, targetLang);

    if (!apiResult) {
      return {translatedText: "", sourceLang, error: "All translation APIs returned no result"};
    }

    await saveTranslation(contentType, contentId, sourceLang, targetLang as ContentLanguage, originalHash, apiResult);

    return {translatedText: apiResult, sourceLang};
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {translatedText: "", sourceLang: "en", error: msg};
  }
}
