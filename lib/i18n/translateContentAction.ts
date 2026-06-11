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
  const supabase = admin ?? await createClient();
  const {error} = await supabase.from("content_translations").upsert(
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

async function callTranslationApi(
  text: string,
  _sourceLang: string,
  targetLang: string,
): Promise<string | null> {
  if (!GOOGLE_SUPPORTED_LANGS.has(targetLang)) {
    console.error("translateContentAction: Google Translate does not support", targetLang);
    return null;
  }
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t`;
    const res = await fetch(url, {
      method: "POST",
      headers: {"Content-Type": "application/x-www-form-urlencoded"},
      body: new URLSearchParams({q: text}),
    });
    if (!res.ok) {
      console.error("translateContentAction: Google Translate returned", res.status);
      return null;
    }
    const data = await res.json();
    const translated: string = (data?.[0] ?? [])
      .map((part: unknown) => Array.isArray(part) ? part[0] : "")
      .filter(Boolean)
      .join("");
    return translated || null;
  } catch (e) {
    console.error("translateContentAction: API call failed", e);
    return null;
  }
}

export interface TranslateResult {
  translatedText: string;
  sourceLang: ContentLanguage;
}

export async function translateContentAction(
  contentType: string,
  contentId: string,
  text: string,
  targetLang: string,
): Promise<TranslateResult> {
  if (text.length > MAX_LENGTH) {
    throw new Error("Content too long to translate");
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
  const apiResult = await callTranslationApi(
    text,
    sourceLang,
    targetLang,
  );

  if (!apiResult) {
    console.error("translateContentAction: API returned null for", {contentType, contentId, sourceLang, targetLang: targetLang as ContentLanguage});
    throw new Error("Translation unavailable");
  }

  await saveTranslation(
    contentType,
    contentId,
    sourceLang,
    targetLang as ContentLanguage,
    originalHash,
    apiResult,
  );

  return {translatedText: apiResult, sourceLang};
}
