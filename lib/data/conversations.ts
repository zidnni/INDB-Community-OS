import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { haveMutualFollow } from '@/lib/data/follows';

export type ConversationMessageType = 'text' | 'image';
export type ConversationParticipantRole = 'admin' | 'member';

export interface ConversationUserProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface ConversationParticipantInfo {
  id: string;
  conversation_id: string;
  user_id: string;
  role: ConversationParticipantRole;
  last_read_at: string | null;
  unread_count: number;
  left_at: string | null;
  removed_at: string | null;
  removed_by: string | null;
  created_at: string | null;
  user: ConversationUserProfile | null;
}

export interface ConversationMessageWithSender {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string | null;
  message_type: ConversationMessageType;
  image_url: string | null;
  image_storage_path: string | null;
  image_urls: string[];
  image_storage_paths: string[];
  is_edited: boolean;
  edited_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  read_at: string | null;
  sender: ConversationUserProfile | null;
}

export interface ConversationListItem {
  id: string;
  type: string;
  graatek_id: string | null;
  idea_id: string | null;
  title: string;
  image_url: string | null;
  image_storage_path: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string | null;
  idea_title: string | null;
  idea_status: string | null;
  member_count: number;
  last_message: {
    message: string | null;
    message_type: ConversationMessageType;
    image_url: string | null;
    created_at: string;
    sender_id: string;
  } | null;
  unread_count: number;
  other_participant: ConversationUserProfile | null;
  is_blocked_by_me?: boolean;
  is_blocked_by_other?: boolean;
  blocked_at?: string | null;
}

export interface ConversationDetails {
  id: string;
  type: string;
  graatek_id: string | null;
  idea_id: string | null;
  title: string;
  image_url: string | null;
  image_storage_path: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string | null;
  idea_title: string | null;
  idea_status: string | null;
  member_count: number;
  participants: ConversationParticipantInfo[];
}

export interface ConversationBlockState {
  blockedByMe: boolean;
  blockedByOther: boolean;
  blockedByMeAt: string | null;
  blockedByOtherAt: string | null;
  otherUserId: string | null;
}

type RawConversationParticipant = Partial<ConversationParticipantInfo> & {
  id: string;
  conversation_id: string;
  user_id: string;
  user?: ConversationUserProfile | null;
};

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function normalizeMessageType(value: unknown): ConversationMessageType {
  return value === 'image' ? 'image' : 'text';
}

function isLegacyConversationMessageSchemaError(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? '';
  return (
    error?.code === 'PGRST204' ||
    message.includes('schema cache') ||
    message.includes('message_type') ||
    message.includes('image_url') ||
    message.includes('image_storage_path')
  );
}

function normalizeParticipant(
  participant: RawConversationParticipant,
  adminUserId: string | null = null,
): ConversationParticipantInfo {
  return {
    id: participant.id,
    conversation_id: participant.conversation_id,
    user_id: participant.user_id,
    role: participant.role === 'admin' || participant.user_id === adminUserId ? 'admin' : 'member',
    last_read_at: participant.last_read_at ?? null,
    unread_count: participant.unread_count ?? 0,
    left_at: participant.left_at ?? null,
    removed_at: participant.removed_at ?? null,
    removed_by: participant.removed_by ?? null,
    created_at: participant.created_at ?? null,
    user: participant.user ?? null,
  };
}

function mapInboxRow(row: Record<string, unknown>): ConversationListItem {
  const lastMessageAt = asString(row.last_message_at);

  return {
    id: row.id as string,
    type: row.type as string,
    graatek_id: asString(row.graatek_id),
    idea_id: asString(row.idea_id),
    title: (row.title as string) ?? '',
    image_url: asString(row.image_url),
    image_storage_path: asString(row.image_storage_path),
    archived_at: asString(row.archived_at),
    created_at: row.created_at as string,
    updated_at: asString(row.updated_at),
    idea_title: asString(row.idea_title),
    idea_status: asString(row.idea_status),
    member_count: asNumber(row.member_count),
    last_message: lastMessageAt
      ? {
          message: asString(row.last_message_text),
          message_type: normalizeMessageType(row.last_message_type),
          image_url: asString(row.last_message_image_url),
          created_at: lastMessageAt,
          sender_id: row.last_message_sender_id as string,
        }
      : null,
    unread_count: asNumber(row.unread_count),
    other_participant: row.other_user_id
      ? {
          id: row.other_user_id as string,
          username: asString(row.other_username),
          full_name: asString(row.other_full_name),
          avatar_url: asString(row.other_avatar_url),
        }
      : null,
  };
}

