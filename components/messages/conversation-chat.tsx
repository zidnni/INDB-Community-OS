"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Archive,
  ArrowLeft,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  Flag,
  ImagePlus,
  Loader2,
  LogOut,
  MoreVertical,
  Pencil,
  Send,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { flushSync } from "react-dom";

import { OnlineAvatar, useIsOnline } from "@/components/presence";
import { uploadMediaItem } from "@/lib/images/client-upload";
import { Link, useRouter } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import type {
  ConversationBlockState,
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

function sameImageSet(a: string[] | null | undefined, b: string[] | null | undefined) {
  return (a ?? []).join("|") === (b ?? []).join("|");
}

function isMatchingOptimisticMessage(
  optimistic: ConversationMessageWithSender,
  confirmed: ConversationMessageWithSender,
) {
  if (!isLocalMessage(optimistic.id) || isFailedMessage(optimistic.id)) return false;
  if (optimistic.conversation_id !== confirmed.conversation_id) return false;
  if (optimistic.sender_id !== confirmed.sender_id) return false;
  if ((optimistic.message ?? "") !== (confirmed.message ?? "")) return false;
  if (optimistic.message_type !== confirmed.message_type) return false;
  if (!sameImageSet(optimistic.image_urls, confirmed.image_urls)) return false;

  const optimisticTime = new Date(optimistic.created_at).getTime();
  const confirmedTime = new Date(confirmed.created_at).getTime();
  return Number.isFinite(optimisticTime) && Number.isFinite(confirmedTime)
    ? Math.abs(optimisticTime - confirmedTime) < 60000
    : true;
}

function isSendingMessage(id: string) {
  return id.startsWith("optimistic-");
}

function isFailedMessage(id: string) {
  return id.startsWith("failed-");
}

function isLocalMessage(id: string) {
  return isSendingMessage(id) || isFailedMessage(id);
}

type TranslationFn = (key: string, values?: Record<string, string | number>) => string;

function statusLabel(status: string | null | undefined, t: TranslationFn) {
  const key = status && ["published", "interested", "discussion", "in_progress", "completed", "archived"].includes(status)
    ? `groupChat.statuses.${status}`
    : "groupChat.active";
  return t(key);
}

function visibleImageLimit(count: number) {
  return count > 3 ? 3 : count;
}

function imageGridClass(count: number) {
  if (count <= 1) return "grid-cols-1";
  return "grid-cols-2";
}

function imageTileClass(count: number, index: number) {
  if (count <= 1) return "aspect-auto";
  if (count === 2) return "aspect-square";
  return index === 2 ? "col-span-2 aspect-[2/1]" : "aspect-square";
}

function imageBubbleWidthClass(count: number) {
  if (count <= 1) return "w-[min(18rem,calc(100vw-5.5rem))] sm:w-80";
  return "w-[min(18rem,calc(100vw-5.5rem))] sm:w-80";
}

function extractUrls(text: string | null | undefined) {
  return Array.from(text?.matchAll(/https?:\/\/[^\s<>"')]+/gi) ?? []).map((match) => match[0]);
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url);
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
    "block_failed",
    "unblock_failed",
    "blocked_send",
    "direct_mutual_required",
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
  isBlocked?: boolean;
}

function ConversationAvatar({ title, imageUrl, participants, isGroup, memberFallback, className, otherUserId, isBlocked }: ConversationAvatarProps) {
  if (isBlocked) {
    return (
      <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground", className)}>
        <Ban size={20} />
      </div>
    );
  }

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
  initialBlockState?: ConversationBlockState;
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
  initialBlockState,
}: ConversationChatProps) {
  const t = useTranslations("Messages");
  const memberFallback = t("groupChat.memberFallback");
  const router = useRouter();

  const [messages, setMessages] = useState(initialMessages);
  const [participants, setParticipants] = useState(initialParticipants);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [typingName, setTypingName] = useState<string | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerMessage, setViewerMessage] = useState<ConversationMessageWithSender | null>(null);
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
  const [viewerLoaded, setViewerLoaded] = useState(false);
  const [viewerError, setViewerError] = useState(false);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [localBlockedByMe, setLocalBlockedByMe] = useState(Boolean(initialBlockState?.blockedByMe));
  const [localBlockedByOther, setLocalBlockedByOther] = useState(Boolean(initialBlockState?.blockedByOther));
  const [localBlockedByMeAt, setLocalBlockedByMeAt] = useState<string | null>(initialBlockState?.blockedByMeAt ?? null);
  const [conversationDeleted, setConversationDeleted] = useState(false);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingBroadcastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatRootRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const groupImageInputRef = useRef<HTMLInputElement>(null);
  const realtimeChannelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const realtimeReadyRef = useRef(false);
  const pendingReadReceiptRef = useRef<{ reader_id: string; read_at: string } | null>(null);
  const initialOpenReadRef = useRef(false);
  const nearBottomRef = useRef(true);
  const viewerTouchStartXRef = useRef<number | null>(null);
  const viewerTouchStartYRef = useRef<number | null>(null);

  const isIdeaGroup = conversationType === "idea";
  const isDirectConversation = conversationType === "direct";
  const otherParticipant = participants.find((p) => p.user_id !== currentUserId)?.user;
  const otherUserId = otherParticipant?.id;
  const isDirectBlocked = isDirectConversation && (localBlockedByMe || localBlockedByOther);
  const otherProfileHref = isDirectConversation && !isDirectBlocked && otherParticipant?.id
    ? profileHref(otherParticipant, otherParticipant.id)
    : null;
  const isOtherUserOnline = useIsOnline(otherUserId);
  const detailsTitle = isDirectConversation ? displayName(otherParticipant, groupTitle) : groupTitle;
  const detailsUsername = isDirectConversation
    ? (otherParticipant?.username ? `@${otherParticipant.username}` : t("groupChat.usernameMissing"))
    : (ideaTitle ?? groupTitle);
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
  const blockFilterRef = useRef({
    blockedByMe: localBlockedByMe,
    blockedUserId: otherUserId ?? null,
    blockedAt: localBlockedByMeAt,
  });
  const activeOtherParticipants = useMemo(() => {
    return participants.filter((participant) =>
      participant.user_id !== currentUserId &&
      !participant.left_at &&
      !participant.removed_at
    );
  }, [participants, currentUserId]);
  const detailsParticipants = useMemo(() => {
    const visible = isDirectConversation
      ? participants.filter((participant) => participant.user_id !== currentUserId)
      : participants.filter((participant) => !participant.left_at && !participant.removed_at);

    return [...visible].sort((a, b) => {
      if (a.role === b.role) return 0;
      return a.role === "admin" ? -1 : 1;
    });
  }, [currentUserId, isDirectConversation, participants]);
  const isGroupReceiptMode = isIdeaGroup || activeOtherParticipants.length > 1;
  const latestReadReceipt = useMemo(() => {
    let latest: { messageId: string; seenByCount: number; createdAt: number } | null = null;

    for (const message of messages) {
      if (message.sender_id !== currentUserId || message.is_deleted || isLocalMessage(message.id)) continue;
      const createdAt = new Date(message.created_at).getTime();
      const readerIds = new Set<string>();
      activeOtherParticipants.forEach((participant) => {
        if (!participant.last_read_at) return false;
        const participantReadAt = new Date(participant.last_read_at).getTime();
        if (participantReadAt > Date.now() + 30000) return false;
        if (participantReadAt >= createdAt) {
          readerIds.add(participant.user_id);
        }
      });
      const messageReadAt = message.read_at ? new Date(message.read_at).getTime() : 0;
      const hasMessageReadAt = messageReadAt > 0 && messageReadAt <= Date.now() + 30000;
      const readCount = Math.max(readerIds.size, hasMessageReadAt ? 1 : 0);
      if (readCount === 0) continue;
      if (!latest || createdAt >= latest.createdAt) {
        latest = { messageId: message.id, seenByCount: readCount, createdAt };
      }
    }

    return latest;
  }, [activeOtherParticipants, currentUserId, messages]);
  const hasIncomingMessages = useMemo(() => {
    return messages.some((message) => message.sender_id !== currentUserId && !message.is_deleted);
  }, [currentUserId, messages]);
  const sharedMedia = useMemo(() => {
    return messages.flatMap((message) => {
      if (message.is_deleted) return [];
      const senderName = displayName(message.sender ?? participantById.get(message.sender_id)?.user, memberFallback);
      const imageItems = (message.image_urls?.length ? message.image_urls : (message.image_url ? [message.image_url] : []))
        .map((url, index) => ({
          type: "image" as const,
          url,
          messageId: message.id,
          senderId: message.sender_id,
          senderName,
          createdAt: message.created_at,
          index,
        }));
      const videoItems = extractUrls(message.message)
        .filter(isVideoUrl)
        .map((url, index) => ({
          type: "video" as const,
          url,
          messageId: message.id,
          senderId: message.sender_id,
          senderName,
          createdAt: message.created_at,
          index,
        }));
      return [...imageItems, ...videoItems];
    });
  }, [memberFallback, messages, participantById]);
  const mediaImages = useMemo(() => sharedMedia.filter((item) => item.type === "image").map((item) => item.url), [sharedMedia]);
  const videoCount = sharedMedia.filter((item) => item.type === "video").length;

  useEffect(() => {
    participantByIdRef.current = participantById;
  }, [participantById]);

  useEffect(() => {
    blockFilterRef.current = {
      blockedByMe: localBlockedByMe,
      blockedUserId: otherUserId ?? null,
      blockedAt: localBlockedByMeAt,
    };
  }, [localBlockedByMe, localBlockedByMeAt, otherUserId]);

  useEffect(() => {
    setLocalBlockedByMe(Boolean(initialBlockState?.blockedByMe));
    setLocalBlockedByOther(Boolean(initialBlockState?.blockedByOther));
    setLocalBlockedByMeAt(initialBlockState?.blockedByMeAt ?? null);
  }, [initialBlockState?.blockedByMe, initialBlockState?.blockedByOther, initialBlockState?.blockedByMeAt]);

  const shouldHideBlockedMessage = useCallback((message: ConversationMessageWithSender) => {
    const filter = blockFilterRef.current;
    if (!filter.blockedByMe || !filter.blockedUserId || !filter.blockedAt) return false;
    if (message.sender_id !== filter.blockedUserId) return false;
    return new Date(message.created_at).getTime() >= new Date(filter.blockedAt).getTime();
  }, []);

  const applyParticipantReadAt = useCallback((userId: string, readAt: string | null) => {
    if (!readAt) return;
    setParticipants((prev) =>
      prev.map((participant) =>
        participant.user_id === userId
          ? {
              ...participant,
              last_read_at: readAt,
              unread_count: participant.user_id === currentUserId ? 0 : participant.unread_count,
            }
          : participant,
      ),
    );
  }, [currentUserId]);

  const sendReadReceipt = useCallback((readAt: string) => {
    const payload = {
      reader_id: currentUserId,
      read_at: readAt,
    };

    if (!realtimeReadyRef.current || !realtimeChannelRef.current) {
      pendingReadReceiptRef.current = payload;
      return;
    }

    realtimeChannelRef.current.send({
      type: "broadcast",
      event: "read_receipt",
      payload,
    });
  }, [currentUserId]);

  const mergeServerMessages = useCallback((serverMessages: ConversationMessageWithSender[]) => {
    const visibleServerMessages = serverMessages.filter((message) => !shouldHideBlockedMessage(message));
    setMessages((prev) => {
      const unmatchedLocalMessages = prev.filter((message) =>
        isLocalMessage(message.id) &&
        !visibleServerMessages.some((serverMessage) => isMatchingOptimisticMessage(message, serverMessage))
      );
      const serverById = new Map(visibleServerMessages.map((message) => [message.id, message]));
      const localOnlyMessages = prev.filter((message) =>
        !isLocalMessage(message.id) && !serverById.has(message.id) && !shouldHideBlockedMessage(message)
      );
      return [...visibleServerMessages, ...localOnlyMessages, ...unmatchedLocalMessages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    });
  }, [shouldHideBlockedMessage]);

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
    setMessages(initialMessages.filter((message) => !shouldHideBlockedMessage(message)));
  }, [initialMessages, shouldHideBlockedMessage]);

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

  const closeViewer = useCallback(() => {
    setViewerImages([]);
    setViewerIndex(0);
    setViewerMessage(null);
    setViewerLoaded(false);
    setViewerError(false);
  }, []);

  const openViewer = useCallback((images: string[], index: number, message?: ConversationMessageWithSender | null) => {
    if (images.length === 0) return;
    setViewerImages(images);
    setViewerIndex(Math.max(0, Math.min(index, images.length - 1)));
    setViewerMessage(message ?? null);
    setViewerLoaded(false);
    setViewerError(false);
  }, []);

  const showPrevViewerImage = useCallback(() => {
    setViewerIndex((index) => {
      const next = Math.max(index - 1, 0);
      if (next !== index) {
        setViewerLoaded(false);
        setViewerError(false);
      }
      return next;
    });
  }, []);

  const showNextViewerImage = useCallback(() => {
    setViewerIndex((index) => {
      const next = Math.min(index + 1, viewerImages.length - 1);
      if (next !== index) {
        setViewerLoaded(false);
        setViewerError(false);
      }
      return next;
    });
  }, [viewerImages.length]);

  const downloadViewerImage = useCallback(async () => {
    const url = viewerImages[viewerIndex];
    if (!url) return;

    try {
      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) throw new Error("download_failed");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `indb-message-image-${viewerIndex + 1}.${blob.type.split("/")[1] || "jpg"}`;
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.download = `indb-message-image-${viewerIndex + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  }, [viewerImages, viewerIndex]);

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
    if (viewerImages.length === 0) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeViewer();
      } else if (event.key === "ArrowLeft") {
        showPrevViewerImage();
      } else if (event.key === "ArrowRight") {
        showNextViewerImage();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewerImages.length, closeViewer, showPrevViewerImage, showNextViewerImage]);

  useEffect(() => {
    const supabase = createClient();
    async function refreshConversation(includeMessages = false) {
      try {
        const actions = await import("@/app/[locale]/server-actions");
        const res = includeMessages
          ? await actions.getConversationMessagesAction(conversationId)
          : await actions.getConversationDetailsAction(conversationId);
        if (res.success && res.conversation) {
          setParticipants(res.conversation.participants);
          setGroupTitle(res.conversation.title);
          setDraftTitle(res.conversation.title);
          setGroupImageUrl(res.conversation.image_url);
          setDraftImageUrl(res.conversation.image_url);
          setDraftImageStoragePath(res.conversation.image_storage_path);
          setLocalArchived(!!res.conversation.archived_at);
          setLocalIdeaStatus(res.conversation.idea_status);
          if ("messages" in res && Array.isArray(res.messages)) {
            mergeServerMessages(res.messages as ConversationMessageWithSender[]);
          }
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
        () => refreshConversation(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_participants",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const participant = payload.new as Partial<ConversationParticipantInfo>;
          if (participant.user_id) {
            setParticipants((prev) =>
              prev.map((item) =>
                item.user_id === participant.user_id
                  ? {
                      ...item,
                      role: participant.role ?? item.role,
                      last_read_at: participant.last_read_at ?? item.last_read_at,
                      unread_count: typeof participant.unread_count === "number" ? participant.unread_count : item.unread_count,
                      left_at: participant.left_at ?? item.left_at,
                      removed_at: participant.removed_at ?? item.removed_at,
                      removed_by: participant.removed_by ?? item.removed_by,
                    }
                  : item,
              ),
            );
          }
          refreshConversation();
        },
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
          const nextMsg = normalizeRealtimeMessage(newMsg, participantByIdRef.current);
          if (shouldHideBlockedMessage(nextMsg)) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === nextMsg.id)) return prev;
            const matchingOptimistic = prev.find((message) => isMatchingOptimisticMessage(message, nextMsg));
            if (matchingOptimistic) {
              return prev.map((message) =>
                message.id === matchingOptimistic.id
                  ? {...nextMsg, sender: message.sender ?? nextMsg.sender}
                  : message,
              );
            }
            return [...prev, nextMsg];
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
          if (shouldHideBlockedMessage(nextMsg)) {
            setMessages((prev) => prev.filter((message) => message.id !== nextMsg.id));
            setActionMessage((current) => current?.id === nextMsg.id ? null : current);
            return;
          }
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
      .on("broadcast", { event: "read_receipt" }, (payload) => {
        const readerId = payload.payload.reader_id as string | undefined;
        const readAt = payload.payload.read_at as string | undefined;
        if (readerId && readerId !== currentUserId && readAt) {
          applyParticipantReadAt(readerId, readAt);
        }
      })
      .subscribe((status) => {
        realtimeReadyRef.current = status === "SUBSCRIBED";
        if (status !== "SUBSCRIBED" || !pendingReadReceiptRef.current) return;

        channel.send({
          type: "broadcast",
          event: "read_receipt",
          payload: pendingReadReceiptRef.current,
        });
        pendingReadReceiptRef.current = null;
      });

    realtimeChannelRef.current = channel;
    const refreshTimer = window.setInterval(() => refreshConversation(true), 5000);

    return () => {
      window.clearInterval(refreshTimer);
      if (realtimeChannelRef.current === channel) {
        realtimeChannelRef.current = null;
      }
      realtimeReadyRef.current = false;
      pendingReadReceiptRef.current = null;
      supabase.removeChannel(channel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [applyParticipantReadAt, conversationId, currentUserId, memberFallback, mergeServerMessages, shouldHideBlockedMessage]);

  const markVisibleMessagesRead = useCallback(async () => {
    if (!hasIncomingMessages) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

    try {
      const { markConversationReadAction } = await import("@/app/[locale]/server-actions");
      const res = await markConversationReadAction(conversationId);
      if (!res.success || !res.readAt) return;
      const readAt = res.readAt;
      applyParticipantReadAt(currentUserId, readAt);
      sendReadReceipt(readAt);
    } catch (e) {
      console.error("markRead error:", e);
    }
  }, [applyParticipantReadAt, conversationId, currentUserId, hasIncomingMessages, sendReadReceipt]);

  useEffect(() => {
    initialOpenReadRef.current = false;
  }, [conversationId]);

  useEffect(() => {
    if (initialOpenReadRef.current) return;
    initialOpenReadRef.current = true;
    markVisibleMessagesRead();
  }, [conversationId]);

  useEffect(() => {
    function handleVisibilityOrFocus() {
      markVisibleMessagesRead();
    }

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [markVisibleMessagesRead]);

  useEffect(() => {
    const root = chatRootRef.current;
    if (!root) return;

    function handleChatInteraction() {
      markVisibleMessagesRead();
    }

    root.addEventListener("pointerdown", handleChatInteraction);
    return () => root.removeEventListener("pointerdown", handleChatInteraction);
  }, [markVisibleMessagesRead]);

  const broadcastTyping = useCallback(() => {
    if (typingBroadcastRef.current) return;
    if (!realtimeReadyRef.current || !realtimeChannelRef.current) return;

    realtimeChannelRef.current.send({
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
  }, [currentParticipant?.user, currentUserId, memberFallback]);

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

  function handleSend(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && pendingImages.length === 0) || isReadOnly) return;
    if (isDirectConversation && localBlockedByMe) {
      setError("blocked_send");
      return;
    }
    sendLocalMessage(trimmed, pendingImages);
  }

  function sendLocalMessage(
    trimmed: string,
    optimisticImages: { url: string; storagePath: string }[],
    existingLocalId?: string,
  ) {
    if (!trimmed && optimisticImages.length === 0) return;
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticCreatedAt = new Date().toISOString();
    const localId = existingLocalId ?? optimisticId;
    const optimisticMessage: ConversationMessageWithSender = {
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
    };

    flushSync(() => {
      setError(null);
      if (!existingLocalId) {
        setInput("");
        setPendingImages([]);
      }

      setMessages((prev) => {
        if (existingLocalId) {
          return prev.map((message) =>
            message.id === existingLocalId
              ? {
                  ...message,
                  id: optimisticId,
                  created_at: optimisticCreatedAt,
                }
              : message,
          );
        }

        return [...prev, optimisticMessage];
      });
    });

    requestAnimationFrame(() => scrollToLatest("auto"));

    queueMicrotask(() => {
      void persistLocalMessage({
        optimisticId,
        localId,
        trimmed,
        optimisticImages,
      });
    });
  }

  async function persistLocalMessage({
    optimisticId,
    localId,
    trimmed,
    optimisticImages,
  }: {
    optimisticId: string;
    localId: string;
    trimmed: string;
    optimisticImages: { url: string; storagePath: string }[];
  }) {
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
          const withoutOptimistic = prev.filter((m) => m.id !== optimisticId && m.id !== localId);
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
        setMessages((prev) => prev.map((m) =>
          m.id === optimisticId
            ? {
                ...m,
                id: `failed-${optimisticId.slice("optimistic-".length)}`,
              }
            : m,
        ));
        setError(res.error ?? "insert_failed");
      }
    } catch (e) {
      console.error("send error:", e);
      setMessages((prev) => prev.map((m) =>
        m.id === optimisticId
          ? {
              ...m,
              id: `failed-${optimisticId.slice("optimistic-".length)}`,
            }
          : m,
      ));
      setError("insert_failed");
    }
  }

  async function retryMessage(message: ConversationMessageWithSender) {
    if (!isFailedMessage(message.id) || isReadOnly) return;
    const retryImages = message.image_urls.length
      ? message.image_urls.map((url, index) => ({
          url,
          storagePath: message.image_storage_paths[index] ?? "",
        }))
      : message.image_url
        ? [{ url: message.image_url, storagePath: message.image_storage_path ?? "" }]
        : [];
    sendLocalMessage(message.message ?? "", retryImages, message.id);
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

  async function deleteMessage(message: ConversationMessageWithSender, options?: { skipConfirm?: boolean }) {
    if (message.sender_id !== currentUserId || message.is_deleted || isReadOnly || messageActionSaving) return;
    if (!options?.skipConfirm && !window.confirm(t("groupChat.confirmDelete"))) return;
    setMessageActionSaving(true);
    setError(null);
    setActionMessage(null);
    setActionMenuId(null);
    if (options?.skipConfirm) closeViewer();
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

  async function handleBlockUser() {
    if (!isDirectConversation || !window.confirm(t("groupChat.confirmBlock"))) return;
    setError(null);
    const previousBlockedByMe = localBlockedByMe;
    const previousBlockedAt = localBlockedByMeAt;
    const previousMessages = messages;
    const optimisticBlockedAt = new Date().toISOString();
    setLocalBlockedByMe(true);
    setLocalBlockedByMeAt(optimisticBlockedAt);
    if (otherUserId) {
      setMessages((prev) => prev.filter((message) =>
        !(message.sender_id === otherUserId && new Date(message.created_at).getTime() >= new Date(optimisticBlockedAt).getTime())
      ));
    }

    try {
      const { blockConversationUserAction } = await import("@/app/[locale]/server-actions");
      const res = await blockConversationUserAction(conversationId);
      if (!res.success) {
        setLocalBlockedByMe(previousBlockedByMe);
        setLocalBlockedByMeAt(previousBlockedAt);
        setMessages(previousMessages);
        setError(res.error ?? "block_failed");
        return;
      }
      const blockedAt = res.blockedAt ?? new Date().toISOString();
      setLocalBlockedByMe(true);
      setLocalBlockedByMeAt(blockedAt);
      if (otherUserId) {
        setMessages((prev) => prev.filter((message) =>
          !(message.sender_id === otherUserId && new Date(message.created_at).getTime() >= new Date(blockedAt).getTime())
        ));
      }
    } catch (e) {
      console.error("block user error:", e);
      setLocalBlockedByMe(previousBlockedByMe);
      setLocalBlockedByMeAt(previousBlockedAt);
      setMessages(previousMessages);
      setError("block_failed");
    }
  }

  async function handleUnblockUser() {
    if (!isDirectConversation) return;
    setError(null);
    const previousBlockedByMe = localBlockedByMe;
    const previousBlockedAt = localBlockedByMeAt;
    setLocalBlockedByMe(false);
    setLocalBlockedByMeAt(null);

    try {
      const { unblockConversationUserAction } = await import("@/app/[locale]/server-actions");
      const res = await unblockConversationUserAction(conversationId);
      if (!res.success) {
        setLocalBlockedByMe(previousBlockedByMe);
        setLocalBlockedByMeAt(previousBlockedAt);
        setError(res.error ?? "unblock_failed");
        return;
      }
      setError(null);
    } catch (e) {
      console.error("unblock user error:", e);
      setLocalBlockedByMe(previousBlockedByMe);
      setLocalBlockedByMeAt(previousBlockedAt);
      setError("unblock_failed");
    }
  }

  async function submitConversationReport() {
    setDetailsSaving(true);
    setError(null);
    try {
      const { reportConversationUserAction } = await import("@/app/[locale]/server-actions");
      const res = await reportConversationUserAction(conversationId, reportReason);
      if (!res.success) {
        setError(res.error ?? "report_failed");
        return;
      }
      setShowReportSheet(false);
    } catch (e) {
      console.error("report user error:", e);
      setError("report_failed");
    } finally {
      setDetailsSaving(false);
    }
  }

  async function handleDeleteConversation() {
    if (!window.confirm(t("groupChat.confirmDeleteConversation"))) return;
    setConversationDeleted(true);
    router.replace("/messages");
    setError(null);
    try {
      const { deleteConversationForMeAction } = await import("@/app/[locale]/server-actions");
      const res = await deleteConversationForMeAction(conversationId);
      if (!res.success) {
        setConversationDeleted(false);
        setError(res.error ?? "delete_failed");
        return;
      }
    } catch (e) {
      console.error("delete conversation error:", e);
      setConversationDeleted(false);
      setError("delete_failed");
    }
  }

  const headerSubtitle = isIdeaGroup
    ? `${t("groupChat.memberCount", { count: effectiveMemberCount })} - ${statusLabel(localIdeaStatus, t)}`
    : isDirectConversation
      ? (!isDirectBlocked && isOtherUserOnline ? t("groupChat.onlineNow") : detailsUsername)
      : t("groupChat.memberCount", { count: effectiveMemberCount });
  const readOnlyMessage = isCompleted ? t("groupChat.closedAfterCompletion") : t("groupChat.readOnlyNotice");
  const composerBlocked = isDirectConversation && localBlockedByMe;
  const canDeleteViewerImage = Boolean(
    viewerMessage &&
    viewerMessage.sender_id === currentUserId &&
    !viewerMessage.is_deleted &&
    !isReadOnly &&
    !isLocalMessage(viewerMessage.id),
  );

  if (conversationDeleted) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-background px-6 text-center">
        <div className="flex max-w-sm flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground">{t("selectConversationHint")}</p>
          <Link
            href="/messages"
            prefetch={true}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-95"
          >
            <ArrowLeft size={18} />
            {t("groupChat.backToMessages")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div ref={chatRootRef} className="relative flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden bg-background overscroll-contain [touch-action:pan-y]">
      <div className="shrink-0 overflow-x-hidden border-b border-border/70 bg-card/95 px-2 py-1.5 pt-[max(0.375rem,var(--safe-top))] shadow-sm backdrop-blur md:px-2.5 md:py-2">
        <div className="flex min-h-[52px] min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => router.replace("/messages")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition active:bg-muted md:hidden"
            aria-label={t("groupChat.backToMessages")}
          >
            <ArrowLeft size={21} />
          </button>
          <button
            type="button"
            onClick={() => setShowGroupInfo(true)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-start transition active:bg-muted/60 md:hover:bg-muted/60"
            aria-label={t("groupChat.groupInfo")}
          >
            <ConversationAvatar
              title={detailsTitle}
              imageUrl={isDirectConversation && !isDirectBlocked ? otherParticipant?.avatar_url ?? null : groupImageUrl}
              participants={participants}
              isGroup={isIdeaGroup}
              memberFallback={memberFallback}
              otherUserId={otherUserId}
              isBlocked={isDirectBlocked}
              className="h-9 w-9 md:h-10 md:w-10"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold leading-tight text-foreground">{detailsTitle}</p>
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
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth bg-muted/20 px-2.5 py-3 overscroll-contain [overflow-anchor:none] [touch-action:pan-y] md:px-4 md:py-4"
      >
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-end overflow-x-hidden">
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
            const visibleImages = msgImages.slice(0, visibleImageLimit(msgImages.length));
            const isDeleted = Boolean(msg.is_deleted);
            const isSendingLocal = isSendingMessage(msg.id);
            const isFailedLocal = isFailedMessage(msg.id);
            const hasImage = !isDeleted && msgImages.length > 0;
            const isEditing = editingMessageId === msg.id;
            const canMutate = isMine && !isDeleted && !isReadOnly && !isLocalMessage(msg.id);
            const hasText = Boolean(msg.message?.trim());
            const receiptForMessage = isMine && latestReadReceipt?.messageId === msg.id ? latestReadReceipt : null;

            return (
              <div
                key={msg.id}
                className={cn(
                  "group/message flex w-full min-w-0 max-w-full overflow-x-hidden",
                  isMine ? "justify-end" : "justify-start",
                  index === 0 ? "mt-0" : isFirstInGroup ? "mt-3.5" : "mt-1",
                )}
              >
                <div className={cn("flex min-w-0 max-w-[86%] items-end gap-1.5 overflow-x-hidden sm:max-w-[76%] md:max-w-[68%] lg:max-w-[64%] md:gap-2", isMine && "flex-row-reverse")}>
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
                        hasImage && !isEditing ? cn("p-1.5", imageBubbleWidthClass(msgImages.length)) : "px-3 py-2 md:px-3.5 md:py-2.5",
                        isDeleted && "italic",
                        isMine
                          ? "rounded-ee-[5px] bg-primary text-primary-foreground"
                          : "rounded-es-[5px] border border-border/50 bg-card text-foreground",
                        isSendingLocal && "opacity-80",
                        isFailedLocal && "ring-1 ring-destructive/40",
                      )}
                      dir="auto"
                    >
                      {hasImage && (
                        <div
                          className={cn(
                            "grid w-full max-w-full gap-1 overflow-hidden rounded-xl",
                            imageGridClass(msgImages.length),
                          )}
                        >
                          {visibleImages.map((url, i) => (
                            <button
                              key={i}
                              type="button"
                              onPointerDown={(event) => event.stopPropagation()}
                              onTouchStart={(event) => event.stopPropagation()}
                              onClick={() => openViewer(msgImages, Math.min(i, msgImages.length - 1), canMutate ? msg : null)}
                              className={cn(
                                "relative max-w-full overflow-hidden bg-black/5 text-start transition active:scale-[0.99]",
                                imageTileClass(msgImages.length, i),
                              )}
                              aria-label={t("groupChat.viewImage")}
                            >
                              <img
                                src={url}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className={cn(
                                  "w-full max-w-full select-none [-webkit-user-drag:none]",
                                  msgImages.length === 1
                                    ? "h-auto max-h-80 object-contain"
                                    : "h-full object-cover",
                                )}
                              />
                              {i === 2 && msgImages.length > 3 && (
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 text-lg font-bold text-white">
                                  +{msgImages.length - 3}
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
                      </div>
                      {isMine && isFailedLocal ? (
                        <div className="mt-1 flex items-center justify-end gap-2 text-[11px] font-semibold text-destructive">
                          <span>{t("groupChat.failedStatus")}</span>
                          <button
                            type="button"
                            onClick={() => retryMessage(msg)}
                            className="rounded-full bg-destructive/10 px-2 py-0.5 transition hover:bg-destructive/15"
                          >
                            {t("groupChat.retry")}
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {receiptForMessage && !isLocalMessage(msg.id) ? (
                      <div className="mt-[3px] flex items-center justify-end gap-[3px] text-[11px] font-normal text-muted-foreground/70">
                        <Eye size={11} />
                        <span>
                          {isGroupReceiptMode
                            ? t("groupChat.seenBy", { count: receiptForMessage.seenByCount })
                            : t("groupChat.seen")}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
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

          {typingName && !isReadOnly && (
            <div className="mx-auto mb-1.5 flex w-full max-w-3xl items-center gap-2 px-1 text-xs font-medium text-primary">
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70" style={{ animationDelay: "300ms" }} />
              </span>
              <span className="truncate">{typingName} {t("typing")}</span>
            </div>
          )}

          {composerBlocked && (
            <div className="mx-auto mb-2 flex w-full max-w-3xl items-center justify-center rounded-full bg-muted px-3 py-2 text-center text-xs font-medium text-muted-foreground">
              {t("groupChat.blockedSendNotice")}
            </div>
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
                disabled={imageUploading || composerBlocked}
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
                disabled={composerBlocked}
                maxLength={pendingImages.length > 0 ? 500 : 1000}
                placeholder={composerBlocked ? t("groupChat.blockedSendPlaceholder") : pendingImages.length > 0 ? t("groupChat.addCaption") : t("placeholder")}
                className="min-h-10 min-w-0 flex-1 rounded-full border border-border/60 bg-card px-3.5 py-2 text-sm shadow-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 md:min-h-11 md:px-4 md:py-2.5"
              />
              <button
                type="submit"
                disabled={composerBlocked || (!input.trim() && pendingImages.length === 0)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition active:bg-primary/90 disabled:opacity-40 md:h-11 md:w-11 md:hover:bg-primary/90"
                aria-label={t("groupChat.sendMessage")}
              >
                <Send size={18} />
              </button>
            </form>
          )}
        </div>
      )}

      {showGroupInfo && (
        <div className="absolute inset-0 z-30 flex bg-background">
          <div className="flex h-full w-full flex-col overflow-hidden">
            <div className="flex min-h-[56px] shrink-0 items-center gap-2 border-b border-border/70 bg-card/95 px-3 pt-[max(0px,var(--safe-top))] shadow-sm backdrop-blur">
              <button
                type="button"
                onClick={() => setShowGroupInfo(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
                aria-label={t("groupChat.close")}
              >
                <ArrowLeft size={20} />
              </button>
              <p className="min-w-0 flex-1 truncate text-base font-semibold">{t("groupChat.detailsTitle")}</p>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4 pb-[calc(1rem+var(--safe-bottom))] md:px-6 md:py-6">
              <div className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.15fr)]">
                <div className="space-y-4">
                  <section className="rounded-2xl border border-border/70 bg-card px-4 py-6 text-center shadow-sm">
                    <div className="mx-auto h-28 w-28">
                      {otherProfileHref ? (
                        <Link
                          href={otherProfileHref}
                          className="block rounded-full outline-none ring-primary/40 focus-visible:ring-2"
                          aria-label={t("groupChat.openProfile", { name: detailsTitle })}
                        >
                          <ConversationAvatar
                            title={detailsTitle}
                            imageUrl={otherParticipant?.avatar_url ?? null}
                            participants={participants}
                            isGroup={false}
                            memberFallback={memberFallback}
                            isBlocked={false}
                            className="h-28 w-28"
                          />
                        </Link>
                      ) : (
                        <ConversationAvatar
                          title={detailsTitle}
                          imageUrl={isDirectConversation && !isDirectBlocked ? otherParticipant?.avatar_url ?? null : groupImageUrl}
                          participants={participants}
                          isGroup={isIdeaGroup}
                          memberFallback={memberFallback}
                          isBlocked={isDirectBlocked}
                          className="h-28 w-28"
                        />
                      )}
                    </div>
                    {otherProfileHref ? (
                      <Link href={otherProfileHref} className="block outline-none ring-primary/40 focus-visible:ring-2 rounded-lg">
                        <h2 className="mx-auto mt-4 max-w-sm truncate text-xl font-semibold tracking-tight text-foreground transition-colors hover:text-primary">{detailsTitle}</h2>
                      </Link>
                    ) : (
                      <h2 className="mx-auto mt-4 max-w-sm truncate text-xl font-semibold tracking-tight text-foreground">{detailsTitle}</h2>
                    )}
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {isDirectConversation ? (
                        <>
                          {otherProfileHref ? (
                            <Link href={otherProfileHref} className="block rounded-md outline-none ring-primary/40 focus-visible:ring-2">
                              <p className="transition-colors hover:text-foreground">{detailsUsername}</p>
                            </Link>
                          ) : (
                            <p>{detailsUsername}</p>
                          )}
                          {isDirectBlocked ? (
                            <p className="font-medium text-muted-foreground">{t("groupChat.blockedProfile")}</p>
                          ) : isOtherUserOnline ? (
                            <p className="font-medium text-emerald-600 dark:text-emerald-300">{t("groupChat.onlineNow")}</p>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {ideaTitle && <p className="mx-auto max-w-sm truncate">{ideaTitle}</p>}
                          <p>{t("groupChat.memberCount", { count: effectiveMemberCount })}</p>
                        </>
                      )}
                    </div>
                  </section>

                  {error && (
                    <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {friendlyError(error, t)}
                    </p>
                  )}

                  <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
                    <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">{t("groupChat.members")}</p>
                      {!isDirectConversation && (
                        <span className="text-xs text-muted-foreground">{t("groupChat.memberCount", { count: effectiveMemberCount })}</span>
                      )}
                    </div>
                    <div className="divide-y divide-border/60">
                      {detailsParticipants.map((participant) => {
                        const name = displayName(participant.user, memberFallback);
                        const isSelf = participant.user_id === currentUserId;
                        const memberProfileHref = profileHref(participant.user, participant.user_id);
                        return (
                          <div key={participant.user_id} className="flex min-h-[66px] items-center gap-3 px-4 py-2.5">
                            {memberProfileHref ? (
                              <Link
                                href={memberProfileHref}
                                className="shrink-0 rounded-full outline-none ring-primary/40 focus-visible:ring-2"
                                aria-label={t("groupChat.openProfile", { name })}
                              >
                                {isDirectBlocked ? (
                                  <ConversationAvatar title={name} imageUrl={null} participants={[]} isGroup={false} memberFallback={memberFallback} isBlocked className="h-11 w-11" />
                                ) : (
                                  <OnlineAvatar userId={participant.user?.id} label={name} avatarUrl={participant.user?.avatar_url ?? null} className="h-11 w-11" />
                                )}
                              </Link>
                            ) : (
                              isDirectBlocked ? (
                                <ConversationAvatar title={name} imageUrl={null} participants={[]} isGroup={false} memberFallback={memberFallback} isBlocked className="h-11 w-11" />
                              ) : (
                                <OnlineAvatar userId={participant.user?.id} label={name} avatarUrl={participant.user?.avatar_url ?? null} className="h-11 w-11" />
                              )
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">
                                {name}
                                {isSelf ? ` (${t("groupChat.you")})` : ""}
                              </p>
                              {participant.role === "admin" && (
                                <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                  <Shield size={12} />
                                  {t("groupChat.roles.admin")}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section className="space-y-2 rounded-2xl border border-border/70 bg-card p-2 shadow-sm">
                    {isDirectConversation ? (
                      <>
                        {localBlockedByMe ? (
                          <button type="button" onClick={handleUnblockUser} disabled={detailsSaving} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-start text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50">
                            <Ban size={17} />
                            {t("groupChat.unblockUser")}
                          </button>
                        ) : (
                          <button type="button" onClick={handleBlockUser} disabled={detailsSaving} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-start text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-50">
                            <Ban size={17} />
                            {t("groupChat.blockUser")}
                          </button>
                        )}
                        <button type="button" onClick={() => setShowReportSheet(true)} disabled={detailsSaving} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-start text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-50">
                          <Flag size={17} />
                          {t("groupChat.reportUser")}
                        </button>
                      </>
                    ) : (
                      <>
                        {!isAdmin && (
                          <button type="button" onClick={handleLeaveGroup} disabled={detailsSaving} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-start text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-50">
                            <LogOut size={17} />
                            {t("groupChat.leaveGroup")}
                          </button>
                        )}
                        <button type="button" onClick={() => setShowReportSheet(true)} disabled={detailsSaving} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-start text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-50">
                          <Flag size={17} />
                          {t("groupChat.report")}
                        </button>
                      </>
                    )}
                    <button type="button" onClick={handleDeleteConversation} disabled={detailsSaving} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-start text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-50">
                      <Trash2 size={17} />
                      {t("groupChat.deleteConversation")}
                    </button>
                  </section>
                </div>

                <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{t("groupChat.mediaTitle")}</h3>
                    {sharedMedia.length > 0 && (
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>{t("groupChat.photosCount", { count: sharedMedia.length - videoCount })}</span>
                        <span>{t("groupChat.videosCount", { count: videoCount })}</span>
                      </div>
                    )}
                  </div>
                  {sharedMedia.length === 0 ? (
                    <p className="py-3 text-sm text-muted-foreground">{t("groupChat.noMedia")}</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
                      {sharedMedia.slice(0, 24).map((item) => (
                        <button
                          key={`${item.messageId}-${item.index}-${item.url}`}
                          type="button"
                          onClick={() => item.type === "image" ? openViewer(mediaImages, Math.max(0, mediaImages.indexOf(item.url))) : window.open(item.url, "_blank", "noopener,noreferrer")}
                          className="group relative aspect-square overflow-hidden rounded-xl bg-muted"
                        >
                          {item.type === "image" ? (
                            <img src={item.url} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                          ) : (
                            <video src={item.url} className="h-full w-full object-cover" muted />
                          )}
                          <span className="absolute inset-x-0 bottom-0 bg-black/45 px-1 py-0.5 text-[10px] text-white">{formatTime(item.createdAt)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReportSheet && (
        <div className="fixed inset-0 z-[80] flex items-end bg-black/40 px-3 pb-[calc(0.75rem+var(--safe-bottom))] md:items-center md:justify-center md:p-4" onClick={() => setShowReportSheet(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-card p-4 shadow-2xl md:rounded-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30 md:hidden" />
            <h3 className="text-base font-semibold text-foreground">{t("groupChat.reportReasonTitle")}</h3>
            <div className="mt-3 space-y-1">
              {([
                ["spam", t("groupChat.reportSpam")],
                ["harassment", t("groupChat.reportHarassment")],
                ["fake", t("groupChat.reportFake")],
                ["other", t("groupChat.reportOther")],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setReportReason(value)}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between rounded-2xl px-3 text-start text-sm font-medium transition",
                    reportReason === value ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
                  )}
                >
                  <span>{label}</span>
                  {reportReason === value && <Check size={16} />}
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowReportSheet(false)}
                disabled={detailsSaving}
                className="min-h-11 rounded-full border border-border px-4 text-sm font-semibold text-muted-foreground transition hover:bg-muted disabled:opacity-50"
              >
                {t("groupChat.cancel")}
              </button>
              <button
                type="button"
                onClick={submitConversationReport}
                disabled={detailsSaving}
                className="min-h-11 rounded-full bg-destructive px-4 text-sm font-semibold text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
              >
                {detailsSaving ? t("groupChat.saving") : t("groupChat.report")}
              </button>
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
        <div
          className="fixed inset-0 z-[100] flex h-[100dvh] w-screen touch-pan-y flex-col overflow-hidden bg-black text-white"
          onClick={closeViewer}
          onTouchStart={(event) => {
            viewerTouchStartXRef.current = event.touches[0]?.clientX ?? null;
            viewerTouchStartYRef.current = event.touches[0]?.clientY ?? null;
          }}
          onTouchEnd={(event) => {
            if (viewerTouchStartXRef.current === null || viewerTouchStartYRef.current === null) return;
            const touch = event.changedTouches[0];
            const diffX = viewerTouchStartXRef.current - touch.clientX;
            const diffY = viewerTouchStartYRef.current - touch.clientY;
            viewerTouchStartXRef.current = null;
            viewerTouchStartYRef.current = null;
            if (Math.abs(diffX) < 45 || Math.abs(diffX) < Math.abs(diffY)) return;
            if (diffX > 0) {
              showNextViewerImage();
            } else {
              showPrevViewerImage();
            }
          }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/75 to-transparent px-[max(0.75rem,var(--safe-left))] pb-10 pt-[calc(0.75rem+var(--safe-top))]">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                closeViewer();
              }}
              className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur transition active:scale-95 hover:bg-white/20"
              aria-label={t("groupChat.close")}
            >
              <X size={22} />
            </button>
            <div className="pointer-events-auto flex items-center gap-2">
              <div className="rounded-full bg-white/12 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur">
                {viewerIndex + 1} / {viewerImages.length}
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  downloadViewerImage();
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur transition active:scale-95 hover:bg-white/20"
                aria-label={t("groupChat.downloadImage")}
              >
                <Download size={20} />
              </button>
              {canDeleteViewerImage && viewerMessage ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void deleteMessage(viewerMessage, { skipConfirm: true });
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500/80 text-white backdrop-blur transition active:scale-95 hover:bg-red-500"
                  aria-label={t("groupChat.delete")}
                >
                  <Trash2 size={20} />
                </button>
              ) : null}
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 py-[calc(4rem+var(--safe-top))] pb-[calc(4rem+var(--safe-bottom))]">
            {viewerImages.length > 1 && viewerIndex > 0 && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  showPrevViewerImage();
                }}
                className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/14 text-white backdrop-blur transition active:scale-95 hover:bg-white/20 md:h-12 md:w-12"
                aria-label={t("groupChat.prevImage")}
              >
                <ChevronLeft size={26} />
              </button>
            )}
            {viewerImages.length > 1 && viewerIndex < viewerImages.length - 1 && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  showNextViewerImage();
                }}
                className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/14 text-white backdrop-blur transition active:scale-95 hover:bg-white/20 md:h-12 md:w-12"
                aria-label={t("groupChat.nextImage")}
              >
                <ChevronRight size={26} />
              </button>
            )}

            {!viewerLoaded && !viewerError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-white/70" />
              </div>
            )}

            {viewerError ? (
              <div className="mx-5 rounded-2xl bg-white/10 px-5 py-4 text-center text-sm text-white/80 backdrop-blur">
                {t("groupChat.imageLoadFailed")}
              </div>
            ) : (
              <img
                key={viewerImages[viewerIndex]}
                src={viewerImages[viewerIndex]}
                alt=""
                loading="eager"
                draggable={false}
                onClick={(event) => event.stopPropagation()}
                onLoad={() => {
                  setViewerLoaded(true);
                  setViewerError(false);
                }}
                onError={() => {
                  setViewerLoaded(false);
                  setViewerError(true);
                }}
                className={cn(
                  "max-h-full max-w-full select-none object-contain transition duration-200 [-webkit-user-drag:none]",
                  viewerLoaded ? "opacity-100" : "opacity-0",
                )}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
