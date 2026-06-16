"use client";

import {AlertCircle, Loader2, Send} from "lucide-react";
import {useTranslations} from "next-intl";
import {useEffect, useRef, useState} from "react";

import {sendFadlaMessageAction} from "@/app/[locale]/server-actions";
import {Button} from "@/components/ui/button";
import type {FadlaRequestMessageWithSender} from "@/types/database";

interface Props {
  requestId: string;
  shareId: string;
  currentUserId: string;
  locale: string;
  initialMessages: FadlaRequestMessageWithSender[];
}

interface DisplayMessage {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  pending?: boolean;
}

export function FadlaDiscussion({requestId, shareId, currentUserId, locale, initialMessages}: Props) {
  const t = useTranslations("Fadla.discussion");
  const [messages, setMessages] = useState<DisplayMessage[]>(
    initialMessages.map((m) => ({id: m.id, sender_id: m.sender_id, message: m.message, created_at: m.created_at})),
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({behavior: "smooth"});
  }, [messages]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending || trimmed.length > 500) return;
    setSending(true);
    setError(null);

    const optimisticId = `opt-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {id: optimisticId, sender_id: currentUserId, message: trimmed, created_at: new Date().toISOString(), pending: true},
    ]);
    setInput("");

    const formData = new FormData();
    formData.set("locale", locale);
    formData.set("shareId", shareId);
    formData.set("requestId", requestId);
    formData.set("message", trimmed);

    const result = await sendFadlaMessageAction(formData);

    if (result.success) {
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? {...m, id: result.message.id, created_at: result.message.created_at, pending: false} : m)),
      );
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError(result.error === "rate_limited" ? t("sendError") : result.error);
    }
    setSending(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="mt-4">
      <h4 className="mb-3 text-sm font-semibold text-foreground">{t("title")}</h4>

      <div className="mb-3 flex max-h-64 flex-col gap-2 overflow-y-auto rounded-2xl border border-border/60 bg-muted/30 p-3">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    isMine
                      ? "bg-[#ED2124] text-white rounded-br-md"
                      : "bg-card text-foreground border border-border/60 rounded-bl-md"
                  } ${msg.pending ? "opacity-60" : ""}`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                  {msg.pending && (
                    <span className="mt-0.5 flex items-center gap-1 text-[10px] opacity-70">
                      <Loader2 size={10} className="animate-spin" />
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle size={12} />
          {error}
        </p>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("inputPlaceholder")}
          rows={1}
          maxLength={500}
          className="min-h-[40px] flex-1 resize-none rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-[15px] outline-none transition focus:border-[#ED2124]/50 focus:ring-1 focus:ring-[#ED2124]/20"
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || sending || input.trim().length > 500}
          className="mb-px flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ED2124] p-0 hover:bg-[#ED2124]/90 disabled:opacity-50"
          aria-label={t("send")}
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="text-white" />}
        </Button>
      </div>

      {input.length > 450 && (
        <p className="mt-1 text-right text-[11px] text-muted-foreground">
          {input.length}/500
        </p>
      )}
    </div>
  );
}