function mapLastMessage(row: Record<string, unknown> | null | undefined): ConversationListItem['last_message'] {
  if (!row?.created_at) return null;
  return {
    message: asString(row.message),
    message_type: normalizeMessageType(row.message_type),
    image_url: asString(row.image_url),
    created_at: row.created_at as string,
    sender_id: row.sender_id as string,
  };
}

export async function getUserConversations(userId: string): Promise<ConversationListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_user_inbox', { p_user_id: userId });
  if (error) {
    console.error('getUserConversations error:', error);
    return [];
  }

  let conversations = ((data ?? []) as Record<string, unknown>[]).map(mapInboxRow);
  const directOtherIds = conversations
    .filter((conversation) => conversation.type === 'direct' && conversation.other_participant?.id)
    .map((conversation) => conversation.other_participant?.id as string);
  const uniqueDirectOtherIds = Array.from(new Set(directOtherIds));

  if (uniqueDirectOtherIds.length > 0) {
    const { data: blockRows, error: blockError } = await supabase
      .from('blocked_users')
      .select('blocker_id, blocked_id, created_at')
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

    if (!blockError && blockRows?.length) {
      const blockedByMeAt = new Map<string, string>();
      const blockedByOtherAt = new Map<string, string>();
      blockRows.forEach((row) => {
        if (row.blocker_id === userId) blockedByMeAt.set(row.blocked_id, row.created_at);
        if (row.blocked_id === userId) blockedByOtherAt.set(row.blocker_id, row.created_at);
      });

      const lastVisibleMessages = new Map<string, ConversationListItem['last_message']>();
      for (const conversation of conversations) {
        const otherId = conversation.other_participant?.id;
        const blockedAt = otherId ? blockedByMeAt.get(otherId) : null;
        if (!otherId || !blockedAt) continue;

        const { data: messageRows, error: messageError } = await supabase
          .from('conversation_messages')
          .select('message, message_type, image_url, created_at, sender_id')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: false })
          .limit(100);

        if (messageError) continue;
        const visibleLastMessage = (messageRows ?? []).find((message) =>
          !(message.sender_id === otherId && new Date(message.created_at).getTime() >= new Date(blockedAt).getTime())
        );
        lastVisibleMessages.set(conversation.id, mapLastMessage(visibleLastMessage as Record<string, unknown> | undefined));
      }

      conversations = conversations.map((conversation) => {
        const otherId = conversation.other_participant?.id;
        if (!otherId) return conversation;
        const blockedAt = blockedByMeAt.get(otherId) ?? null;
        const blockedMeAt = blockedByOtherAt.get(otherId) ?? null;
        return {
          ...conversation,
          last_message: blockedAt ? (lastVisibleMessages.get(conversation.id) ?? null) : conversation.last_message,
          unread_count: blockedAt && conversation.last_message?.sender_id === otherId
            ? 0
            : conversation.unread_count,
          is_blocked_by_me: Boolean(blockedAt),
          is_blocked_by_other: Boolean(blockedMeAt),
          blocked_at: blockedAt,
        };
      });
    }
  }

  const { data: hiddenStates, error: hiddenError } = await supabase
    .from('conversation_user_states')
    .select('conversation_id, deleted_at')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null);

  if (!hiddenError && hiddenStates?.length) {
    const deletedAtByConversation = new Map(
      hiddenStates.map((state) => [state.conversation_id, state.deleted_at as string | null]),
    );

    conversations = conversations.filter((conversation) => {
      const deletedAt = deletedAtByConversation.get(conversation.id);
      if (!deletedAt) return true;

      const lastActivityAt = conversation.last_message?.created_at ?? conversation.created_at;
      return new Date(lastActivityAt).getTime() > new Date(deletedAt).getTime();
    });
  }

  const ideaIdsNeedingImages = conversations
    .filter((conversation) => conversation.type === 'idea' && !conversation.image_url && conversation.idea_id)
    .map((conversation) => conversation.idea_id as string);

  if (ideaIdsNeedingImages.length === 0) return conversations;

  const { data: ideas, error: ideasError } = await supabase
    .from('ideas')
    .select('id, image_url')
    .in('id', Array.from(new Set(ideaIdsNeedingImages)));

  if (ideasError) {
    console.error('getUserConversations idea image fallback error:', ideasError);
    return conversations;
  }

  const ideaImages = new Map((ideas ?? []).map((idea) => [idea.id, idea.image_url ?? null]));
  return conversations.map((conversation) =>
    conversation.type === 'idea' && !conversation.image_url && conversation.idea_id
      ? {...conversation, image_url: ideaImages.get(conversation.idea_id) ?? null}
      : conversation,
  );
}

