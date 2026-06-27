"use client";

import {AlertCircle, Loader2, Send} from "lucide-react";
import {useTranslations} from "next-intl";
import {useCallback, useEffect, useRef, useState} from "react";
import type {RealtimeChannel} from "@supabase/supabase-js";

import {sendIdeaMessageAction} from "@/app/[locale]/server-actions";
import {OnlineAvatar} from "@/components/presence/online-avatar";
import {Button} from "@/components/ui/button";
import {createClient} from "@/lib/supabase/client";
import type {IdeaMessageRow, IdeaMessageWithSender} from "@/types/database";

interface Props {
  ideaId: string;
  currentUserId: string;
  currentUserName?: string | null;
  currentUserAvatarUrl?: string | null;
  conversationWithName?: string | null;
  conversationWithAvatarUrl?: string | null;
  conversationWithUserId?: string | null;
  locale: string;
  initialMessages: IdeaMessageWithSender[];
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

interface IdeaMessageBroadcastPayload {
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

export function IdeaDiscussion({
  ideaId,
  currentUserId,
  currentUserName,
  currentUserAvatarUrl,
  conversationWithName,
  conversationWithAvatarUrl,
  conversationWithUserId,
  locale,
  initialMessages,
}: Props) {
  const t = useTranslations("Ideas.discussion");
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
      console.log('[IdeaDiscussion] currentUserId:', currentUserId, 'type:', typeof currentUserId);
      console.log('[IdeaDiscussion] raw initialMessage sample:', JSON.stringify(initialMessages[0]));
      mapped.forEach((m) => {
        const sameRaw = m.sender_id === currentUserId;
        const sameCI = m.sender_id?.toLowerCase() === currentUserId?.toLowerCase();
        console.log('[IdeaDiscussion] msg:', m.id, 'sender_id:', m.sender_id, 'type:', typeof m.sender_id, 'isMine(raw):', sameRaw, 'isMine(ci):', sameCI);
      });
    }
    return mapped;
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const channelReadyRef = useRef(false);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastTypingBroadcastRef = useRef(0);
  const senderIdentityCacheRef = useRef<Map<string, SenderIdentity>>(new Map());

