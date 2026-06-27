"use client";

import {AlertCircle, Check, ChevronDown, ChevronUp, Loader2, Send} from "lucide-react";
import {useTranslations} from "next-intl";
import {useCallback, useEffect, useRef, useState} from "react";
import type {RealtimeChannel} from "@supabase/supabase-js";

import {sendFadlaMessageAction} from "@/app/[locale]/server-actions";
import {OnlineAvatar} from "@/components/presence/online-avatar";
import {Button} from "@/components/ui/button";
import {createClient} from "@/lib/supabase/client";
import type {FadlaRequestMessageRow, FadlaRequestMessageWithSender} from "@/types/database";

interface Props {
  requestId: string;
  shareId: string;
  currentUserId: string;
  currentUserName?: string | null;
  currentUserAvatarUrl?: string | null;
  conversationWithName?: string | null;
  conversationWithAvatarUrl?: string | null;
  conversationWithUserId?: string | null;
  locale: string;
  initialMessages: FadlaRequestMessageWithSender[];
  status: string;
}

interface DisplayMessage {
  id: string;
  sender_id: string;
  sender_name?: string;
  sender_avatar_url?: string | null;
  message: string;
  created_at: string;
  pending?: boolean;
}

interface FadlaMessageBroadcastPayload {
  id?: string;
  sender_id?: string;
  sender_name?: string;
  sender_avatar_url?: string | null;
  message?: string;
  created_at?: string;
}

interface SenderIdentity {
  name: string;
  avatarUrl: string | null;
}