export async function getConversationById(
  conversationId: string,
  userId?: string,
  inboxConversation?: ConversationListItem | null,
): Promise<ConversationDetails | null> {
  const supabase = await createClient();
  let resolvedInboxConversation: ConversationListItem | null = inboxConversation ?? null;

  if (userId && !inboxConversation) {
    const { data: inboxRows, error: inboxError } = await supabase.rpc('get_user_inbox', { p_user_id: userId });
    if (!inboxError) {
      const row = ((inboxRows ?? []) as Record<string, unknown>[]).find((item) => item.id === conversationId);
      if (row) resolvedInboxConversation = mapInboxRow(row);
    } else {
      console.error('getConversationById inbox error:', inboxError);
    }
  }

  const conv = resolvedInboxConversation
    ? {
        id: resolvedInboxConversation.id,
        type: resolvedInboxConversation.type,
        graatek_id: resolvedInboxConversation.graatek_id,
        idea_id: resolvedInboxConversation.idea_id,
        title: resolvedInboxConversation.title,
        image_url: resolvedInboxConversation.image_url,
        image_storage_path: resolvedInboxConversation.image_storage_path,
        archived_at: resolvedInboxConversation.archived_at,
        created_at: resolvedInboxConversation.created_at,
        updated_at: resolvedInboxConversation.updated_at,
      }
    : null;

  const { data: directConv, error: convError } = conv
    ? { data: null, error: null }
    : await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .maybeSingle();

  if (convError) {
    console.error('getConversationById conversation error:', convError);
    return null;
  }
  const conversation = conv ?? directConv;
  if (!conversation) return null;

  const { data: participants, error: participantsError } = await supabase
    .from('conversation_participants')
    .select('*, user:user_id(id, username, full_name, avatar_url)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (participantsError) {
    console.error('getConversationById participants error:', participantsError);
  }

  let ideaTitle: string | null = null;
  let ideaStatus: string | null = null;
  let ideaAuthorId: string | null = null;
  let ideaImageUrl: string | null = null;
  if (resolvedInboxConversation) {
    ideaTitle = resolvedInboxConversation.idea_title;
    ideaStatus = resolvedInboxConversation.idea_status;
  }
  if (conversation.idea_id) {
    const { data: idea } = await supabase
      .from('ideas')
      .select('title, status, author_id, image_url')
      .eq('id', conversation.idea_id)
      .maybeSingle();
    ideaTitle = idea?.title ?? ideaTitle;
    ideaStatus = idea?.status ?? ideaStatus;
    ideaAuthorId = idea?.author_id ?? null;
    ideaImageUrl = idea?.image_url ?? null;
  }

  const activeParticipants = ((participants ?? []) as unknown as RawConversationParticipant[])
    .map((participant) => normalizeParticipant(participant, ideaAuthorId))
    .filter((participant) => !participant.left_at && !participant.removed_at)
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
      return (a.created_at ?? '').localeCompare(b.created_at ?? '');
    });

  if (
    resolvedInboxConversation?.other_participant?.id &&
    !activeParticipants.some((participant) => participant.user_id === resolvedInboxConversation.other_participant?.id)
  ) {
    activeParticipants.push(normalizeParticipant({
      id: '',
      conversation_id: conversationId,
      user_id: resolvedInboxConversation.other_participant.id,
      role: 'member',
      unread_count: 0,
      user: resolvedInboxConversation.other_participant,
    }, ideaAuthorId));
  }

  if (activeParticipants.length === 0 && userId) {
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    activeParticipants.push(normalizeParticipant({
      id: '',
      conversation_id: conversationId,
      user_id: userId,
      role: ideaAuthorId === userId ? 'admin' : 'member',
      unread_count: resolvedInboxConversation?.unread_count ?? 0,
      user: currentProfile ?? null,
    }, ideaAuthorId));

    if (resolvedInboxConversation?.other_participant?.id) {
      activeParticipants.push(normalizeParticipant({
        id: '',
        conversation_id: conversationId,
        user_id: resolvedInboxConversation.other_participant.id,
        role: 'member',
        unread_count: 0,
        user: resolvedInboxConversation.other_participant,
      }, ideaAuthorId));
    } else {
      const otherParticipantIds = participants
        ? ((participants ?? []) as unknown as RawConversationParticipant[]).map((p) => p.user_id).filter((pid) => pid !== userId)
        : [];
      for (const otherId of otherParticipantIds) {
        const { data: otherProfile } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .eq('id', otherId)
          .maybeSingle();
        if (otherProfile) {
          activeParticipants.push(normalizeParticipant({
            id: '',
            conversation_id: conversationId,
            user_id: otherId,
            role: 'member',
            unread_count: 0,
            user: otherProfile,
          }, ideaAuthorId));
        }
      }
    }
  }

  if (userId && !activeParticipants.some((p) => p.user_id === userId)) {
    return null;
  }

  return {
    id: conversation.id,
    type: conversation.type,
    graatek_id: conversation.graatek_id,
    idea_id: conversation.idea_id,
    title: conversation.title,
    image_url: conversation.image_url ?? ideaImageUrl,
    image_storage_path: conversation.image_storage_path ?? null,
    archived_at: conversation.archived_at,
    created_at: conversation.created_at,
    updated_at: conversation.updated_at ?? null,
    idea_title: ideaTitle,
    idea_status: ideaStatus,
    member_count: activeParticipants.length,
    participants: activeParticipants,
  };
}

