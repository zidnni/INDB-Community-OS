"use client";

import {AlertCircle, Loader2, Send} from "lucide-react";
import {useTranslations} from "next-intl";
import {useCallback, useEffect, useRef, useState} from "react";
import type {RealtimeChannel} from "@supabase/supabase-js";

import {sendIdeaMessageAction} from "@/app/[locale]/server-actions";
import {Button} from "@/components/ui/button";
import {createClient} from "@/lib/supabase/client";
import type {IdeaMessageRow, IdeaMessageWithSender} from "@/types/database";

interface Props {
  ideaId: string;
  currentUserId: string;
  currentUserName?: string | null;
  locale: string;
  initialMessages: IdeaMessageWithSender[];
}

interface DisplayMessage {
  id: string;
  sender_id: string;
  sender_name?: string;
  message: string;
  created_at: string;
  pending?: boolean;
}

interface TypingUser {
  id: string;
  name: string;
}

interface RealtimeTypingPayload {
  sender_id?: string;
  sender_name?: string;
  payload?: {
    sender_id?: string;
    sender_name?: string;
  };
}

export function IdeaDiscussion({ideaId, currentUserId, currentUserName, locale, initialMessages}: Props) {
  const t = useTranslations("Ideas.discussion");
  const [messages, setMessages] = useState<DisplayMessage[]>(() =>
    initialMessages.map((m) => ({
      id: m.id,
      sender_id: m.sender_id,
      sender_name: m.sender?.full_name ?? m.sender?.username ?? undefined,
      message: m.message,
      created_at: m.created_at,
    })),
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastTypingBroadcastRef = useRef(0);

  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({behavior: "smooth"});
    }
  }, [messages]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const threshold = 100;
      isNearBottomRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`idea-discussion-${ideaId}`);
    const typingTimeouts = typingTimeoutsRef.current;
    channelRef.current = channel;

    function clearTypingUser(userId: string) {
      const timeout = typingTimeouts.get(userId);
      if (timeout) clearTimeout(timeout);
      typingTimeouts.delete(userId);
      setTypingUsers((prev) => prev.filter((user) => user.id !== userId));
    }

    channel
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "idea_messages",
        filter: `idea_id=eq.${ideaId}`,
      }, (payload) => {
        const newMsg = payload.new as IdeaMessageRow;
        if (newMsg.sender_id !== currentUserId) {
          clearTypingUser(newMsg.sender_id);
          setMessages((prev) => [...prev, {
            id: newMsg.id,
            sender_id: newMsg.sender_id,
            message: newMsg.message,
            created_at: newMsg.created_at,
          }]);
        }
      })
      .on("broadcast", {event: "typing"}, (payload) => {
        const eventPayload = payload as RealtimeTypingPayload;
        const typingPayload = eventPayload.payload ?? eventPayload;
        const senderId = typingPayload.sender_id;
        if (!senderId || senderId === currentUserId) return;

        const senderName = typingPayload.sender_name?.trim() || t("someone");
        const existingTimeout = typingTimeouts.get(senderId);
        if (existingTimeout) clearTimeout(existingTimeout);

        setTypingUsers((prev) => {
          const nextUser = {id: senderId, name: senderName};
          return prev.some((user) => user.id === senderId)
            ? prev.map((user) => (user.id === senderId ? nextUser : user))
            : [...prev, nextUser];
        });

        const timeout = setTimeout(() => {
          typingTimeouts.delete(senderId);
          setTypingUsers((prev) => prev.filter((user) => user.id !== senderId));
        }, 2500);
        typingTimeouts.set(senderId, timeout);
      })
      .subscribe();

    return () => {
      typingTimeouts.forEach((timeout) => clearTimeout(timeout));
      typingTimeouts.clear();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [ideaId, currentUserId, t]);

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
    formData.set("ideaId", ideaId);
    formData.set("message", trimmed);

    const result = await sendIdeaMessageAction(formData);

    if (result.success) {
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? {...m, pending: false} : m)),
      );
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError(result.error === "rate_limited" ? t("sendError") : (result.error ?? null));
    }
    setSending(false);
    inputRef.current?.focus();
  }

  const broadcastTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingBroadcastRef.current > 1500) {
      lastTypingBroadcastRef.current = now;
      channelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: {
          sender_id: currentUserId,
          sender_name: currentUserName?.trim() || t("someone"),
        },
      });
    }
  }, [currentUserId, currentUserName, t]);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    if (e.target.value) {
      broadcastTyping();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatTime(dateStr: string) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString(locale === "ar" ? "ar-SA" : locale === "fr" ? "fr-FR" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  const rtl = locale === "ar";
  const typingLabel = typingUsers.length === 1
    ? t("typingSingle", {name: typingUsers[0].name})
    : t("typingMultiple", {names: typingUsers.map((user) => user.name).slice(0, 2).join(", ")});

  return (
    <div>
      <div
        ref={containerRef}
        className="mb-3 flex max-h-80 min-h-[120px] flex-col gap-2 overflow-y-auto rounded-2xl border border-border/60 bg-muted/30 p-3"
        dir={rtl ? "rtl" : "ltr"}
      >
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className="flex">
                <div
                  className={`max-w-[85%] sm:max-w-[75%] ${
                    isMine ? "ml-auto items-end" : "mr-auto items-start"
                  }`}
                >
                  {!isMine && msg.sender_name && (
                    <p
                      className={`mb-0.5 px-1 text-[11px] font-medium text-muted-foreground ${
                        rtl ? "text-right" : "text-left"
                      }`}
                      dir={rtl ? "rtl" : "ltr"}
                    >
                      {msg.sender_name}
                    </p>
                  )}
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      isMine
                        ? "bg-[#ED2124] text-white rounded-br-md"
                        : "bg-card text-foreground border border-border/60 rounded-bl-md"
                    } ${msg.pending ? "opacity-60" : ""}`}
                    dir={rtl ? "rtl" : "ltr"}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                    <div className={`mt-1 flex items-center gap-1`}>
                      <span className={`text-[10px] ${isMine ? "text-white/70" : "text-muted-foreground"}`}>
                        {msg.pending ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          formatTime(msg.created_at)
                        )}
                      </span>
                    </div>
                  </div>
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

      {typingUsers.length > 0 && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground" dir={rtl ? "rtl" : "ltr"}>
          <span className="flex items-center gap-0.5">
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{animationDelay: "0ms"}} />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{animationDelay: "200ms"}} />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{animationDelay: "400ms"}} />
          </span>
          <span>{typingLabel}</span>
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={t("inputPlaceholder")}
          rows={1}
          maxLength={500}
          className="min-h-[44px] flex-1 resize-none rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-[15px] outline-none transition focus:border-[#ED2124]/50 focus:ring-1 focus:ring-[#ED2124]/20"
          dir={rtl ? "rtl" : "ltr"}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || sending || input.trim().length > 500}
          className="mb-px flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl bg-[#ED2124] p-0 hover:bg-[#ED2124]/90 disabled:opacity-50"
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
