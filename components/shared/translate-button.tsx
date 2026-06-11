"use client";

import {useLocale, useTranslations} from "next-intl";
import {useState, useCallback} from "react";

interface Props {
  text: string;
  contentType: string;
  contentId: string;
  className?: string;
}

export function TranslateButton({text, contentType, contentId, className = ""}: Props) {
  const locale = useLocale();
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showingTranslation, setShowingTranslation] = useState(false);

  const translatingT = useTranslations("Translating");

  const handleTranslate = useCallback(async () => {
    if (translated) {
      setShowingTranslation((prev) => !prev);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({text, target: locale, type: contentType, id: contentId});
      const res = await fetch("/api/translate?" + params.toString());
      const result = await res.json();
      if (result.error) {
        setError(result.error);
        return;
      }
      setTranslated(result.translatedText);
      setShowingTranslation(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [text, contentType, contentId, locale, translated]);

  if (!text || text.length < 10) return null;

  if (loading) {
    return (
      <span className={`text-xs text-muted-foreground italic ${className}`}>
        {translatingT("translating")}
      </span>
    );
  }

  if (error) {
    return (
      <div className={className + " border border-destructive/30 rounded-lg p-2"}>
        <span className="text-xs text-destructive">{translatingT("unavailable")}</span>
        <span className="block text-xs text-destructive/70 mt-1 font-mono">{error}</span>
      </div>
    );
  }

  if (showingTranslation && translated) {
    return (
      <div className={className}>
        <p className="whitespace-pre-wrap break-words">{translated}</p>
        <button
          type="button"
          onClick={() => setShowingTranslation(false)}
          className="mt-1 text-xs text-primary hover:underline"
        >
          {translatingT("showOriginal")}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleTranslate}
      className={`text-xs text-primary hover:underline ${className}`}
    >
      {translatingT("seeTranslation")}
    </button>
  );
}
