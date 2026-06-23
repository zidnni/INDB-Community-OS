"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Archive,
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  ImagePlus,
  Loader2,
  LogOut,
  MoreVertical,
  Send,
  Shield,
  UserMinus,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { UserAvatar } from "@/components/layout/user-avatar";
import { uploadMediaItem } from "@/lib/images/client-upload";
import { Link, useRouter } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import type {
  ConversationMessageWithSender,
  ConversationParticipantInfo,
  ConversationUserProfile,
} from "@/lib/data/conversations";

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function displayName(profile: ConversationUserProfile | null | undefined, fallback: string) {
  return profile?.full_name ?? profile?.username ?? fallback;
}

function profileHref(profile: ConversationUserProfile | null | undefined, userId: string) {
  const handle = profile?.username ?? userId;
  return handle ? `/profile/${encodeURIComponent(handle)}` : null;
}

type TranslationFn = (key: string, values?: Record<string, string | number>) => string;

function statusLabel(status: string | null | undefined, t: TranslationFn) {
  const key = status && ["published", "interested", "discussion", "in_progress", "completed", "archived"].includes(status)
    ? `groupChat.statuses.${status}`
    : "groupChat.active";
  return t(key);
}

function friendlyError(error: string | null, t: TranslationFn) {
  if (!error) return null;
  const errorKeys = [
    "archived",
    "unauthorized",
    "rate_limited",
    "invalid",
    "insert_failed",
    "update_failed",
    "remove_failed",
    "leave_failed",
    "admin_cannot_leave",
    "image_upload_failed",
    "group_image_upload_failed",
  ];
  return errorKeys.includes(error) ? t(`groupChat.errors.${error}`) : error;
}

interface ConversationAvatarProps {
  title: string;
  imageUrl: string | null;
  participants: ConversationParticipantInfo[];
  isGroup: boolean;
  memberFallback: string;
  className?: string;
}

function ConversationAvatar({ title, imageUrl, participants, isGroup, memberFallback, className }: ConversationAvatarProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  if (isGroup && participants.length > 1) {
    const shown = participants.slice(0, 3);
    return (
      <div className={cn("relative shrink-0 rounded-full bg-muted", className)}>
        {shown.map((participant, index) => (
          <UserAvatar
            key={participant.user_id}
            label={displayName(participant.user, memberFallback)}
            avatarUrl={participant.user?.avatar_url ?? null}
            className={cn(
              "absolute h-5 w-5 border border-background",
              index === 0 && "left-1 top-1",
              index === 1 && "right-1 top-1",
              index === 2 && "bottom-1 left-1/2 -translate-x-1/2",
            )}
          />
        ))}
      </div>
    );
  }

  return <UserAvatar label={title} avatarUrl={null} className={className} />;
}

interface ConversationChatProps {
  conversationId: string;
  initialMessages: ConversationMessageWithSender[];
  currentUserId: string;
  isArchived: boolean;
  conversationTitle: string;
  conversationType: string;
  conversationImageUrl?: string | null;
  conversationImageStoragePath?: string | null;
  ideaId?: string | null;
  ideaTitle?: string | null;
  ideaStatus?: string | null;
  memberCount?: number;
  participants: ConversationParticipantInfo[];
}