  useEffect(() => {
    if (isNearBottomRef.current) {
      containerRef.current?.scrollTo({top: containerRef.current.scrollHeight, behavior: "smooth"});
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
    const channel = supabase.channel(`idea-discussion-${ideaId}`, {
      config: {
        broadcast: {self: false},
      },
    });
    const typingTimeouts = typingTimeoutsRef.current;
    channelRef.current = channel;
    channelReadyRef.current = false;

    async function getSenderIdentity(senderId: string) {
      const cached = senderIdentityCacheRef.current.get(senderId);
      if (cached) return cached;

      const {data} = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url")
        .eq("id", senderId)
        .maybeSingle();

      const identity = {
        name: data?.full_name ?? data?.username ?? t("someone"),
        avatarUrl: data?.avatar_url ?? null,
      };
      senderIdentityCacheRef.current.set(senderId, identity);
      return identity;
    }

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
      }, async (payload) => {
        const newMsg = payload.new as IdeaMessageRow;
        if (newMsg.sender_id !== currentUserId) {
          const senderIdentity = await getSenderIdentity(newMsg.sender_id);
          clearTypingUser(newMsg.sender_id);
          setMessages((prev) =>
            prev.some((msg) => msg.id === newMsg.id)
              ? prev
              : [...prev, {
                  id: newMsg.id,
                  sender_id: newMsg.sender_id,
                  sender_name: senderIdentity.name,
                  sender_avatar_url: senderIdentity.avatarUrl,
                  message: newMsg.message,
                  created_at: newMsg.created_at,
                }],
          );
        }
      })
      .on("broadcast", {event: "message"}, async (payload) => {
        const eventPayload = payload as {payload?: IdeaMessageBroadcastPayload} & IdeaMessageBroadcastPayload;
        const messagePayload = eventPayload.payload ?? eventPayload;
        const {id, sender_id: senderId, sender_name: sentSenderName, message, created_at: createdAt} = messagePayload;
        if (!id || !senderId || !message || !createdAt || senderId === currentUserId) return;

        clearTypingUser(senderId);
        const senderIdentity = sentSenderName?.trim()
          ? {name: sentSenderName.trim(), avatarUrl: messagePayload.sender_avatar_url ?? null}
          : await getSenderIdentity(senderId);
        setMessages((prev) =>
          prev.some((msg) => msg.id === id)
            ? prev
            : [...prev, {
                id,
                sender_id: senderId,
                sender_name: senderIdentity.name || undefined,
                sender_avatar_url: senderIdentity.avatarUrl,
                message,
                created_at: createdAt,
              }],
        );
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
      .subscribe((status) => {
        channelReadyRef.current = status === "SUBSCRIBED";
      });

    return () => {
      typingTimeouts.forEach((timeout) => clearTimeout(timeout));
      typingTimeouts.clear();
      supabase.removeChannel(channel);
      channelRef.current = null;
      channelReadyRef.current = false;
    };
  }, [ideaId, currentUserId, t]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending || trimmed.length > 500) return;
    setSending(true);
    setError(null);

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
    formData.set("ideaId", ideaId);
    formData.set("message", trimmed);

    const result = await sendIdeaMessageAction(formData);

    if (result.success) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticId
            ? {
                ...m,
                id: result.message?.id ?? m.id,
                created_at: result.message?.created_at ?? m.created_at,
                pending: false,
              }
            : m,
        ),
      );
      if (channelReadyRef.current && result.message?.id && result.message.created_at) {
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
      }
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError(result.error === "rate_limited" ? t("sendError") : (result.error ?? null));
    }
    setSending(false);
    inputRef.current?.focus({preventScroll: true});
  }

  const broadcastTyping = useCallback(() => {
    const now = Date.now();
    if (channelReadyRef.current && now - lastTypingBroadcastRef.current > 1500) {
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
  const youLabel = rtl ? "\u0623\u0646\u062a" : "You";
  const fallbackSenderName = rtl ? "\u0634\u062e\u0635 \u0645\u0627" : t("someone");
  const conversationLabel = rtl ? "\u0623\u0646\u062a \u062a\u062a\u062d\u062f\u062b \u0645\u0639:" : "You are talking with:";
  const firstReceivedMessage = messages.find((msg) => msg.sender_id !== currentUserId);
  const activeConversationName = conversationWithName?.trim() || firstReceivedMessage?.sender_name || fallbackSenderName;
  const activeConversationAvatarUrl = conversationWithAvatarUrl ?? firstReceivedMessage?.sender_avatar_url ?? null;
  const typingLabel = typingUsers.length === 1
    ? t("typingSingle", {name: typingUsers[0].name})
    : t("typingMultiple", {names: typingUsers.map((user) => user.name).slice(0, 2).join(", ")});

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
          <div
            className={`flex max-w-[86%] gap-2 sm:max-w-[76%] ${
              isMine ? "justify-end" : "justify-start"
            }`}
          >
            {!isMine && (
              <OnlineAvatar
                userId={msg.sender_id}
                label={senderName}
                avatarUrl={msg.sender_avatar_url}
                className="mt-5 size-9 shrink-0"
              />
            )}
            <div className={`flex min-w-0 flex-col ${isMine ? "items-end" : "items-start"}`}>
              {!isMine && (
                <div className="mb-1 flex max-w-full items-center gap-2 px-1 text-[11px] leading-none text-muted-foreground">
                  <span className="truncate font-semibold text-foreground" dir="auto">{senderName}</span>
                  <span className="shrink-0">{sentAt}</span>
                </div>
              )}
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                  isMine
                    ? "rounded-br-md bg-[#ED2124] text-white"
                    : "rounded-bl-md border border-border/60 bg-[#f4f5f7] text-slate-900 dark:bg-muted dark:text-foreground"
                } ${msg.pending ? "opacity-70" : ""}`}
                dir={rtl ? "rtl" : "ltr"}
              >
                {isMine && (
                  <div className="mb-1 flex items-center justify-end gap-2 text-[11px] leading-none text-white/80">
                    <span className="font-semibold text-white">{youLabel}</span>
                    <span className="shrink-0">
                      {msg.pending ? <Loader2 size={10} className="animate-spin" /> : sentAt}
                    </span>
                  </div>
                )}
                <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                {!isMine && (
                  <span className="sr-only">
                    {senderName} {sentAt}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    });
  }

  function renderConversationHeader() {
    return (
      <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2.5" dir={rtl ? "rtl" : "ltr"}>
        <OnlineAvatar
          userId={conversationWithUserId ?? firstReceivedMessage?.sender_id}
          label={activeConversationName}
          avatarUrl={activeConversationAvatarUrl}
          className="size-10 shrink-0"
        />
        <div className="min-w-0">
          <p className="text-[11px] leading-tight text-muted-foreground">{conversationLabel}</p>
          <p className="truncate text-sm font-semibold text-foreground" dir="auto">{activeConversationName}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {renderConversationHeader()}

      <div
        ref={containerRef}
        className="mb-3 flex max-h-80 min-h-[140px] flex-col gap-3 overflow-y-auto rounded-2xl border border-border/60 bg-muted/30 p-3.5"
        dir="ltr"
      >
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground" dir={rtl ? "rtl" : "ltr"}>{t("empty")}</p>
        ) : (
          renderMessages()
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