export function FadlaDiscussion({
  requestId,
  shareId,
  currentUserId,
  currentUserName,
  currentUserAvatarUrl,
  conversationWithName,
  conversationWithAvatarUrl,
  conversationWithUserId,
  locale,
  initialMessages,
  status: initialStatus,
}: Props) {
  const t = useTranslations("Fadla.discussion");
  const [messages, setMessages] = useState<DisplayMessage[]>(() => {
    const mapped = initialMessages.map((m) => ({
      id: m.id,
      sender_id: m.sender_id,
      sender_name: m.sender?.full_name ?? m.sender?.username ?? undefined,
      sender_avatar_url: m.sender?.avatar_url ?? null,
      message: m.message,
      created_at: m.created_at,
    }));
    if (mapped.length > 0 && typeof window !== 'undefined') {
      console.log('[FadlaDiscussion] currentUserId:', currentUserId);
      console.log('[FadlaDiscussion] message sender_ids:', mapped.map((m) => ({id: m.id, sender_id: m.sender_id, type: typeof m.sender_id})));
    }
    return mapped;
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isCompleted, setIsCompleted] = useState(initialStatus === "completed");
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [otherUserTypingName, setOtherUserTypingName] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingBroadcastRef = useRef(0);
  const senderIdentityCacheRef = useRef<Map<string, SenderIdentity>>(new Map());

  function scrollMessagesToBottom(behavior: ScrollBehavior = "smooth") {
    const container = containerRef.current;
    if (!container) return;
    window.requestAnimationFrame(() => {
      container.scrollTo({top: container.scrollHeight, behavior});
    });
  }

  useEffect(() => {
    if (isNearBottomRef.current && !isCompleted) {
      scrollMessagesToBottom();
    }
  }, [messages, isCompleted]);

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
    setIsCompleted(initialStatus === "completed");
  }, [initialStatus]);

  useEffect(() => {
    if (!isCompleted) return;
    isNearBottomRef.current = true;
  }, [isCompleted]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`fadla-discussion-${requestId}`, {
      config: {
        broadcast: {self: false},
      },
    });
    channelRef.current = channel;

    async function getSenderIdentity(senderId: string) {
      const cached = senderIdentityCacheRef.current.get(senderId);
      if (cached) return cached;

      const {data} = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url")
        .eq("id", senderId)
        .maybeSingle();

      const identity = {
        name: data?.full_name ?? data?.username ?? "",
        avatarUrl: data?.avatar_url ?? null,
      };
      if (identity.name || identity.avatarUrl) senderIdentityCacheRef.current.set(senderId, identity);
      return identity;
    }

    channel
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "fadla_request_messages",
        filter: `request_id=eq.${requestId}`,
      }, async (payload) => {
        const newMsg = payload.new as FadlaRequestMessageRow;
        if (newMsg.sender_id !== currentUserId) {
          const senderIdentity = await getSenderIdentity(newMsg.sender_id);
          setOtherUserTyping(false);
          setOtherUserTypingName(null);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          setMessages((prev) =>
            prev.some((msg) => msg.id === newMsg.id)
              ? prev
              : [...prev, {
                  id: newMsg.id,
                  sender_id: newMsg.sender_id,
                  sender_name: senderIdentity.name || undefined,
                  sender_avatar_url: senderIdentity.avatarUrl,
                  message: newMsg.message,
                  created_at: newMsg.created_at,
                }],
          );
        }
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "community_shares",
        filter: `id=eq.${shareId}`,
      }, (payload) => {
        const updated = payload.new as {status?: string};
        if (updated.status === "completed") {
          setIsCompleted(true);
        }
      })
      .on("broadcast", {event: "message"}, (payload) => {
        const eventPayload = payload as {payload?: FadlaMessageBroadcastPayload} & FadlaMessageBroadcastPayload;
        const messagePayload = eventPayload.payload ?? eventPayload;
        if (
          !messagePayload.id ||
          !messagePayload.sender_id ||
          !messagePayload.message ||
          !messagePayload.created_at ||
          messagePayload.sender_id === currentUserId
        ) {
          return;
        }

        setOtherUserTyping(false);
        setOtherUserTypingName(null);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        setMessages((prev) =>
          prev.some((msg) => msg.id === messagePayload.id)
            ? prev
            : [...prev, {
                id: messagePayload.id!,
                sender_id: messagePayload.sender_id!,
                sender_name: messagePayload.sender_name || undefined,
                sender_avatar_url: messagePayload.sender_avatar_url ?? null,
                message: messagePayload.message!,
                created_at: messagePayload.created_at!,
              }],
        );
      })
      .on("broadcast", {event: "typing"}, (payload) => {
        const eventPayload = payload as {payload?: {sender_id?: string; sender_name?: string}; sender_id?: string; sender_name?: string};
        const senderId = eventPayload.payload?.sender_id ?? eventPayload.sender_id;
        const senderName = eventPayload.payload?.sender_name ?? eventPayload.sender_name ?? null;
        if (senderId && senderId !== currentUserId) {
          setOtherUserTyping(true);
          setOtherUserTypingName(senderName);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setOtherUserTyping(false);
            setOtherUserTypingName(null);
          }, 2500);
        }
      })
      .on("broadcast", {event: "typing_stop"}, (payload) => {
        const eventPayload = payload as {payload?: {sender_id?: string}; sender_id?: string};
        const senderId = eventPayload.payload?.sender_id ?? eventPayload.sender_id;
        if (senderId && senderId !== currentUserId) {
          setOtherUserTyping(false);
          setOtherUserTypingName(null);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }
      })
      .subscribe();

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [requestId, shareId, currentUserId]);

  async function handleSend() {
    if (isCompleted) return;
    const trimmed = input.trim();
    if (!trimmed || sending || trimmed.length > 500) return;
    setSending(true);
    setError(null);
    void channelRef.current?.send({
      type: "broadcast",
      event: "typing_stop",
      payload: {sender_id: currentUserId},
    });

    const optimisticId = `opt-${Date.now()}`;
    isNearBottomRef.current = true;
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        sender_id: currentUserId,
        sender_name: currentUserName ?? undefined,
        sender_avatar_url: currentUserAvatarUrl ?? null,
        message: trimmed,
        created_at: new Date().toISOString(),
        pending: true,
      },
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
      void channelRef.current?.send({
        type: "broadcast",
        event: "message",
        payload: {
          id: result.message.id,
          sender_id: currentUserId,
          sender_name: currentUserName?.trim() || undefined,
          sender_avatar_url: currentUserAvatarUrl ?? null,
          message: trimmed,
          created_at: result.message.created_at,
        },
      });
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError(result.error === "rate_limited" ? t("sendError") : result.error);
    }
    setSending(false);
    inputRef.current?.focus({preventScroll: true});
  }

  const broadcastTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingBroadcastRef.current > 700) {
      lastTypingBroadcastRef.current = now;
      void channelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: {
          sender_id: currentUserId,
          sender_name: currentUserName?.trim() || undefined,
        },
      });
    }
  }, [currentUserId, currentUserName]);

  const broadcastTypingStop = useCallback(() => {
    void channelRef.current?.send({
      type: "broadcast",
      event: "typing_stop",
      payload: {sender_id: currentUserId},
    });
  }, [currentUserId]);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const nextValue = e.target.value;
    setInput(nextValue);
    if (isCompleted) return;
    if (nextValue) {
      broadcastTyping();
    } else {
      broadcastTypingStop();
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

  if (typeof window !== 'undefined' && messages.length > 0) {
    console.log('[FadlaDiscussion] currentUserId type:', typeof currentUserId, 'value:', currentUserId);
    messages.forEach((msg) => {
      const sameRaw = msg.sender_id === currentUserId;
      const sameCI = msg.sender_id?.toLowerCase() === currentUserId?.toLowerCase();
      console.log('[FadlaDiscussion] msg sender_id:', msg.sender_id, 'sender_name:', msg.sender_name, 'isMine(raw):', sameRaw, 'isMine(ci):', sameCI);
    });
  }

  const rtl = locale === "ar";
  const youLabel = rtl ? "\u0623\u0646\u062a" : "You";
  const fallbackSenderName = rtl ? "\u0634\u062e\u0635 \u0645\u0627" : "Someone";
  const conversationLabel = rtl ? "\u0623\u0646\u062a \u062a\u062a\u062d\u062f\u062b \u0645\u0639:" : "You are talking with:";
  const completedClosedMessage = rtl ? "\u062a\u0645 \u0625\u063a\u0644\u0627\u0642 \u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0629 \u0628\u0639\u062f \u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u0641\u0638\u0644\u0629" : t("completedSubtitle");
  const firstReceivedMessage = messages.find((msg) => msg.sender_id !== currentUserId);
  const activeConversationName = conversationWithName?.trim() || firstReceivedMessage?.sender_name || fallbackSenderName;
  const activeConversationAvatarUrl = conversationWithAvatarUrl ?? firstReceivedMessage?.sender_avatar_url ?? null;

  function renderMessages() {
    return messages.map((msg) => {
      const isMine = msg.sender_id?.toLowerCase() === currentUserId?.toLowerCase();
      const senderName = isMine ? youLabel : msg.sender_name?.trim() || fallbackSenderName;
      const sentAt = formatTime(msg.created_at);
      return (
        <div
          key={msg.id}
          data-sender-id={msg.sender_id}
          data-current-user-id={currentUserId}
          data-ismine={isMine}
          data-sender-name={senderName}
          className={`flex w-full ${isMine ? "justify-end" : "justify-start"}`}
          dir="ltr"
        >
          {isMine ? (
            <div className="flex w-full max-w-[75%] flex-col items-end sm:max-w-[72%]">
              <p className="mb-1 px-1 text-xs font-semibold leading-none text-[#ED2124]" dir={rtl ? "rtl" : "ltr"}>
                {youLabel}
              </p>
              <div
                className={`max-w-full rounded-2xl rounded-br-md bg-[#ED2124] px-3.5 py-2.5 text-[15px] leading-relaxed text-white shadow-sm ${
                  msg.pending ? "opacity-70" : ""
                }`}
                dir={rtl ? "rtl" : "ltr"}
              >
                <p className="whitespace-pre-wrap break-words">{msg.message}</p>
              </div>
              <p className="mt-1 px-1 text-[11px] leading-none text-muted-foreground" dir={rtl ? "rtl" : "ltr"}>
                {msg.pending ? <Loader2 size={10} className="inline animate-spin" /> : sentAt}
              </p>
            </div>
          ) : (
            <div className="flex w-full max-w-[82%] items-start gap-2.5 sm:max-w-[75%]">
              <OnlineAvatar
                userId={msg.sender_id}
                label={senderName}
                avatarUrl={msg.sender_avatar_url}
                className="mt-5 size-9 shrink-0"
              />
              <div className="flex min-w-0 flex-1 flex-col items-start">
                <p className="mb-1 max-w-full truncate px-1 text-xs font-semibold leading-none text-foreground" dir="auto">
                  {senderName}
                </p>
                <div
                  className="max-w-full rounded-2xl rounded-bl-md border border-border/70 bg-white px-3.5 py-2.5 text-[15px] leading-relaxed text-slate-900 shadow-sm dark:bg-card dark:text-foreground"
                  dir={rtl ? "rtl" : "ltr"}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                  <span className="sr-only">
                    {senderName} {sentAt}
                  </span>
                </div>
                <p className="mt-1 px-1 text-[11px] leading-none text-muted-foreground" dir={rtl ? "rtl" : "ltr"}>
                  {sentAt}
                </p>
              </div>
            </div>
          )}
        </div>
      );
    });
  }

  function renderConversationHeader() {
    return (
      <div className="mb-3 flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-3.5 py-3 shadow-sm" dir={rtl ? "rtl" : "ltr"}>
        <OnlineAvatar
          userId={conversationWithUserId ?? firstReceivedMessage?.sender_id}
          label={activeConversationName}
          avatarUrl={activeConversationAvatarUrl}
          className="size-10 shrink-0"
        />
        <div className="min-w-0">
          <p className="text-xs leading-tight text-muted-foreground">{conversationLabel}</p>
          <p className="truncate text-base font-bold leading-tight text-foreground" dir="auto">{activeConversationName}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {renderConversationHeader()}

      {isCompleted && (
        <div className="mb-3 rounded-2xl border border-green-200 bg-green-50/80 p-4 text-center dark:border-green-900/50 dark:bg-green-950/20" dir={rtl ? "rtl" : "ltr"}>
          <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-300">
            <Check size={18} className="shrink-0" />
            <span className="text-sm font-semibold">{completedClosedMessage}</span>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="mt-3 inline-flex items-center gap-1 rounded-full border border-green-300/50 px-4 py-1.5 text-xs font-medium text-green-700 transition hover:bg-green-100 dark:border-green-700/50 dark:text-green-300 dark:hover:bg-green-900/30"
            >
              {showHistory ? (
                <><ChevronUp size={14} />{t("hideHistory")}</>
              ) : (
                <><ChevronDown size={14} />{t("viewHistory")}</>
              )}
            </button>
          )}
        </div>
      )}

      {!isCompleted && (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-[#f7f8fa] shadow-sm dark:bg-muted/20">
          <div
            ref={containerRef}
            className="flex max-h-[440px] min-h-[220px] flex-col gap-5 overflow-y-auto px-3.5 py-4 [scrollbar-gutter:stable] sm:px-4"
            dir="ltr"
          >
            {messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground" dir={rtl ? "rtl" : "ltr"}>{t("empty")}</p>
            ) : (
              renderMessages()
            )}
          </div>

          {error && (
            <p className="mx-3 mb-2 flex items-center gap-1.5 text-xs text-red-600" dir={rtl ? "rtl" : "ltr"}>
              <AlertCircle size={12} />
              {error}
            </p>
          )}

          {otherUserTyping && (
            <div className="mx-3 mb-2 flex items-center gap-1.5 text-xs text-muted-foreground" dir={rtl ? "rtl" : "ltr"}>
              <span className="flex items-center gap-0.5">
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{animationDelay: "0ms"}} />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{animationDelay: "200ms"}} />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{animationDelay: "400ms"}} />
              </span>
              <span>
                {otherUserTypingName
                  ? rtl
                    ? `${otherUserTypingName} \u064a\u0643\u062a\u0628...`
                    : `${otherUserTypingName} typing...`
                  : rtl
                    ? "\u064a\u0643\u062a\u0628..."
                    : "typing..."}
              </span>
            </div>
          )}

          <div className="sticky bottom-0 z-10 border-t border-border/70 bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={t("inputPlaceholder")}
                rows={1}
                maxLength={500}
                className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-border/70 bg-background px-3.5 py-2.5 text-[15px] leading-relaxed outline-none transition focus:border-[#ED2124]/50 focus:ring-1 focus:ring-[#ED2124]/20"
                dir={rtl ? "rtl" : "ltr"}
              />
              <Button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || sending || input.trim().length > 500}
                className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl bg-[#ED2124] p-0 hover:bg-[#ED2124]/90 disabled:opacity-50"
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
        </div>
      )}

      {/* History shown below the completion banner when user expands it */}
      {isCompleted && showHistory && messages.length > 0 && (
        <div
          className="mb-3 flex max-h-[420px] min-h-[160px] flex-col gap-5 overflow-y-auto rounded-2xl border border-border/70 bg-[#f7f8fa] p-4 [scrollbar-gutter:stable] dark:bg-muted/20"
          dir="ltr"
        >
          {renderMessages()}
        </div>
      )}
    </div>
  );
}
