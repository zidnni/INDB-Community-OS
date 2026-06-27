"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Archive,
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  Copy,
  Flag,
  ImagePlus,
  Loader2,
  LogOut,
  MoreVertical,
  Pencil,
  Send,
  Shield,
  Trash2,
  UserMinus,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { OnlineAvatar, OnlineDot } from "@/components/presence";
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

function fireHaptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(12);
    } catch {
      // Some browsers expose vibrate but ignore it.
    }
  }
}

function profileHref(profile: ConversationUserProfile | null | undefined, userId: string) {
  const handle = profile?.username ?? userId;
  return handle ? `/profile/${encodeURIComponent(handle)}` : null;
}

function normalizeRealtimeMessage(
  raw: Record<string, unknown>,
  participantById: Map<string, ConversationParticipantInfo>,
): ConversationMessageWithSender {
  const senderId = raw.sender_id as string;
  const rawImageUrls = raw.image_urls as unknown;
  const rawImageStoragePaths = raw.image_storage_paths as unknown;

  return {
    id: raw.id as string,
    conversation_id: raw.conversation_id as string,
    sender_id: senderId,
    message: (raw.message as string | null) ?? null,
    message_type: raw.message_type === "image" ? "image" : "text",
    image_url: (raw.image_url as string | null) ?? null,
    image_storage_path: (raw.image_storage_path as string | null) ?? null,
    image_urls: Array.isArray(rawImageUrls) ? rawImageUrls as string[] : ((raw.image_url as string | null) ? [(raw.image_url as string)] : []),
    image_storage_paths: Array.isArray(rawImageStoragePaths) ? rawImageStoragePaths as string[] : ((raw.image_storage_path as string | null) ? [(raw.image_storage_path as string)] : []),
    is_edited: Boolean(raw.is_edited),
    edited_at: (raw.edited_at as string | null) ?? null,
    is_deleted: Boolean(raw.is_deleted),
    deleted_at: (raw.deleted_at as string | null) ?? null,
    deleted_by: (raw.deleted_by as string | null) ?? null,
    created_at: raw.created_at as string,
    read_at: (raw.read_at as string | null) ?? null,
    sender: participantById.get(senderId)?.user ?? null,
  };
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
    "name_too_short",
    "edit_failed",
    "delete_failed",
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
  otherUserId?: string | null;
}

