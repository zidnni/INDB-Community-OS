import { createClient } from '@/lib/supabase/server';

export interface ConversationParticipantInfo {
  id: string;
  user_id: string;
  last_read_at: string | null;
  unread_count: number;
  user: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface ConversationMessageWithSender {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  read_at: string | null;
  sender: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface ConversationListItem {
  id: string;
  type: string;
  graatek_id: string | null;
  idea_id: string | null;
  title: string;
  archived_at: string | null;
  created_at: string;
  last_message: { message: string; created_at: string; sender_id: string } | null;
  unread_count: number;
  other_participant: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export async function getUserConversations(userId: string): Promise<ConversationListItem[]> {
  const supabase = await createClient();

  const { data } = await supabase.rpc('get_user_inbox', { p_user_id: userId });

  if (!data) return [];

  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    type: row.type as string,
    graatek_id: row.graatek_id as string | null,
    idea_id: row.idea_id as string | null,
    title: row.title as string,
    archived_at: row.archived_at as string | null,
    created_at: row.created_at as string,
    last_message: row.last_message_text
      ? {
          message: row.last_message_text as string,
          created_at: row.last_message_at as string,
          sender_id: row.last_message_sender_id as string,
        }
      : null,
    unread_count: (row.unread_count as number) ?? 0,
    other_participant: row.other_user_id
      ? {
          id: row.other_user_id as string,
          username: row.other_username as string | null,
          full_name: row.other_full_name as string | null,
          avatar_url: row.other_avatar_url as string | null,
        }
      : null,
  }));
}

export async function getConversationById(conversationId: string, userId?: string): Promise<{
  id: string;
  type: string;
  graatek_id: string | null;
  idea_id: string | null;
  title: string;
  archived_at: string | null;
  participants: ConversationParticipantInfo[];
} | null> {
  const supabase = await createClient();

  if (userId) {
    const { data: rows } = await supabase.rpc('get_user_inbox', { p_user_id: userId });
    if (!rows) return null;
    const row = (rows as Record<string, unknown>[]).find((r) => r.id as string === conversationId);
    if (!row) return null;

    const participants: ConversationParticipantInfo[] = [];
    // Add current user as participant
    participants.push({
      id: '',
      user_id: userId,
      last_read_at: null,
      unread_count: (row.unread_count as number) ?? 0,
      user: null,
    });
    // Add other participant from RPC result
    if (row.other_user_id) {
      participants.push({
        id: '',
        user_id: row.other_user_id as string,
        last_read_at: null,
        unread_count: 0,
        user: row.other_user_id
          ? {
              id: row.other_user_id as string,
              username: row.other_username as string | null,
              full_name: row.other_full_name as string | null,
              avatar_url: row.other_avatar_url as string | null,
            }
          : null,
      });
    }

    return {
      id: row.id as string,
      type: row.type as string,
      graatek_id: row.graatek_id as string | null,
      idea_id: row.idea_id as string | null,
      title: row.title as string,
      archived_at: row.archived_at as string | null,
      participants,
    };
  }

  // Fallback without userId: use direct queries with RLS
  const { data: conv } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();

  if (!conv) return null;

  const { data: participants } = await supabase
    .from('conversation_participants')
    .select('*, user:user_id(id, username, full_name, avatar_url)')
    .eq('conversation_id', conversationId);

  return {
    id: conv.id,
    type: conv.type,
    graatek_id: conv.graatek_id,
    idea_id: conv.idea_id,
    title: conv.title,
    archived_at: conv.archived_at,
    participants: (participants ?? []) as unknown as ConversationParticipantInfo[],
  };
}

export async function getConversationMessages(
  conversationId: string,
): Promise<ConversationMessageWithSender[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('conversation_messages')
    .select('*, sender:sender_id(id, username, full_name, avatar_url)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  return (data ?? []) as unknown as ConversationMessageWithSender[];
}

export async function sendConversationMessage(
  conversationId: string,
  senderId: string,
  message: string,
): Promise<{ id: string; created_at: string } | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('conversation_messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, message })
    .select('id, created_at')
    .single();

  if (error) {
    console.error('sendConversationMessage error:', error);
    return null;
  }

  const { error: rpcError } = await supabase.rpc('increment_conv_unread', {
    p_conv_id: conversationId,
    p_except_user: senderId,
  });
  if (rpcError) console.error('increment unread error:', rpcError);

  return data;
}

export async function markConversationRead(
  conversationId: string,
  userId: string,
): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString(), unread_count: 0 })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
}

export async function searchUserConversations(
  userId: string,
  query: string,
): Promise<ConversationListItem[]> {
  const supabase = await createClient();

  const { data } = await supabase.rpc('get_user_inbox', { p_user_id: userId });

  if (!data) return [];

  const q = query.toLowerCase();

  return data
    .filter((row: Record<string, unknown>) => {
      const name = ((row.other_full_name as string) ?? (row.other_username as string) ?? '').toLowerCase();
      const title = (row.title as string ?? '').toLowerCase();
      return name.includes(q) || title.includes(q);
    })
    .map((row: Record<string, unknown>) => ({
      id: row.id as string,
      type: row.type as string,
      graatek_id: row.graatek_id as string | null,
      idea_id: row.idea_id as string | null,
      title: row.title as string,
      archived_at: row.archived_at as string | null,
      created_at: row.created_at as string,
      last_message: row.last_message_text
        ? {
            message: row.last_message_text as string,
            created_at: row.last_message_at as string,
            sender_id: row.last_message_sender_id as string,
          }
        : null,
      unread_count: (row.unread_count as number) ?? 0,
      other_participant: row.other_user_id
        ? {
            id: row.other_user_id as string,
            username: row.other_username as string | null,
            full_name: row.other_full_name as string | null,
            avatar_url: row.other_avatar_url as string | null,
          }
        : null,
    }));
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

export async function ensureConversationExists(type: 'graatek' | 'idea', entityId: string): Promise<string | null> {
  const supabase = await createClient();

  if (type === 'graatek') {
    const { data } = await supabase.rpc('ensure_graatek_conversation', { p_share_id: entityId });
    return data as string | null;
  }

  const { data } = await supabase.rpc('ensure_idea_conversation', { p_idea_id: entityId });
  return data as string | null;
}