export function ConversationChat({
  conversationId,
  initialMessages,
  currentUserId,
  isArchived,
  conversationTitle,
  conversationType,
  conversationImageUrl = null,
  conversationImageStoragePath = null,
  ideaId = null,
  ideaTitle = null,
  ideaStatus = null,
  memberCount,
  participants: initialParticipants,
}: ConversationChatProps) {
  const t = useTranslations("Messages");
  const memberFallback = t("groupChat.memberFallback");
  const router = useRouter();

  const [messages, setMessages] = useState(initialMessages);
  const [participants, setParticipants] = useState(initialParticipants);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingName, setTypingName] = useState<string | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);
  const [groupTitle, setGroupTitle] = useState(conversationTitle);
  const [draftTitle, setDraftTitle] = useState(conversationTitle);
  const [groupImageUrl, setGroupImageUrl] = useState(conversationImageUrl);
  const [draftImageUrl, setDraftImageUrl] = useState(conversationImageUrl);
  const [draftImageStoragePath, setDraftImageStoragePath] = useState(conversationImageStoragePath);
  const [groupImageUploading, setGroupImageUploading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ url: string; storagePath: string } | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [localArchived, setLocalArchived] = useState(isArchived);
  const [localIdeaStatus, setLocalIdeaStatus] = useState(ideaStatus);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingBroadcastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const groupImageInputRef = useRef<HTMLInputElement>(null);

  const isIdeaGroup = conversationType === "idea";
  const currentParticipant = participants.find((p) => p.user_id === currentUserId);
  const isAdmin = currentParticipant?.role === "admin";
  const effectiveMemberCount = participants.length || memberCount || 0;
  const isCompleted = localIdeaStatus === "completed" || localIdeaStatus === "archived";
  const isReadOnly = localArchived || isCompleted;
  const selfLabel = t("groupChat.you");
  const participantById = useMemo(() => {
    return new Map(participants.map((participant) => [participant.user_id, participant]));
  }, [participants]);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    setParticipants(initialParticipants);
  }, [initialParticipants]);

  useEffect(() => {
    setGroupTitle(conversationTitle);
    setDraftTitle(conversationTitle);
  }, [conversationTitle]);

  useEffect(() => {
    setGroupImageUrl(conversationImageUrl);
    setDraftImageUrl(conversationImageUrl);
    setDraftImageStoragePath(conversationImageStoragePath);
  }, [conversationImageUrl, conversationImageStoragePath]);

  useEffect(() => {
    setLocalArchived(isArchived);
  }, [isArchived]);

  useEffect(() => {
    setLocalIdeaStatus(ideaStatus);
  }, [ideaStatus]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingImage]);

  useEffect(() => {
    const supabase = createClient();
    async function refreshConversation() {
      try {
        const { getConversationMessagesAction } = await import("@/app/[locale]/server-actions");
        const res = await getConversationMessagesAction(conversationId);
        if (res.success && res.conversation) {
          setParticipants(res.conversation.participants);
          setGroupTitle(res.conversation.title);
          setDraftTitle(res.conversation.title);
          setGroupImageUrl(res.conversation.image_url);
          setDraftImageUrl(res.conversation.image_url);
          setDraftImageStoragePath(res.conversation.image_storage_path);
          setLocalArchived(!!res.conversation.archived_at);
          setLocalIdeaStatus(res.conversation.idea_status);
        }
      } catch (e) {
        console.error("conversation refresh error:", e);
      }
    }

    const channel = supabase
      .channel(`conv-messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${conversationId}`,
        },
        refreshConversation,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_participants",
          filter: `conversation_id=eq.${conversationId}`,
        },
        refreshConversation,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Record<string, unknown>;
          const senderId = newMsg.sender_id as string;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [
              ...prev,
              {
                id: newMsg.id as string,
                conversation_id: newMsg.conversation_id as string,
                sender_id: senderId,
                message: (newMsg.message as string | null) ?? null,
                message_type: newMsg.message_type === "image" ? "image" : "text",
                image_url: (newMsg.image_url as string | null) ?? null,
                image_storage_path: (newMsg.image_storage_path as string | null) ?? null,
                created_at: newMsg.created_at as string,
                read_at: (newMsg.read_at as string | null) ?? null,
                sender: participantById.get(senderId)?.user ?? null,
              },
            ];
          });
        },
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload.sender_id !== currentUserId) {
          setTypingName(payload.payload.sender_name ?? memberFallback);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setTypingName(null), 2500);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [conversationId, currentUserId, memberFallback, participantById]);

  useEffect(() => {
    async function markRead() {
      try {
        const { markConversationReadAction } = await import("@/app/[locale]/server-actions");
        await markConversationReadAction(conversationId);
      } catch (e) {
        console.error("markRead error:", e);
      }
    }
    markRead();
  }, [conversationId]);

  const broadcastTyping = useCallback(() => {
    if (typingBroadcastRef.current) return;
    const supabase = createClient();
    supabase.channel(`conv-messages-${conversationId}`).send({
      type: "broadcast",
      event: "typing",
      payload: {
        sender_id: currentUserId,
        sender_name: displayName(currentParticipant?.user, memberFallback),
      },
    });
    typingBroadcastRef.current = setTimeout(() => {
      typingBroadcastRef.current = null;
    }, 2000);
  }, [conversationId, currentParticipant?.user, currentUserId, memberFallback]);

  function handleInputChange(value: string) {
    setInput(value);
    if (value.trim()) broadcastTyping();
  }

  async function handleImagePick(file: File | undefined) {
    if (!file || isReadOnly || imageUploading) return;
    setImageUploading(true);
    setError(null);
    try {
      const uploaded = await uploadMediaItem(file, "conversation");
      if (uploaded.type !== "image") throw new Error("invalid");
      setPendingImage({ url: uploaded.url, storagePath: uploaded.storagePath });
    } catch (e) {
      console.error("image upload error:", e);
      setError("image_upload_failed");
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  async function handleGroupImagePick(file: File | undefined) {
    if (!file || !isAdmin || groupImageUploading) return;
    setGroupImageUploading(true);
    setError(null);
    try {
      const uploaded = await uploadMediaItem(file, "conversation");
      if (uploaded.type !== "image") throw new Error("invalid");
      setDraftImageUrl(uploaded.url);
      setDraftImageStoragePath(uploaded.storagePath);
    } catch (e) {
      console.error("group image upload error:", e);
      setError("group_image_upload_failed");
    } finally {
      setGroupImageUploading(false);
      if (groupImageInputRef.current) groupImageInputRef.current.value = "";
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && !pendingImage) || sending || isReadOnly) return;
    setSending(true);
    setError(null);

    const formData = new FormData();
    formData.set("conversationId", conversationId);
    formData.set("message", trimmed);
    if (pendingImage) {
      formData.set("messageType", "image");
      formData.set("imageUrl", pendingImage.url);
      formData.set("imageStoragePath", pendingImage.storagePath);
    } else {
      formData.set("messageType", "text");
    }

    try {
      const { sendConversationMessageAction } = await import("@/app/[locale]/server-actions");
      const res = await sendConversationMessageAction(formData);

      if (res.success && res.message) {
        const optimisticImage = pendingImage;
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.message!.id)) return prev;
          return [
            ...prev,
            {
              id: res.message!.id,
              conversation_id: conversationId,
              sender_id: currentUserId,
              message: trimmed || null,
              message_type: optimisticImage ? "image" : "text",
              image_url: optimisticImage?.url ?? null,
              image_storage_path: optimisticImage?.storagePath ?? null,
              created_at: res.message!.created_at,
              read_at: null,
              sender: currentParticipant?.user ?? null,
            },
          ];
        });
        setInput("");
        setPendingImage(null);
      } else {
        setError(res.error ?? "insert_failed");
      }
    } catch (e) {
      console.error("send error:", e);
      setError("insert_failed");
    } finally {
      setSending(false);
    }
  }

  async function handleSaveProfile() {
    if (!isAdmin || profileSaving) return;
    setProfileSaving(true);
    setError(null);
    const formData = new FormData();
    formData.set("conversationId", conversationId);
    formData.set("title", draftTitle.trim());
    if (draftImageUrl) formData.set("imageUrl", draftImageUrl);
    if (draftImageStoragePath) formData.set("imageStoragePath", draftImageStoragePath);

    try {
      const { updateIdeaGroupProfileAction } = await import("@/app/[locale]/server-actions");
      const res = await updateIdeaGroupProfileAction(formData);
      if (!res.success) {
        setError(res.error ?? "update_failed");
        return;
      }
      setGroupTitle(draftTitle.trim() || groupTitle);
      setGroupImageUrl(draftImageUrl);
    } catch (e) {
      console.error("profile update error:", e);
      setError("update_failed");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!isAdmin) return;
    setError(null);
    const formData = new FormData();
    formData.set("conversationId", conversationId);
    formData.set("memberId", memberId);

    try {
      const { removeIdeaGroupMemberAction } = await import("@/app/[locale]/server-actions");
      const res = await removeIdeaGroupMemberAction(formData);
      if (!res.success) {
        setError(res.error ?? "remove_failed");
        return;
      }
      setParticipants((prev) => prev.filter((p) => p.user_id !== memberId));
    } catch (e) {
      console.error("remove member error:", e);
      setError("remove_failed");
    }
  }

  async function handleLeaveGroup() {
    setError(null);
    const formData = new FormData();
    formData.set("conversationId", conversationId);

    try {
      const { leaveIdeaGroupAction } = await import("@/app/[locale]/server-actions");
      const res = await leaveIdeaGroupAction(formData);
      if (!res.success) {
        setError(res.error ?? "leave_failed");
        return;
      }
      router.push("/messages");
    } catch (e) {
      console.error("leave group error:", e);
      setError("leave_failed");
    }
  }

  async function handleStatusChange(nextStatus: string) {
    if (!isAdmin || !ideaId) return;
    setError(null);
    const previousStatus = localIdeaStatus;
    setLocalIdeaStatus(nextStatus);

    try {
      const { updateIdeaStatusAction } = await import("@/app/[locale]/server-actions");
      const formData = new FormData();
      formData.set("ideaId", ideaId);
      formData.set("status", nextStatus);
      const res = await updateIdeaStatusAction(formData);
      if (!res.success) {
        setLocalIdeaStatus(previousStatus);
        setError(res.error ?? "update_failed");
        return;
      }
      if (nextStatus === "completed" || nextStatus === "archived") {
        setLocalArchived(true);
      }
    } catch (e) {
      console.error("status update error:", e);
      setLocalIdeaStatus(previousStatus);
      setError("update_failed");
    }
  }

  const headerSubtitle = isIdeaGroup
    ? `${t("groupChat.memberCount", { count: effectiveMemberCount })} • ${statusLabel(localIdeaStatus, t)}`
    : t("groupChat.memberCount", { count: effectiveMemberCount });
  const readOnlyMessage = isCompleted ? t("groupChat.closedAfterCompletion") : t("groupChat.readOnlyNotice");

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="shrink-0 border-b border-border/70 bg-card/95 px-2.5 py-2 shadow-sm backdrop-blur">
        <div className="flex min-h-[52px] items-center gap-2">
          <Link
            href="/messages"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted md:hidden"
            aria-label={t("groupChat.backToMessages")}
          >
            <ArrowLeft size={21} />
          </Link>
          <button
            type="button"
            onClick={() => setShowGroupInfo(true)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-start transition hover:bg-muted/60"
            aria-label={t("groupChat.groupInfo")}
          >
            <ConversationAvatar
              title={groupTitle}
              imageUrl={groupImageUrl}
              participants={participants}
              isGroup={isIdeaGroup}
              memberFallback={memberFallback}
              className="h-10 w-10"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold leading-tight text-foreground">{groupTitle}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{headerSubtitle}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setShowGroupInfo(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label={t("groupChat.options")}
          >
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-muted/20 px-3 py-4">
        {isReadOnly && (
          <div className="mx-auto mb-4 flex max-w-md items-center justify-center gap-2 rounded-full bg-background/90 px-3 py-2 text-center text-xs text-muted-foreground shadow-sm">
            <Archive size={14} />
            <span>{readOnlyMessage}</span>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground/60">
            {t("noMessagesYet")}
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMine = msg.sender_id === currentUserId;
            const participant = participantById.get(msg.sender_id);
            const sender = msg.sender ?? participant?.user ?? null;
            const senderName = displayName(sender, memberFallback);
            const senderProfileHref = profileHref(sender, msg.sender_id);
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isSameSenderAsPrev = prevMsg?.sender_id === msg.sender_id;
            const isFirstInGroup = !isSameSenderAsPrev;
            const hasImage = msg.message_type === "image" && msg.image_url;

            return (
              <div
                key={msg.id}
                className={cn(
                  "flex w-full",
                  isMine ? "justify-end" : "justify-start",
                  index === 0 ? "mt-0" : isFirstInGroup ? "mt-3.5" : "mt-1",
                )}
              >
                <div className={cn("flex max-w-[86%] items-end gap-2 md:max-w-[68%]", isMine && "flex-row-reverse")}>
                  {!isMine && (
                    <div className="w-8 shrink-0">
                      {isFirstInGroup && senderProfileHref && (
                        <Link
                          href={senderProfileHref}
                          className="block rounded-full outline-none ring-primary/40 focus-visible:ring-2"
                          aria-label={t("groupChat.openProfile", { name: senderName })}
                        >
                          <UserAvatar
                            label={senderName}
                            avatarUrl={sender?.avatar_url ?? null}
                            className="h-8 w-8"
                          />
                        </Link>
                      )}
                      {isFirstInGroup && !senderProfileHref && (
                        <UserAvatar
                          label={senderName}
                          avatarUrl={sender?.avatar_url ?? null}
                          className="h-8 w-8"
                        />
                      )}
                    </div>
                  )}
                  <div className={cn("flex min-w-0 flex-col", isMine ? "items-end" : "items-start")}>
                    {!isMine && isIdeaGroup && (
                      senderProfileHref ? (
                        <Link
                          href={senderProfileHref}
                          className="mb-0.5 block w-fit max-w-full truncate text-[11px] font-semibold text-muted-foreground transition hover:text-foreground"
                        >
                          {senderName}
                        </Link>
                      ) : (
                        <p className="mb-0.5 text-[11px] font-semibold text-muted-foreground">
                          {senderName}
                        </p>
                      )
                    )}
                    <div
                      className={cn(
                        "min-w-[4.5rem] overflow-hidden rounded-2xl text-sm leading-relaxed shadow-sm",
                        hasImage ? "p-1.5" : "px-3.5 py-2",
                        isMine
                          ? "rounded-ee-[5px] bg-primary text-primary-foreground"
                          : "rounded-es-[5px] border border-border/50 bg-card text-foreground",
                      )}
                      dir="auto"
                    >
                      {hasImage && (
                        <button
                          type="button"
                          onClick={() => setImageViewerUrl(msg.image_url)}
                          className="block overflow-hidden rounded-xl text-start"
                          aria-label={t("groupChat.viewImage")}
                        >
                          <img
                            src={msg.image_url ?? ""}
                            alt=""
                            className="max-h-80 w-full min-w-52 object-cover"
                          />
                        </button>
                      )}
                      {msg.message && (
                        <p className={cn(hasImage && "px-2 py-1.5")}>{msg.message}</p>
                      )}
                      <div className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", isMine ? "text-primary-foreground/75" : "text-muted-foreground")}>
                        <span>{formatTime(msg.created_at)}</span>
                        {isMine && (
                          <CheckCheck size={13} aria-label={selfLabel} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {typingName && (
        <div className="shrink-0 border-t border-border/70 bg-background/95 px-4 py-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
          <span className="flex gap-0.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "0ms" }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "150ms" }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "300ms" }} />
          </span>
          <span>{typingName} {t("typing")}</span>
          </div>
        </div>
      )}

      {(error || !isReadOnly) && (
        <div className="sticky bottom-0 z-10 shrink-0 border-t border-border/70 bg-background/95 px-3 pb-[max(5rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur md:px-4 md:pb-3">
          {pendingImage && !isReadOnly && (
            <div className="mb-2 flex items-start gap-2 rounded-lg border border-border/70 bg-card p-2 shadow-sm">
              <img src={pendingImage.url} alt="" className="h-16 w-16 rounded-md object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">{t("groupChat.imageReady")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("groupChat.addCaptionOrSend")}</p>
              </div>
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
                aria-label={t("groupChat.removeImage")}
              >
                <X size={15} />
              </button>
            </div>
          )}

          {error && (
            <p className="mb-1.5 text-xs text-destructive">{friendlyError(error, t)}</p>
          )}

          {!isReadOnly && (
            <form onSubmit={handleSend} className="flex items-end gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => handleImagePick(event.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={imageUploading || sending}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition hover:bg-muted disabled:opacity-40"
                aria-label={t("groupChat.sendImage")}
              >
                {imageUploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                maxLength={pendingImage ? 500 : 1000}
                placeholder={pendingImage ? t("groupChat.addCaption") : t("placeholder")}
                className="min-h-11 flex-1 rounded-full border border-border/60 bg-card px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
              />
              <button
                type="submit"
                disabled={(!input.trim() && !pendingImage) || sending}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-40"
                aria-label={t("groupChat.sendMessage")}
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </form>
          )}
        </div>
      )}

      {showGroupInfo && (
        <div className="absolute inset-0 z-30 flex bg-black/35 md:justify-end">
          <div className="flex h-full w-full flex-col bg-background shadow-2xl md:max-w-md">
            <div className="flex min-h-[56px] items-center gap-2 border-b border-border/70 px-3">
              <button
                type="button"
                onClick={() => setShowGroupInfo(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
                aria-label={t("groupChat.close")}
              >
                <ArrowLeft size={20} />
              </button>
              <p className="min-w-0 flex-1 truncate text-base font-semibold">{t("groupChat.groupInfo")}</p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5">
              <div className="flex flex-col items-center text-center">
                <ConversationAvatar
                  title={draftTitle}
                  imageUrl={draftImageUrl}
                  participants={participants}
                  isGroup={isIdeaGroup}
                  memberFallback={memberFallback}
                  className="h-24 w-24"
                />
                {isIdeaGroup && isAdmin && (
                  <button
                    type="button"
                    onClick={() => groupImageInputRef.current?.click()}
                    disabled={groupImageUploading}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                  >
                    {groupImageUploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                    {t("groupChat.changeImage")}
                  </button>
                )}
                <input
                  ref={groupImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => handleGroupImagePick(event.target.files?.[0])}
                />
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("groupChat.groupName")}
                  </label>
                  {isIdeaGroup && isAdmin ? (
                    <div className="flex gap-2">
                      <input
                        value={draftTitle}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        maxLength={120}
                        className="min-h-11 min-w-0 flex-1 rounded-lg border border-border/70 bg-card px-3 text-sm outline-none focus:border-primary/50"
                      />
                      <button
                        type="button"
                        onClick={handleSaveProfile}
                        disabled={profileSaving}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                        aria-label={t("groupChat.save")}
                      >
                        {profileSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      </button>
                    </div>
                  ) : (
                    <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm font-medium text-foreground">{groupTitle}</p>
                  )}
                </div>

                {isIdeaGroup && (
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">{t("groupChat.ideaTitleLabel")}</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{ideaTitle ?? groupTitle}</p>
                  </div>
                )}

                {isIdeaGroup && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {t("groupChat.ideaStatus")}
                    </label>
                    {isAdmin && ideaId ? (
                      <select
                        value={localIdeaStatus ?? "published"}
                        onChange={(event) => handleStatusChange(event.target.value)}
                        className="min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50"
                      >
                        <option value="published">{t("groupChat.statuses.published")}</option>
                        <option value="interested">{t("groupChat.statuses.interested")}</option>
                        <option value="discussion">{t("groupChat.statuses.discussion")}</option>
                        <option value="in_progress">{t("groupChat.statuses.in_progress")}</option>
                        <option value="completed">{t("groupChat.statuses.completed")}</option>
                        <option value="archived">{t("groupChat.statuses.archived")}</option>
                      </select>
                    ) : (
                      <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm font-medium text-foreground">
                        {statusLabel(localIdeaStatus, t)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{t("groupChat.members")}</p>
                  <span className="text-xs text-muted-foreground">{t("groupChat.memberCount", { count: effectiveMemberCount })}</span>
                </div>
                <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card">
                  {participants.map((participant) => {
                    const name = displayName(participant.user, memberFallback);
                    const isSelf = participant.user_id === currentUserId;
                    const memberProfileHref = profileHref(participant.user, participant.user_id);
                    return (
                      <div key={participant.user_id} className="flex items-center gap-3 px-3 py-2.5">
                        {memberProfileHref ? (
                          <Link
                            href={memberProfileHref}
                            className="shrink-0 rounded-full outline-none ring-primary/40 focus-visible:ring-2"
                            aria-label={t("groupChat.openProfile", { name })}
                          >
                            <UserAvatar label={name} avatarUrl={participant.user?.avatar_url ?? null} className="h-10 w-10" />
                          </Link>
                        ) : (
                          <UserAvatar label={name} avatarUrl={participant.user?.avatar_url ?? null} className="h-10 w-10" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {name}
                            {isSelf ? ` (${t("groupChat.you")})` : ""}
                          </p>
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                            {participant.role === "admin" && <Shield size={12} />}
                            {participant.role === "admin" ? t("groupChat.roles.admin") : t("groupChat.roles.member")}
                          </p>
                        </div>
                        {isIdeaGroup && isAdmin && participant.role !== "admin" && !isSelf && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(participant.user_id)}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                            aria-label={t("groupChat.removeMember", { name })}
                          >
                            <UserMinus size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {isIdeaGroup && !isAdmin && (
                <button
                  type="button"
                  onClick={handleLeaveGroup}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/30 px-3 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/10"
                >
                  <LogOut size={16} />
                  {t("groupChat.leaveGroup")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {imageViewerUrl && (
        <button
          type="button"
          onClick={() => setImageViewerUrl(null)}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4"
          aria-label={t("groupChat.close")}
        >
          <img src={imageViewerUrl} alt="" className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
        </button>
      )}
    </div>
  );
}