function ConversationAvatar({ title, imageUrl, participants, isGroup, memberFallback, className, otherUserId }: ConversationAvatarProps) {
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
          <OnlineAvatar
            key={participant.user_id}
            userId={participant.user?.id}
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

  return <OnlineAvatar userId={otherUserId} label={title} avatarUrl={null} className={className} />;
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
  const [isRenaming, setIsRenaming] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [groupTitle, setGroupTitle] = useState(conversationTitle);
  const [draftTitle, setDraftTitle] = useState(conversationTitle);
  const [groupImageUrl, setGroupImageUrl] = useState(conversationImageUrl);
  const [draftImageUrl, setDraftImageUrl] = useState(conversationImageUrl);
  const [draftImageStoragePath, setDraftImageStoragePath] = useState(conversationImageStoragePath);
  const [groupImageUploading, setGroupImageUploading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [pendingImages, setPendingImages] = useState<{ url: string; storagePath: string }[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [localArchived, setLocalArchived] = useState(isArchived);
  const [localIdeaStatus, setLocalIdeaStatus] = useState(ideaStatus);
  const [actionMessage, setActionMessage] = useState<ConversationMessageWithSender | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [messageActionSaving, setMessageActionSaving] = useState(false);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingBroadcastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatRootRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const groupImageInputRef = useRef<HTMLInputElement>(null);
  const nearBottomRef = useRef(true);

  const isIdeaGroup = conversationType === "idea";
  const otherParticipant = participants.find((p) => p.user_id !== currentUserId)?.user;
  const otherUserId = otherParticipant?.id;
  const currentParticipant = participants.find((p) => p.user_id === currentUserId);
  const isAdmin = currentParticipant?.role === "admin";
  const effectiveMemberCount = participants.length || memberCount || 0;
  const isCompleted = localIdeaStatus === "completed" || localIdeaStatus === "archived";
  const isReadOnly = localArchived || isCompleted;
  const selfLabel = t("groupChat.you");
  const participantById = useMemo(() => {
    return new Map(participants.map((participant) => [participant.user_id, participant]));
  }, [participants]);
  const participantByIdRef = useRef(participantById);

  useEffect(() => {
    participantByIdRef.current = participantById;
  }, [participantById]);

  useEffect(() => {
    const root = document.documentElement;
    const previousValue = root.dataset.chatOpen;
    const previousViewportHeight = root.style.getPropertyValue("--chat-viewport-height");
    const previousViewportTop = root.style.getPropertyValue("--chat-viewport-top");
    root.dataset.chatOpen = "true";

    const syncViewportHeight = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      const top = viewport?.offsetTop ?? 0;
      root.style.setProperty("--chat-viewport-height", `${Math.max(height, 320)}px`);
      root.style.setProperty("--chat-viewport-top", `${Math.max(top, 0)}px`);
    };

    syncViewportHeight();
    window.addEventListener("resize", syncViewportHeight);
    window.visualViewport?.addEventListener("resize", syncViewportHeight);
    window.visualViewport?.addEventListener("scroll", syncViewportHeight);

    return () => {
      if (previousValue === undefined) {
        delete root.dataset.chatOpen;
      } else {
        root.dataset.chatOpen = previousValue;
      }
      if (previousViewportHeight) {
        root.style.setProperty("--chat-viewport-height", previousViewportHeight);
      } else {
        root.style.removeProperty("--chat-viewport-height");
      }
      if (previousViewportTop) {
        root.style.setProperty("--chat-viewport-top", previousViewportTop);
      } else {
        root.style.removeProperty("--chat-viewport-top");
      }
      window.removeEventListener("resize", syncViewportHeight);
      window.visualViewport?.removeEventListener("resize", syncViewportHeight);
      window.visualViewport?.removeEventListener("scroll", syncViewportHeight);
      cancelLongPress();
    };
  }, []);

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

  const isNearBottom = useCallback(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return true;
    return scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight < 120;
  }, []);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "auto") => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "end", behavior });
      nearBottomRef.current = true;
    });
  }, []);

  useEffect(() => {
    scrollToLatest("auto");
  }, [conversationId, scrollToLatest]);

  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    const shouldKeepPinned = nearBottomRef.current || latestMessage?.sender_id === currentUserId || pendingImages.length > 0;
    if (shouldKeepPinned) {
      scrollToLatest("smooth");
    }
  }, [messages.length, pendingImages.length, currentUserId, scrollToLatest]);

  useEffect(() => {
    const supabase = createClient();
    async function refreshConversation() {
      try {
        const { getConversationDetailsAction } = await import("@/app/[locale]/server-actions");
        const res = await getConversationDetailsAction(conversationId);
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
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, normalizeRealtimeMessage(newMsg, participantByIdRef.current)];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const nextMsg = normalizeRealtimeMessage(payload.new as Record<string, unknown>, participantByIdRef.current);
          setMessages((prev) => prev.map((message) => message.id === nextMsg.id ? {...message, ...nextMsg, sender: message.sender ?? nextMsg.sender} : message));
          setActionMessage((current) => current?.id === nextMsg.id ? {...current, ...nextMsg, sender: current.sender ?? nextMsg.sender} : current);
          if (editingMessageId === nextMsg.id && nextMsg.is_deleted) {
            setEditingMessageId(null);
            setEditingText("");
          }
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
  }, [conversationId, currentUserId, memberFallback]);

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

  async function handleImagePick(files: FileList | null) {
    if (!files || files.length === 0 || isReadOnly || imageUploading) return;
    setImageUploading(true);
    setError(null);
    try {
      const availableSlots = Math.max(0, 10 - pendingImages.length);
      const uploaded: { url: string; storagePath: string }[] = [];
      for (let i = 0; i < Math.min(files.length, availableSlots); i++) {
        const result = await uploadMediaItem(files[i], "conversation");
        if (result.type !== "image") throw new Error("invalid");
        uploaded.push({ url: result.url, storagePath: result.storagePath });
      }
      setPendingImages((prev) => [...prev, ...uploaded]);
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
    const previousImageUrl = draftImageUrl;
    const previousImageStoragePath = draftImageStoragePath;
    setGroupImageUploading(true);
    setError(null);
    try {
      const uploaded = await uploadMediaItem(file, "conversation");
      if (uploaded.type !== "image") throw new Error("invalid");
      const ok = await saveGroupProfile(draftTitle.trim() || groupTitle, uploaded.url, uploaded.storagePath);
      if (!ok) {
        setDraftImageUrl(previousImageUrl);
        setDraftImageStoragePath(previousImageStoragePath);
      }
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
    if ((!trimmed && pendingImages.length === 0) || sending || isReadOnly) return;
    const optimisticImages = pendingImages;
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticCreatedAt = new Date().toISOString();
    setSending(true);
    setError(null);
    setInput("");
    setPendingImages([]);
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        conversation_id: conversationId,
        sender_id: currentUserId,
        message: trimmed || null,
        message_type: optimisticImages.length > 0 ? "image" : "text",
        image_url: optimisticImages[0]?.url ?? null,
        image_storage_path: optimisticImages[0]?.storagePath ?? null,
        image_urls: optimisticImages.map((img) => img.url),
        image_storage_paths: optimisticImages.map((img) => img.storagePath),
        is_edited: false,
        edited_at: null,
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        created_at: optimisticCreatedAt,
        read_at: null,
        sender: currentParticipant?.user ?? null,
      },
    ]);

    const formData = new FormData();
    formData.set("conversationId", conversationId);
    formData.set("message", trimmed);
    if (optimisticImages.length > 0) {
      formData.set("messageType", "image");
      formData.set("imageUrls", JSON.stringify(optimisticImages.map((img) => img.url)));
      formData.set("imageStoragePaths", JSON.stringify(optimisticImages.map((img) => img.storagePath)));
      formData.set("imageUrl", optimisticImages[0].url);
      formData.set("imageStoragePath", optimisticImages[0].storagePath);
    } else {
      formData.set("messageType", "text");
    }

    try {
      const { sendConversationMessageAction } = await import("@/app/[locale]/server-actions");
      const res = await sendConversationMessageAction(formData);

      if (res.success && res.message) {
        setMessages((prev) => {
          const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
          if (withoutOptimistic.some((m) => m.id === res.message!.id)) {
            return withoutOptimistic;
          }
          return [
            ...withoutOptimistic,
            {
              id: res.message!.id,
              conversation_id: conversationId,
              sender_id: currentUserId,
              message: trimmed || null,
              message_type: optimisticImages.length > 0 ? "image" : "text",
              image_url: optimisticImages[0]?.url ?? null,
              image_storage_path: optimisticImages[0]?.storagePath ?? null,
              image_urls: optimisticImages.map((img) => img.url),
              image_storage_paths: optimisticImages.map((img) => img.storagePath),
              is_edited: false,
              edited_at: null,
              is_deleted: false,
              deleted_at: null,
              deleted_by: null,
              created_at: res.message!.created_at,
              read_at: null,
              sender: currentParticipant?.user ?? null,
            },
          ];
        });
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setInput(trimmed);
        setPendingImages(optimisticImages);
        setError(res.error ?? "insert_failed");
      }
    } catch (e) {
      console.error("send error:", e);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setInput(trimmed);
      setPendingImages(optimisticImages);
      setError("insert_failed");
    } finally {
      setSending(false);
    }
  }

  function openMessageActions(message: ConversationMessageWithSender) {
    setActionMessage(message);
    setActionMenuId(null);
  }

  function startLongPress(message: ConversationMessageWithSender) {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      fireHaptic();
      openMessageActions(message);
      longPressTimerRef.current = null;
    }, 480);
  }

  function cancelLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  async function copyMessage(message: ConversationMessageWithSender) {
    const text = message.is_deleted ? "" : (message.message ?? "");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard can be blocked by the browser; keep the UI quiet.
    }
    setActionMessage(null);
    setActionMenuId(null);
  }

  function beginEditMessage(message: ConversationMessageWithSender) {
    if (message.sender_id !== currentUserId || message.is_deleted || isReadOnly) return;
    setEditingMessageId(message.id);
    setEditingText(message.message ?? "");
    setActionMessage(null);
    setActionMenuId(null);
  }

  async function saveMessageEdit(messageId: string) {
    const cleanText = editingText.trim();
    if (!cleanText || messageActionSaving) return;
    setMessageActionSaving(true);
    setError(null);
    const previousMessages = messages;
    setMessages((prev) => prev.map((message) => message.id === messageId ? {
      ...message,
      message: cleanText,
      is_edited: true,
      edited_at: new Date().toISOString(),
    } : message));
    setEditingMessageId(null);
    setEditingText("");

    const formData = new FormData();
    formData.set("messageId", messageId);
    formData.set("message", cleanText);

    try {
      const { editConversationMessageAction } = await import("@/app/[locale]/server-actions");
      const res = await editConversationMessageAction(formData);
      if (!res.success) {
        setMessages(previousMessages);
        setEditingMessageId(messageId);
        setEditingText(previousMessages.find((message) => message.id === messageId)?.message ?? "");
        setError(res.error ?? "edit_failed");
      }
    } catch (e) {
      console.error("edit message error:", e);
      setMessages(previousMessages);
      setEditingMessageId(messageId);
      setEditingText(previousMessages.find((message) => message.id === messageId)?.message ?? "");
      setError("edit_failed");
    } finally {
      setMessageActionSaving(false);
    }
  }

  function cancelMessageEdit() {
    setEditingMessageId(null);
    setEditingText("");
  }

  async function deleteMessage(message: ConversationMessageWithSender) {
    if (message.sender_id !== currentUserId || message.is_deleted || isReadOnly || messageActionSaving) return;
    if (!window.confirm(t("groupChat.confirmDelete"))) return;
    setMessageActionSaving(true);
    setError(null);
    setActionMessage(null);
    setActionMenuId(null);
    const deletedAt = new Date().toISOString();
    const previousMessages = messages;
    setMessages((prev) => prev.map((item) => item.id === message.id ? {
      ...item,
      message: null,
      image_url: null,
      image_storage_path: null,
      image_urls: [],
      image_storage_paths: [],
      is_deleted: true,
      deleted_at: deletedAt,
      deleted_by: currentUserId,
    } : item));

    const formData = new FormData();
    formData.set("messageId", message.id);
    try {
      const { deleteConversationMessageAction } = await import("@/app/[locale]/server-actions");
      const res = await deleteConversationMessageAction(formData);
      if (!res.success) {
        setMessages(previousMessages);
        setError(res.error ?? "delete_failed");
      }
    } catch (e) {
      console.error("delete message error:", e);
      setMessages(previousMessages);
      setError("delete_failed");
    } finally {
      setMessageActionSaving(false);
    }
  }

  async function reportMessage(message: ConversationMessageWithSender) {
    setActionMessage(null);
    setActionMenuId(null);
    const formData = new FormData();
    formData.set("messageId", message.id);
    try {
      const { reportConversationMessageAction } = await import("@/app/[locale]/server-actions");
      const res = await reportConversationMessageAction(formData);
      window.alert(t(res.success ? "groupChat.errors.report_received" : "groupChat.errors.report_failed"));
    } catch (e) {
      console.error("report message error:", e);
      window.alert(t("groupChat.errors.report_failed"));
    }
  }

  async function saveGroupProfile(
    nextTitle = draftTitle,
    nextImageUrl = draftImageUrl,
    nextImageStoragePath = draftImageStoragePath,
  ) {
    if (!isAdmin) return false;
    const cleanedTitle = nextTitle.trim();
    if (cleanedTitle.length < 2) {
      setError("name_too_short");
      return false;
    }

    setProfileSaving(true);
    setError(null);
    const formData = new FormData();
    formData.set("conversationId", conversationId);
    formData.set("title", cleanedTitle);
    if (nextImageUrl) formData.set("imageUrl", nextImageUrl);
    if (nextImageStoragePath) formData.set("imageStoragePath", nextImageStoragePath);

    try {
      const { updateIdeaGroupProfileAction } = await import("@/app/[locale]/server-actions");
      const res = await updateIdeaGroupProfileAction(formData);
      if (!res.success) {
        setError(res.error ?? "update_failed");
        return false;
      }
      setGroupTitle(cleanedTitle);
      setDraftTitle(cleanedTitle);
      setGroupImageUrl(nextImageUrl);
      setDraftImageUrl(nextImageUrl);
      setDraftImageStoragePath(nextImageStoragePath);
      return true;
    } catch (e) {
      console.error("profile update error:", e);
      setError("update_failed");
      return false;
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSaveProfile() {
    if (!isAdmin || profileSaving) return;
    const ok = await saveGroupProfile();
    if (ok) setIsRenaming(false);
  }

  function handleCancelRename() {
    setDraftTitle(groupTitle);
    setError(null);
    setIsRenaming(false);
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
    ? `${t("groupChat.memberCount", { count: effectiveMemberCount })} - ${statusLabel(localIdeaStatus, t)}`
    : t("groupChat.memberCount", { count: effectiveMemberCount });
  const readOnlyMessage = isCompleted ? t("groupChat.closedAfterCompletion") : t("groupChat.readOnlyNotice");
  const groupTypeLabel = isIdeaGroup ? t("idea") : t("groupChat.gar3tak");
  const groupStatusLabel = isIdeaGroup
    ? statusLabel(localIdeaStatus, t)
    : isReadOnly
      ? t("groupChat.readOnly")
      : t("groupChat.active");
  const canSaveName = draftTitle.trim().length >= 2 && draftTitle.trim() !== groupTitle;

  return (
    <div ref={chatRootRef} className="relative flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden bg-background overscroll-contain [touch-action:pan-y]">
      <div className="shrink-0 overflow-x-hidden border-b border-border/70 bg-card/95 px-2 py-1.5 pt-[max(0.375rem,var(--safe-top))] shadow-sm backdrop-blur md:px-2.5 md:py-2">
        <div className="flex min-h-[52px] min-w-0 items-center gap-2">
          <Link
            href="/messages"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition active:bg-muted md:hidden"
            aria-label={t("groupChat.backToMessages")}
          >
            <ArrowLeft size={21} />
          </Link>
          <button
            type="button"
            onClick={() => setShowGroupInfo(true)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-start transition active:bg-muted/60 md:hover:bg-muted/60"
            aria-label={t("groupChat.groupInfo")}
          >
            <ConversationAvatar
              title={groupTitle}
              imageUrl={groupImageUrl}
              participants={participants}
              isGroup={isIdeaGroup}
              memberFallback={memberFallback}
              otherUserId={otherUserId}
              className="h-9 w-9 md:h-10 md:w-10"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold leading-tight text-foreground">{groupTitle}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{headerSubtitle}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setShowGroupInfo(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition active:bg-muted md:hover:bg-muted md:hover:text-foreground"
            aria-label={t("groupChat.options")}
          >
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      <div
        ref={scrollAreaRef}
        onScroll={() => {
          nearBottomRef.current = isNearBottom();
        }}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth bg-muted/20 px-2.5 py-3 overscroll-contain [overflow-anchor:none] [touch-action:pan-y] md:px-5 md:py-4"
      >
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end overflow-x-hidden">
          {isReadOnly && (
            <div className="mx-auto mb-4 flex max-w-md items-center justify-center gap-2 rounded-full bg-background/90 px-3 py-2 text-center text-xs text-muted-foreground shadow-sm">
              <Archive size={14} />
              <span>{readOnlyMessage}</span>
            </div>
          )}
          {messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground/60">
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
            const msgImages = msg.image_urls?.length ? msg.image_urls : (msg.image_url ? [msg.image_url] : []);
            const isDeleted = Boolean(msg.is_deleted);
            const hasImage = !isDeleted && msgImages.length > 0;
            const isEditing = editingMessageId === msg.id;
            const canMutate = isMine && !isDeleted && !isReadOnly && !msg.id.startsWith("optimistic-");
            const hasText = Boolean(msg.message?.trim());
            const hasBeenRead = isMine && participants.some((participant) => {
              if (participant.user_id === currentUserId || !participant.last_read_at) return false;
              return new Date(participant.last_read_at).getTime() >= new Date(msg.created_at).getTime();
            });
            const StatusIcon = hasBeenRead ? CheckCheck : Check;

            return (
              <div
                key={msg.id}
                className={cn(
                  "group/message flex w-full min-w-0 max-w-full overflow-x-hidden",
                  isMine ? "justify-end" : "justify-start",
                  index === 0 ? "mt-0" : isFirstInGroup ? "mt-3.5" : "mt-1",
                )}
              >
                <div className={cn("flex min-w-0 max-w-[86%] items-end gap-1.5 overflow-x-hidden sm:max-w-[78%] md:max-w-[70%] md:gap-2", isMine && "flex-row-reverse")}>
                  {!isMine && (
                    <div className="w-7 shrink-0 md:w-9">
                      {isFirstInGroup && senderProfileHref && (
                        <Link
                          href={senderProfileHref}
                          className="block rounded-full outline-none ring-primary/40 focus-visible:ring-2"
                          aria-label={t("groupChat.openProfile", { name: senderName })}
                        >
                          <OnlineAvatar
                            userId={sender?.id}
                            label={senderName}
                            avatarUrl={sender?.avatar_url ?? null}
                            className="h-7 w-7 md:h-9 md:w-9"
                          />
                        </Link>
                      )}
                      {isFirstInGroup && !senderProfileHref && (
                        <OnlineAvatar
                          userId={sender?.id}
                          label={senderName}
                          avatarUrl={sender?.avatar_url ?? null}
                          className="h-7 w-7 md:h-9 md:w-9"
                        />
                      )}
                    </div>
                  )}
                  <div className={cn("relative flex min-w-0 max-w-full flex-col overflow-x-hidden", isMine ? "items-end" : "items-start")}>
                    {!isMine && isIdeaGroup && (
                      senderProfileHref ? (
                        <Link
                          href={senderProfileHref}
                          className="mb-1 block w-fit max-w-full truncate text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                        >
                          {senderName}
                        </Link>
                      ) : (
                        <p className="mb-1 text-xs font-semibold text-muted-foreground">
                          {senderName}
                        </p>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() => setActionMenuId((current) => current === msg.id ? null : msg.id)}
                      className={cn(
                        "absolute top-1 hidden h-7 w-7 items-center justify-center rounded-full bg-background/90 text-muted-foreground opacity-0 shadow-sm ring-1 ring-border transition hover:bg-muted hover:text-foreground group-hover/message:opacity-100 md:flex",
                        isMine ? "-left-9" : "-right-9",
                      )}
                      aria-label={t("groupChat.messageActions")}
                    >
                      <MoreVertical size={15} />
                    </button>
                    {actionMenuId === msg.id ? (
                      <div className={cn(
                        "absolute top-8 z-20 hidden min-w-32 overflow-hidden rounded-xl border border-border bg-card py-1 text-sm shadow-xl md:block",
                        isMine ? "right-0" : "left-0",
                      )}>
                        {canMutate ? (
                          <button type="button" onClick={() => beginEditMessage(msg)} className="flex w-full items-center gap-2 px-3 py-2 text-start hover:bg-muted">
                            <Pencil size={14} />
                            {t("groupChat.edit")}
                          </button>
                        ) : null}
                        {canMutate ? (
                          <button type="button" onClick={() => deleteMessage(msg)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-destructive hover:bg-destructive/10">
                            <Trash2 size={14} />
                            {t("groupChat.delete")}
                          </button>
                        ) : null}
                        {hasText ? (
                          <button type="button" onClick={() => copyMessage(msg)} className="flex w-full items-center gap-2 px-3 py-2 text-start hover:bg-muted">
                            <Copy size={14} />
                            {t("groupChat.copy")}
                          </button>
                        ) : null}
                        {!isMine ? (
                          <button type="button" onClick={() => reportMessage(msg)} className="flex w-full items-center gap-2 px-3 py-2 text-start hover:bg-muted">
                            <Flag size={14} />
                            {t("groupChat.report")}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    <div
                      onContextMenu={(event) => {
                        event.preventDefault();
                        openMessageActions(msg);
                      }}
                      onSelect={(event) => event.preventDefault()}
                      onDragStart={(event) => event.preventDefault()}
                      onTouchStart={(event) => {
                        event.preventDefault();
                        startLongPress(msg);
                      }}
                      onTouchEnd={cancelLongPress}
                      onTouchMove={cancelLongPress}
                      onTouchCancel={cancelLongPress}
                      onPointerDown={(event) => {
                        if (event.pointerType === "mouse") return;
                        event.preventDefault();
                        startLongPress(msg);
                      }}
                      onPointerUp={cancelLongPress}
                      onPointerLeave={cancelLongPress}
                      onPointerCancel={cancelLongPress}
                      className={cn(
                        "min-w-[4rem] max-w-full touch-manipulation select-none overflow-hidden break-words rounded-2xl text-[14px] leading-relaxed shadow-sm [overflow-wrap:anywhere] [-webkit-touch-callout:none] [-webkit-user-select:none]",
                        hasImage && !isEditing ? "p-1.5" : "px-3 py-2 md:px-3.5 md:py-2.5",
                        isDeleted && "italic",
                        isMine
                          ? "rounded-ee-[5px] bg-primary text-primary-foreground"
                          : "rounded-es-[5px] border border-border/50 bg-card text-foreground",
                      )}
                      dir="auto"
                    >
                      {hasImage && (
                        <div className={cn("grid max-w-full gap-1 overflow-hidden", msgImages.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                          {msgImages.slice(0, 4).map((url, i) => (
                            <button
                              key={i}
                              type="button"
                              onPointerDown={(event) => event.stopPropagation()}
                              onTouchStart={(event) => event.stopPropagation()}
                              onClick={() => { setViewerImages(msgImages); setViewerIndex(i); }}
                              className={cn("max-w-full overflow-hidden rounded-xl text-start", i === 3 && msgImages.length > 4 ? "relative" : "")}
                              aria-label={t("groupChat.viewImage")}
                            >
                              <img
                                src={url}
                                alt=""
                                className={cn(
                                  "h-full w-full max-w-full select-none object-cover [-webkit-user-drag:none]",
                                  msgImages.length === 1 ? "max-h-80 min-w-40 sm:min-w-52" : "aspect-square",
                                )}
                              />
                              {i === 3 && msgImages.length > 4 && (
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 text-lg font-bold text-white">
                                  +{msgImages.length - 4}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {isDeleted ? (
                        <p className="select-none">{t("groupChat.deletedMessage")}</p>
                      ) : isEditing ? (
                        <div className="space-y-2">
                          <input
                            value={editingText}
                            onChange={(event) => setEditingText(event.target.value)}
                            maxLength={msg.message_type === "image" ? 500 : 1000}
                            autoFocus
                            className={cn(
                              "min-h-9 w-full min-w-0 max-w-full rounded-lg border px-2.5 text-sm outline-none focus:ring-2",
                              isMine
                                ? "border-primary-foreground/40 bg-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/60 focus:ring-primary-foreground/30"
                                : "border-border bg-background text-foreground focus:ring-primary/30",
                            )}
                          />
                          <div className="flex justify-end gap-1.5">
                            <button type="button" onClick={cancelMessageEdit} className="rounded-full px-2.5 py-1 text-xs font-semibold hover:bg-black/10">
                              {t("groupChat.cancel")}
                            </button>
                            <button
                              type="button"
                              onClick={() => saveMessageEdit(msg.id)}
                              disabled={!editingText.trim() || messageActionSaving}
                              className="rounded-full bg-primary-foreground px-2.5 py-1 text-xs font-semibold text-primary disabled:opacity-50"
                            >
                              {messageActionSaving ? t("groupChat.saving") : t("groupChat.save")}
                            </button>
                          </div>
                        </div>
                      ) : msg.message ? (
                        <p className={cn("max-w-full select-none break-words [overflow-wrap:anywhere]", hasImage && "px-2 py-1.5")}>{msg.message}</p>
                      ) : null}
                      <div className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", isMine ? "text-primary-foreground/75" : "text-muted-foreground")}>
                        <span>{formatTime(msg.created_at)}</span>
                        {msg.is_edited && !isDeleted ? (
                          <span>{t("groupChat.edited")}</span>
                        ) : null}
                        {isMine && (
                          <StatusIcon size={13} aria-label={hasBeenRead ? t("groupChat.read") : t("groupChat.sent")} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
          {typingName && (
            <div className="mx-auto mt-2 flex w-fit items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: "300ms" }} />
              </span>
              <span>{typingName} {t("typing")}</span>
            </div>
          )}
          <div ref={bottomRef} className="h-px" />
        </div>
      </div>

      {(error || !isReadOnly) && (
        <div className="z-10 shrink-0 border-t border-border/70 bg-background/95 px-[max(0.625rem,var(--safe-left))] pb-[calc(0.8rem+var(--safe-bottom))] pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/90 md:px-4 md:pb-3 md:pt-2.5">
          {pendingImages.length > 0 && !isReadOnly && (
            <div className="mb-2 rounded-lg border border-border/70 bg-card p-2 shadow-sm">
              <div className="flex flex-wrap gap-2">
                {pendingImages.map((img, i) => (
                  <div key={i} className="relative">
                    <img src={img.url} alt="" className="h-16 w-16 rounded-md object-cover" />
                    <button
                      type="button"
                      onClick={() => setPendingImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow transition hover:bg-muted"
                      aria-label={t("groupChat.removeImage")}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{t("groupChat.addCaptionOrSend")}</p>
            </div>
          )}

          {error && (
            <p className="mb-1.5 text-xs text-destructive">{friendlyError(error, t)}</p>
          )}

          {!isReadOnly && (
            <form onSubmit={handleSend} className="mx-auto flex w-full max-w-3xl min-w-0 items-end gap-2 overflow-x-hidden">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(event) => handleImagePick(event.target.files)}
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={imageUploading || sending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition active:bg-muted disabled:opacity-40 md:h-11 md:w-11 md:hover:bg-muted"
                aria-label={t("groupChat.sendImage")}
              >
                {imageUploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
              </button>
              <input
                type="text"
                enterKeyHint="send"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                maxLength={pendingImages.length > 0 ? 500 : 1000}
                placeholder={pendingImages.length > 0 ? t("groupChat.addCaption") : t("placeholder")}
                className="min-h-10 min-w-0 flex-1 rounded-full border border-border/60 bg-card px-3.5 py-2 text-sm shadow-sm outline-none transition focus:border-primary/50 focus:ring-1 focus:ring-primary/30 md:min-h-11 md:px-4 md:py-2.5"
              />
              <button
                type="submit"
                disabled={(!input.trim() && pendingImages.length === 0) || sending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition active:bg-primary/90 disabled:opacity-40 md:h-11 md:w-11 md:hover:bg-primary/90"
                aria-label={t("groupChat.sendMessage")}
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </form>
          )}
        </div>
      )}

      {showGroupInfo && (
        <div className="absolute inset-0 z-30 flex bg-background md:bg-muted/25">
          <div className="flex h-full w-full flex-col">
            <div className="flex min-h-[56px] items-center gap-2 border-b border-border/70 bg-card/95 px-3 shadow-sm backdrop-blur">
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

            <div className="flex-1 overflow-y-auto px-3 py-4 md:px-5 md:py-6">
              <div className="mx-auto w-full max-w-[520px] space-y-4">
                <section className="rounded-lg border border-border/70 bg-card px-4 py-5 text-center shadow-sm">
                  <div className="relative mx-auto h-28 w-28">
                    {isIdeaGroup && isAdmin ? (
                      <button
                        type="button"
                        onClick={() => groupImageInputRef.current?.click()}
                        disabled={groupImageUploading || profileSaving}
                        className="group relative block h-28 w-28 rounded-full outline-none ring-primary/30 transition focus-visible:ring-2 disabled:opacity-70"
                        aria-label={t("groupChat.changeImage")}
                      >
                        <ConversationAvatar
                          title={draftTitle}
                          imageUrl={draftImageUrl}
                          participants={participants}
                          isGroup={isIdeaGroup}
                          memberFallback={memberFallback}
                          className="h-28 w-28"
                        />
                        <span className="absolute inset-x-0 bottom-0 flex h-10 items-center justify-center rounded-b-full bg-black/55 text-white opacity-100 transition group-hover:bg-black/65">
                          {groupImageUploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                        </span>
                      </button>
                    ) : (
                      <ConversationAvatar
                        title={groupTitle}
                        imageUrl={groupImageUrl}
                        participants={participants}
                        isGroup={isIdeaGroup}
                        memberFallback={memberFallback}
                        className="h-28 w-28"
                      />
                    )}
                  </div>
                  <input
                    ref={groupImageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => handleGroupImagePick(event.target.files?.[0])}
                  />

                  <div className="mt-4">
                    {isRenaming && isIdeaGroup && isAdmin ? (
                      <div className="mx-auto max-w-sm">
                        <input
                          value={draftTitle}
                          onChange={(event) => setDraftTitle(event.target.value)}
                          maxLength={120}
                          autoFocus
                          className="min-h-11 w-full rounded-lg border border-border/70 bg-background px-3 text-center text-base font-semibold outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                        />
                        <div className="mt-2 flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={handleCancelRename}
                            disabled={profileSaving}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                          >
                            <X size={14} />
                            {t("groupChat.cancel")}
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveProfile}
                            disabled={!canSaveName || profileSaving}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                          >
                            {profileSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            {t("groupChat.save")}
                          </button>
                        </div>
                        {draftTitle.trim().length < 2 && (
                          <p className="mt-2 text-xs text-destructive">{t("groupChat.errors.name_too_short")}</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <h2 className="min-w-0 truncate text-xl font-semibold tracking-tight text-foreground">{groupTitle}</h2>
                        {isIdeaGroup && isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setDraftTitle(groupTitle);
                              setIsRenaming(true);
                            }}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            aria-label={t("groupChat.editName")}
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      {groupTypeLabel}
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {groupStatusLabel}
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {t("groupChat.memberCount", { count: effectiveMemberCount })}
                    </span>
                  </div>
                </section>

                {error && (
                  <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {friendlyError(error, t)}
                  </p>
                )}

                {isIdeaGroup && (
                  <section className="rounded-lg border border-border/70 bg-card p-3 shadow-sm">
                    <p className="text-xs font-medium text-muted-foreground">{t("groupChat.ideaTitleLabel")}</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{ideaTitle ?? groupTitle}</p>
                  </section>
                )}

                {isIdeaGroup && (
                  <section className="rounded-lg border border-border/70 bg-card p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">{t("groupChat.ideaStatus")}</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{groupStatusLabel}</p>
                      </div>
                      {isAdmin && ideaId && (
                        <select
                          value={localIdeaStatus ?? "published"}
                          onChange={(event) => handleStatusChange(event.target.value)}
                          className="min-h-10 max-w-[12rem] rounded-full border border-border bg-background px-3 text-xs font-medium outline-none focus:border-primary/50"
                        >
                          <option value="published">{t("groupChat.statuses.published")}</option>
                          <option value="interested">{t("groupChat.statuses.interested")}</option>
                          <option value="discussion">{t("groupChat.statuses.discussion")}</option>
                          <option value="in_progress">{t("groupChat.statuses.in_progress")}</option>
                          <option value="completed">{t("groupChat.statuses.completed")}</option>
                          <option value="archived">{t("groupChat.statuses.archived")}</option>
                        </select>
                      )}
                    </div>
                  </section>
                )}

                <section className="rounded-lg border border-border/70 bg-card shadow-sm">
                  <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
                    <p className="text-sm font-semibold text-foreground">{t("groupChat.members")}</p>
                    <span className="text-xs text-muted-foreground">{t("groupChat.memberCount", { count: effectiveMemberCount })}</span>
                  </div>
                  <div className="divide-y divide-border/60">
                    {participants.map((participant) => {
                      const name = displayName(participant.user, memberFallback);
                      const isSelf = participant.user_id === currentUserId;
                      const memberProfileHref = profileHref(participant.user, participant.user_id);
                      return (
                        <div key={participant.user_id} className="flex min-h-[64px] items-center gap-3 px-3 py-2.5">
                          {memberProfileHref ? (
                            <Link
                              href={memberProfileHref}
                              className="shrink-0 rounded-full outline-none ring-primary/40 focus-visible:ring-2"
                              aria-label={t("groupChat.openProfile", { name })}
                            >
                              <OnlineAvatar userId={participant.user?.id} label={name} avatarUrl={participant.user?.avatar_url ?? null} className="h-11 w-11" />
                            </Link>
                          ) : (
                            <OnlineAvatar userId={participant.user?.id} label={name} avatarUrl={participant.user?.avatar_url ?? null} className="h-11 w-11" />
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
                </section>

                {isIdeaGroup && !isAdmin && (
                  <button
                    type="button"
                    onClick={handleLeaveGroup}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-card px-3 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/10"
                  >
                    <LogOut size={16} />
                    {t("groupChat.leaveGroup")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {actionMessage ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/35 px-3 pb-[calc(0.75rem+var(--safe-bottom))] md:hidden" onClick={() => setActionMessage(null)}>
          <div className="w-full animate-in slide-in-from-bottom-4 fade-in duration-150 overflow-hidden rounded-3xl bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30" />
            <div className="p-2">
              {actionMessage.sender_id === currentUserId && !actionMessage.is_deleted && !isReadOnly ? (
                <button type="button" onClick={() => beginEditMessage(actionMessage)} className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-start text-sm font-semibold hover:bg-muted">
                  <Pencil size={18} />
                  {t("groupChat.edit")}
                </button>
              ) : null}
              {actionMessage.sender_id === currentUserId && !actionMessage.is_deleted && !isReadOnly ? (
                <button type="button" onClick={() => deleteMessage(actionMessage)} className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-start text-sm font-semibold text-destructive hover:bg-destructive/10">
                  <Trash2 size={18} />
                  {t("groupChat.delete")}
                </button>
              ) : null}
              {actionMessage.message && !actionMessage.is_deleted ? (
                <button type="button" onClick={() => copyMessage(actionMessage)} className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-start text-sm font-semibold hover:bg-muted">
                  <Copy size={18} />
                  {t("groupChat.copy")}
                </button>
              ) : null}
              {actionMessage.sender_id !== currentUserId ? (
                <button type="button" onClick={() => reportMessage(actionMessage)} className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-start text-sm font-semibold hover:bg-muted">
                  <Flag size={18} />
                  {t("groupChat.report")}
                </button>
              ) : null}
              <button type="button" onClick={() => setActionMessage(null)} className="mt-1 flex min-h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-semibold text-muted-foreground hover:bg-muted">
                {t("groupChat.cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewerImages.length > 0 && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4">
          <button
            type="button"
            onClick={() => setViewerImages([])}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
            aria-label={t("groupChat.close")}
          >
            <X size={20} />
          </button>
          <button
            type="button"
            onClick={() => setViewerImages([])}
            className="absolute inset-0"
            aria-label={t("groupChat.close")}
          />
          {viewerImages.length > 1 && viewerIndex > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setViewerIndex((i) => i - 1); }}
              className="absolute left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
              aria-label={t("groupChat.prevImage")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
            </button>
          )}
          {viewerImages.length > 1 && viewerIndex < viewerImages.length - 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setViewerIndex((i) => i + 1); }}
              className="absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
              aria-label={t("groupChat.nextImage")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          )}
          <div className="relative z-10 flex max-h-full max-w-full flex-col items-center">
            <img
              src={viewerImages[viewerIndex]}
              alt=""
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            />
            {viewerImages.length > 1 && (
              <span className="mt-3 text-sm text-white/70">{viewerIndex + 1} / {viewerImages.length}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