export async function getConversationMessages(
  conversationId: string,
  limit = 80,
  userId?: string,
): Promise<ConversationMessageWithSender[]> {
  const supabase = await createClient();

  let hiddenBefore: string | null = null;
  let blockedSenderId: string | null = null;
  let blockedSenderSince: string | null = null;
  if (userId) {
    const { data: userState, error: stateError } = await supabase
      .from('conversation_user_states')
      .select('cleared_at, deleted_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!stateError) {
      const clearedAt = userState?.cleared_at ?? null;
      const deletedAt = userState?.deleted_at ?? null;
      if (clearedAt && deletedAt) {
        hiddenBefore = new Date(clearedAt).getTime() > new Date(deletedAt).getTime() ? clearedAt : deletedAt;
      } else {
        hiddenBefore = clearedAt ?? deletedAt;
      }
    }

    const blockState = await getDirectConversationBlockState(conversationId, userId);
    if (blockState.blockedByMe && blockState.otherUserId && blockState.blockedByMeAt) {
      blockedSenderId = blockState.otherUserId;
      blockedSenderSince = blockState.blockedByMeAt;
    }
  }

  let query = supabase
    .from('conversation_messages')
    .select('*, sender:sender_id(id, username, full_name, avatar_url)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (hiddenBefore) {
    query = query.gt('created_at', hiddenBefore);
  }

  if (blockedSenderId && blockedSenderSince) {
    query = query.or(`sender_id.neq.${blockedSenderId},created_at.lt.${blockedSenderSince}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('getConversationMessages error:', error);
    return [];
  }

  return ((data ?? []) as unknown as ConversationMessageWithSender[])
    .reverse()
    .map((message) => ({
      ...message,
      message: message.message ?? null,
      message_type: normalizeMessageType(message.message_type),
      image_url: message.image_url ?? null,
      image_storage_path: message.image_storage_path ?? null,
      image_urls: Array.isArray(message.image_urls) ? message.image_urls : (message.image_url ? [message.image_url] : []),
      image_storage_paths: Array.isArray(message.image_storage_paths) ? message.image_storage_paths : (message.image_storage_path ? [message.image_storage_path] : []),
      is_edited: Boolean(message.is_edited),
      edited_at: message.edited_at ?? null,
      is_deleted: Boolean(message.is_deleted),
      deleted_at: message.deleted_at ?? null,
      deleted_by: message.deleted_by ?? null,
    }));
}

export async function sendConversationMessage(
  conversationId: string,
  senderId: string,
  input: string | {
    message?: string | null;
    messageType?: ConversationMessageType;
    imageUrl?: string | null;
    imageStoragePath?: string | null;
    imageUrls?: string[];
    imageStoragePaths?: string[];
  },
): Promise<{ id: string; created_at: string } | null> {
  const supabase = await createClient();
  const blockState = await getDirectConversationBlockState(conversationId, senderId);
  if (blockState.blockedByMe) {
    console.error('sendConversationMessage sender has blocked recipient');
    return null;
  }
  if (blockState.otherUserId) {
    const mutuallyFollowing = await haveMutualFollow(senderId, blockState.otherUserId);
    if (!mutuallyFollowing) {
      console.error('sendConversationMessage direct conversation requires mutual follow');
      return null;
    }
  }

  const isTextInput = typeof input === 'string';
  const messageType = isTextInput ? 'text' : input.messageType ?? (input.imageUrl ? 'image' : 'text');
  const message = (isTextInput ? input : input.message ?? '').trim();
  const imageUrl = isTextInput ? null : input.imageUrl ?? null;
  const imageStoragePath = isTextInput ? null : input.imageStoragePath ?? null;
  const imageUrls = isTextInput ? [] : input.imageUrls ?? (imageUrl ? [imageUrl] : []);
  const imageStoragePaths = isTextInput ? [] : input.imageStoragePaths ?? (imageStoragePath ? [imageStoragePath] : []);

  if (messageType === 'text' && !message) return null;
  if (messageType === 'image' && imageUrls.length === 0) return null;

  let { data, error } = await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      message: messageType === 'image' && !message ? '' : (message || null),
      message_type: messageType,
      image_url: imageUrls[0] ?? null,
      image_storage_path: imageStoragePaths[0] ?? null,
      image_urls: imageUrls,
      image_storage_paths: imageStoragePaths,
    })
    .select('id, created_at')
    .single();

  if (error) {
    if (isLegacyConversationMessageSchemaError(error)) {
      const fallbackText = messageType === 'image'
        ? (message ? `${message}\n${imageUrl}` : imageUrl)
        : message;
      const fallback = await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          message: fallbackText,
        })
        .select('id, created_at')
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error('sendConversationMessage error:', error);
      return null;
    }
  }

  const { error: rpcError } = await supabase.rpc('increment_conv_unread', {
    p_conv_id: conversationId,
    p_except_user: senderId,
  });
  if (rpcError) console.error('increment unread error:', rpcError);

  return data;
}

export async function editConversationMessage(
  messageId: string,
  userId: string,
  message: string,
): Promise<ConversationMessageWithSender | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc('edit_conversation_message', {
      p_message_id: messageId,
      p_user_id: userId,
      p_message: message,
    })
    .single();

  if (error) {
    console.error('editConversationMessage error:', error);
    return null;
  }

  return data as ConversationMessageWithSender;
}

export async function deleteConversationMessage(
  messageId: string,
  userId: string,
): Promise<ConversationMessageWithSender | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc('delete_conversation_message', {
      p_message_id: messageId,
      p_user_id: userId,
    })
    .single();

  if (error) {
    console.error('deleteConversationMessage error:', error);
    return null;
  }

  return data as ConversationMessageWithSender;
}

export async function reportConversationMessage(
  messageId: string,
  userId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('report_conversation_message', {
    p_message_id: messageId,
    p_user_id: userId,
  });

  if (error) {
    console.error('reportConversationMessage error:', error);
    return false;
  }

  return true;
}

export async function markConversationRead(
  conversationId: string,
  userId: string,
): Promise<string> {
  const supabase = await createClient();
  const readAt = new Date().toISOString();
  const { error } = await supabase.rpc('mark_conversation_read', {
    p_conv_id: conversationId,
    p_user_id: userId,
  });
  if (error) {
    console.error('markConversationRead rpc error:', error);
  }

  const writeClient = createAdminClient() ?? supabase;

  await writeClient
    .from('conversation_participants')
    .update({ last_read_at: readAt, unread_count: 0 })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);

  await writeClient
    .from('conversation_messages')
    .update({ read_at: readAt })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('read_at', null);

  return readAt;
}

export async function getDirectConversationBlockState(
  conversationId: string,
  userId: string,
  conversationDetails?: ConversationDetails | null,
): Promise<ConversationBlockState> {
  const empty: ConversationBlockState = {
    blockedByMe: false,
    blockedByOther: false,
    blockedByMeAt: null,
    blockedByOtherAt: null,
    otherUserId: null,
  };
  const supabase = await createClient();
  const readClient = createAdminClient() ?? supabase;

  let type = conversationDetails?.type ?? null;
  let participantIds = conversationDetails?.participants.map((participant) => participant.user_id) ?? null;

  if (!type) {
    const { data: conversation, error: conversationError } = await readClient
      .from('conversations')
      .select('id, type')
      .eq('id', conversationId)
      .maybeSingle();

    if (conversationError || !conversation) return empty;
    type = conversation.type;
  }

  if (type !== 'direct') return empty;

  if (!participantIds) {
    const { data: participants, error: participantsError } = await readClient
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId);

    if (participantsError) return empty;
    participantIds = (participants ?? []).map((participant) => participant.user_id);
  }

  const otherUserId = participantIds.find((participantId) => participantId !== userId) ?? null;
  if (!otherUserId) return empty;

  const { data: blocks, error: blockError } = await readClient
    .from('blocked_users')
    .select('blocker_id, blocked_id, created_at')
    .or(`and(blocker_id.eq.${userId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${userId})`);

  if (blockError) return { ...empty, otherUserId };
  const blockedByMe = (blocks ?? []).find((block) => block.blocker_id === userId);
  const blockedByOther = (blocks ?? []).find((block) => block.blocked_id === userId);

  return {
    blockedByMe: Boolean(blockedByMe),
    blockedByOther: Boolean(blockedByOther),
    blockedByMeAt: blockedByMe?.created_at ?? null,
    blockedByOtherAt: blockedByOther?.created_at ?? null,
    otherUserId,
  };
}

async function upsertConversationUserState(
  conversationId: string,
  userId: string,
  state: {
    cleared_at?: string | null;
    deleted_at?: string | null;
    muted_until?: string | null;
    mute_forever?: boolean;
  },
): Promise<boolean> {
  const supabase = await createClient();
  const conversation = await getConversationById(conversationId, userId);
  if (!conversation) return false;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('conversation_user_states')
    .upsert({
      conversation_id: conversationId,
      user_id: userId,
      ...state,
      updated_at: now,
    }, { onConflict: 'conversation_id,user_id' });

  if (error) {
    console.error('upsertConversationUserState error:', error);
    return false;
  }

  return true;
}

export async function clearConversationForUser(conversationId: string, userId: string): Promise<boolean> {
  return upsertConversationUserState(conversationId, userId, {
    cleared_at: new Date().toISOString(),
    deleted_at: null,
  });
}

export async function deleteConversationForUser(conversationId: string, userId: string): Promise<boolean> {
  return upsertConversationUserState(conversationId, userId, {
    deleted_at: new Date().toISOString(),
  });
}

export async function muteConversationForUser(
  conversationId: string,
  userId: string,
  option: '1h' | '8h' | '1w' | 'forever',
): Promise<boolean> {
  const now = Date.now();
  const mutedUntil =
    option === '1h' ? new Date(now + 60 * 60 * 1000).toISOString() :
    option === '8h' ? new Date(now + 8 * 60 * 60 * 1000).toISOString() :
    option === '1w' ? new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString() :
    null;

  return upsertConversationUserState(conversationId, userId, {
    muted_until: mutedUntil,
    mute_forever: option === 'forever',
  });
}

export async function blockDirectConversationUser(conversationId: string, userId: string): Promise<boolean> {
  const blockState = await getDirectConversationBlockState(conversationId, userId);
  if (!blockState.otherUserId) return false;

  const supabase = await createClient();
  const writeClient = createAdminClient() ?? supabase;
  const { error } = await writeClient
    .from('blocked_users')
    .upsert({ blocker_id: userId, blocked_id: blockState.otherUserId }, { onConflict: 'blocker_id,blocked_id' });

  if (error) {
    console.error('blockDirectConversationUser error:', error);
    return false;
  }

  return true;
}

export async function unblockDirectConversationUser(conversationId: string, userId: string): Promise<boolean> {
  const blockState = await getDirectConversationBlockState(conversationId, userId);
  if (!blockState.otherUserId) return false;

  const supabase = await createClient();
  const writeClient = createAdminClient() ?? supabase;
  const { error } = await writeClient
    .from('blocked_users')
    .delete()
    .eq('blocker_id', userId)
    .eq('blocked_id', blockState.otherUserId);

  if (error) {
    console.error('unblockDirectConversationUser error:', error);
    return false;
  }

  return true;
}

export async function reportConversationUser(
  conversationId: string,
  reporterId: string,
  reason: string,
): Promise<boolean> {
  const conversation = await getConversationById(conversationId, reporterId);
  if (!conversation) return false;
  const reported = conversation.participants.find((participant) => participant.user_id !== reporterId);

  const supabase = await createClient();
  const { error } = await supabase
    .from('conversation_user_reports')
    .upsert({
      conversation_id: conversationId,
      reporter_id: reporterId,
      reported_user_id: reported?.user_id ?? null,
      reason: reason.trim() || 'other',
      status: 'pending',
    }, { onConflict: 'conversation_id,reporter_id,reported_user_id' });

  if (error) {
    console.error('reportConversationUser error:', error);
    return false;
  }

  return true;
}

export async function searchUserConversations(
  userId: string,
  query: string,
): Promise<ConversationListItem[]> {
  const conversations = await getUserConversations(userId);
  const q = query.trim().toLowerCase();
  if (!q) return conversations;

  return conversations.filter((conversation) => {
    const otherName = (
      conversation.other_participant?.full_name ??
      conversation.other_participant?.username ??
      ''
    ).toLowerCase();
    const title = conversation.title.toLowerCase();
    const ideaTitle = (conversation.idea_title ?? '').toLowerCase();
    return otherName.includes(q) || title.includes(q) || ideaTitle.includes(q);
  });
}

export async function getUnreadConversationsCount(userId: string): Promise<number> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('conversation_participants')
    .select('unread_count')
    .eq('user_id', userId);

  if (!data) return 0;
  return data.reduce((sum, p) => sum + (p.unread_count ?? 0), 0);
}

export async function createOrGetDirectConversation(userId1: string, userId2: string): Promise<string | null> {
  const mutuallyFollowing = await haveMutualFollow(userId1, userId2);
  if (!mutuallyFollowing) {
    console.error('createOrGetDirectConversation requires mutual follow');
    return null;
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('ensure_direct_conversation', {
    p_user1_id: userId1,
    p_user2_id: userId2,
  });

  if (error) {
    console.error('createOrGetDirectConversation error:', error);
    return null;
  }

  return data as string | null;
}

export async function ensureConversationExists(type: 'graatek' | 'idea', entityId: string): Promise<string | null> {
  const supabase = await createClient();

  if (type === 'graatek') {
    const { data, error } = await supabase.rpc('ensure_graatek_conversation', { p_share_id: entityId });
    if (error) {
      console.error('ensureConversationExists graatek error:', error);
      return null;
    }
    return data as string | null;
  }

  const { data, error } = await supabase.rpc('ensure_idea_conversation', { p_idea_id: entityId });
  if (error) {
    console.error('ensureConversationExists idea error:', error);
    return null;
  }
  return data as string | null;
}

export async function updateIdeaGroupProfile(
  conversationId: string,
  actorId: string,
  input: { title?: string | null; imageUrl?: string | null; imageStoragePath?: string | null },
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_idea_group_profile', {
    p_conv_id: conversationId,
    p_actor_id: actorId,
    p_title: input.title ?? null,
    p_image_url: input.imageUrl ?? null,
    p_image_storage_path: input.imageStoragePath ?? null,
  });

  if (!error) {
    if (input.imageUrl) {
      await persistIdeaGroupImageFallbackByConversation(conversationId, input.imageUrl);
    }

    return true;
  }

  console.error('updateIdeaGroupProfile rpc error:', error);
  return updateIdeaGroupProfileDirect(conversationId, actorId, input);
}

async function updateIdeaGroupProfileDirect(
  conversationId: string,
  actorId: string,
  input: { title?: string | null; imageUrl?: string | null; imageStoragePath?: string | null },
): Promise<boolean> {
  const userClient = await createClient();
  const writeClient = createAdminClient() ?? userClient;
  const adminState = await getIdeaGroupAdminStateDirect(writeClient, conversationId, actorId);

  if (!adminState.isAdmin) {
    console.error('updateIdeaGroupProfile direct error: actor is not an idea group admin');
    return false;
  }

  const basePayload: Record<string, string> = {};

  if (input.title) basePayload.title = input.title;
  if (input.imageUrl) basePayload.image_url = input.imageUrl;
  if (input.imageStoragePath) basePayload.image_storage_path = input.imageStoragePath;

  const payloads: Record<string, string>[] = [
    {...basePayload, updated_at: new Date().toISOString()},
    basePayload,
    withoutKey(basePayload, 'image_storage_path'),
    withoutKey(withoutKey(basePayload, 'image_storage_path'), 'image_url'),
  ].filter((payload, index, list) => Object.keys(payload).length > 0 && list.findIndex((item) => shallowEqual(item, payload)) === index);

  for (const payload of payloads) {
    const { error } = await writeClient
      .from('conversations')
      .update(payload)
      .eq('id', conversationId)
      .eq('type', 'idea');

    if (!error) {
      if (input.imageUrl && adminState.ideaId) {
        await persistIdeaGroupImageFallback(writeClient, adminState.ideaId, input.imageUrl);
      }

      return true;
    }

    const message = error.message?.toLowerCase() ?? '';
    const canRetry =
      error.code === 'PGRST204' ||
      message.includes('schema cache') ||
      message.includes('image_storage_path') ||
      message.includes('image_url') ||
      message.includes('updated_at');

    if (!canRetry) {
      console.error('updateIdeaGroupProfile direct error:', error);
      return false;
    }
  }

  console.error('updateIdeaGroupProfile direct error: no compatible conversation profile columns');
  return false;
}

async function getIdeaGroupAdminStateDirect(
  client: Awaited<ReturnType<typeof createClient>>,
  conversationId: string,
  actorId: string,
) {
  const { data: conversation, error: conversationError } = await client
    .from('conversations')
    .select('id, type, idea_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (conversationError || !conversation || conversation.type !== 'idea') {
    return {isAdmin: false, ideaId: null};
  }

  const ideaId = typeof conversation.idea_id === 'string' ? conversation.idea_id : null;

  if (ideaId) {
    const { data: idea } = await client
      .from('ideas')
      .select('author_id')
      .eq('id', ideaId)
      .maybeSingle();

    if (idea?.author_id === actorId) return {isAdmin: true, ideaId};
  }

  const { data: participant } = await client
    .from('conversation_participants')
    .select('role, left_at, removed_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', actorId)
    .maybeSingle();

  return {
    isAdmin: participant?.role === 'admin' && !participant.left_at && !participant.removed_at,
    ideaId,
  };
}

async function persistIdeaGroupImageFallback(
  client: Awaited<ReturnType<typeof createClient>>,
  ideaId: string,
  imageUrl: string,
) {
  const { error } = await client
    .from('ideas')
    .update({image_url: imageUrl})
    .eq('id', ideaId);

  if (error) {
    console.error('persistIdeaGroupImageFallback error:', error);
  }
}

async function persistIdeaGroupImageFallbackByConversation(conversationId: string, imageUrl: string) {
  const userClient = await createClient();
  const client = createAdminClient() ?? userClient;
  const { data: conversation, error } = await client
    .from('conversations')
    .select('idea_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (error || !conversation?.idea_id) {
    if (error) console.error('persistIdeaGroupImageFallbackByConversation error:', error);
    return;
  }

  await persistIdeaGroupImageFallback(client, conversation.idea_id, imageUrl);
}

function withoutKey(source: Record<string, string>, key: string) {
  return Object.fromEntries(Object.entries(source).filter(([sourceKey]) => sourceKey !== key));
}

function shallowEqual(a: Record<string, string>, b: Record<string, string>) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((key) => a[key] === b[key]);
}

export async function removeIdeaGroupMember(
  conversationId: string,
  actorId: string,
  userId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_idea_group_member', {
    p_conv_id: conversationId,
    p_actor_id: actorId,
    p_user_id: userId,
  });

  if (error) {
    console.error('removeIdeaGroupMember error:', error);
    return false;
  }
  return true;
}

export async function leaveIdeaGroup(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('leave_idea_group', {
    p_conv_id: conversationId,
    p_user_id: userId,
  });

  if (error) {
    console.error('leaveIdeaGroup error:', error);
    return false;
  }
  return true;
}
