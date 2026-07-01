'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { routing } from '@/lib/i18n/routing';
import { withLocale } from '@/lib/i18n/paths';
import { checkRateLimit, type RateLimitKind } from '@/lib/security/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { assertFeatureEnabledForMutation } from '@/core/features/server';
import { publishPlatformEvent } from '@/core/events/platform-events';
import {
  createFollowNotification,
  createNotification,
  createIdeaCommentNotification,
  createIdeaSupportNotification,
  createIdeaParticipateRequestNotification,
  createIdeaParticipantAcceptedNotification,
  createIdeaParticipantDeclinedNotification,
  createIdeaMessageNotification,
  createIdeaStatusChangeNotification,
} from '@/lib/data/notifications';
import { getIdeaVoteDetails, getIdeaById, isUserAcceptedParticipant, getIdeaUserParticipation, getIdeaUserSupport, getIdeaAcceptedParticipants, getIdeaParticipants } from '@/lib/data/ideas';
import { deleteIdeaMedia, deleteIdeaMediaByStoragePaths, insertIdeaMedia } from '@/lib/data/media';
import { ideaSchema, commentSchema } from '@/lib/validations/community';
import type { IdeaStatus, IdeaMessageWithSender, IdeaCommentWithAuthor } from '@/types/database';

function normalizeLocale(value: FormDataEntryValue | null) {
  const locale = typeof value === 'string' ? value : routing.defaultLocale;
  return routing.locales.includes(locale as (typeof routing.locales)[number])
    ? locale
    : routing.defaultLocale;
}

function toPath(locale: string, pathname: string) {
  return withLocale(pathname, locale);
}

async function guardFeatureAction(featureId: Parameters<typeof assertFeatureEnabledForMutation>[0]) {
  try {
    await assertFeatureEnabledForMutation(featureId);
    return null;
  } catch {
    return 'module_disabled';
  }
}

async function isUserRateLimited(kind: RateLimitKind, userId: string) {
  const result = await checkRateLimit(kind, userId);
  return !result.allowed;
}

function getValidationError(
  result: { success: boolean; error?: unknown },
  t: (key: string) => string,
  fallback: string,
): string {
  if (result.success) return '';

  const zodError = result.error as
    | { issues?: Array<{ path: Array<string | number>; message: string; code: string }> }
    | undefined;
  const issue = zodError?.issues?.[0];
  if (!issue) return t(fallback);

  const field = issue.path[0];
  if (issue.code === 'too_small') {
    if (field === 'title') return t('titleRequired');
    if (field === 'description') return t('descriptionRequired');
  }

  return t(fallback);
}

export async function getIdeaVoteDetailsAction(ideaId: string, limit = 50, offset = 0) {
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { totalCount: 0, voters: [] };
  return getIdeaVoteDetails(ideaId, limit, offset);
}

export async function submitIdeaAction(
  formData: FormData,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const errorsT = await getTranslations({ locale, namespace: 'Errors' });
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: errorsT('submitFailed') };
  }

  const rawCategoryId = formData.get('categoryId');
  const parsed = ideaSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    categoryId: rawCategoryId === '' || rawCategoryId === 'other' ? undefined : rawCategoryId,
  });

  if (!parsed.success) {
    const errorMsg = getValidationError(parsed, errorsT, 'invalidIdea');
    return { success: false, error: errorMsg };
  }

  const mediaDataStr = formData.get('mediaData');
  const uploadedMedia: Array<{
    url: string;
    storagePath: string;
    type: 'image' | 'video';
    mime_type?: string;
  }> = typeof mediaDataStr === 'string' && mediaDataStr ? JSON.parse(mediaDataStr) : [];

  let image_url: string | null = null;
  const firstImage = uploadedMedia.find((m) => m.type === 'image');
  if (firstImage) {
    image_url = firstImage.url;
  }

  const { data: newIdea, error: insertError } = await supabase
    .from('ideas')
    .insert({
      author_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      category_id: parsed.data.categoryId ?? null,
      status: 'published',
      image_url,
    })
    .select('id')
    .single();

  if (insertError || !newIdea) {
    return { success: false, error: errorsT('submitFailed') };
  }

  if (uploadedMedia.length > 0) {
    await insertIdeaMedia(
      uploadedMedia.map((m, i) => ({
        idea_id: newIdea.id,
        url: m.url,
        type: m.type,
        mime_type: m.mime_type ?? '',
        storage_path: m.storagePath,
        position: i,
      })),
    );
  }

  try {
    const { ensureConversationExists } = await import('@/lib/data/conversations');
    await ensureConversationExists('idea', newIdea.id);
  } catch (e) {
    console.error('submitIdeaAction conversation create error:', e);
  }

  await publishPlatformEvent({
    name: 'idea.created',
    actorId: user.id,
    entityType: 'idea',
    entityId: newIdea.id,
  });

  revalidatePath(toPath(locale, '/ideas'));

  return { success: true, id: newIdea.id };
}

export async function updateIdeaAction(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const errorsT = await getTranslations({ locale, namespace: 'Errors' });
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: errorsT('submitFailed') };
  }

  const ideaId = formData.get('ideaId');
  if (typeof ideaId !== 'string') {
    return { success: false, error: errorsT('invalidIdea') };
  }

  const { data: existing } = await supabase
    .from('ideas')
    .select('author_id, image_url')
    .eq('id', ideaId)
    .single();

  if (!existing || existing.author_id !== user.id) {
    return { success: false, error: errorsT('submitFailed') };
  }

  const rawCategoryId = formData.get('categoryId');
  const parsed = ideaSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    categoryId: rawCategoryId === '' || rawCategoryId === 'other' ? undefined : rawCategoryId,
  });

  if (!parsed.success) {
    const errorMsg = getValidationError(parsed, errorsT, 'invalidIdea');
    return { success: false, error: errorMsg };
  }

  const removedMediaStr = formData.get('removedMedia');
  let removedStoragePaths: string[] = [];
  if (typeof removedMediaStr === 'string' && removedMediaStr) {
    try {
      removedStoragePaths = JSON.parse(removedMediaStr);
    } catch {}
  }
  if (removedStoragePaths.length > 0) {
    await deleteIdeaMediaByStoragePaths(removedStoragePaths);
  }

  const mediaDataStr = formData.get('mediaData');
  const uploadedMedia: Array<{
    url: string;
    storagePath: string;
    type: 'image' | 'video';
    mime_type?: string;
  }> = typeof mediaDataStr === 'string' && mediaDataStr ? JSON.parse(mediaDataStr) : [];

  const { data: existingMedia } = await supabase
    .from('idea_media')
    .select('position')
    .eq('idea_id', ideaId)
    .order('position', { ascending: false })
    .limit(1);

  let nextPosition = (existingMedia?.[0]?.position ?? -1) + 1;
  if (uploadedMedia.length > 0) {
    await insertIdeaMedia(
      uploadedMedia.map((m) => ({
        idea_id: ideaId,
        url: m.url,
        type: m.type,
        mime_type: m.mime_type ?? '',
        storage_path: m.storagePath,
        position: nextPosition++,
      })),
    );
  }

  const { data: allMedia } = await supabase
    .from('idea_media')
    .select('url, type')
    .eq('idea_id', ideaId)
    .order('position', { ascending: true });
  let image_url = existing.image_url;
  const firstImage = allMedia?.find((m) => m.type === 'image');
  if (firstImage) {
    image_url = firstImage.url;
  } else if (removedStoragePaths.length > 0 && !allMedia?.length) {
    image_url = null;
  }

  const { error: updateError } = await supabase
    .from('ideas')
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      category_id: parsed.data.categoryId ?? null,
      image_url,
    })
    .eq('id', ideaId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath(toPath(locale, '/ideas'));

  return { success: true };
}

export async function deleteIdeaAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'unauthorized' };

  const ideaId = formData.get('ideaId');

  if (typeof ideaId !== 'string') return { success: false, error: 'invalid_id' };

  const { data: idea } = await supabase.from('ideas').select('author_id').eq('id', ideaId).single();

  if (!idea) return { success: false, error: 'not_found' };
  if (idea.author_id !== user.id) return { success: false, error: 'forbidden' };

  await supabase.from('notifications').delete().eq('entity_type', 'idea').eq('entity_id', ideaId);

  await deleteIdeaMedia(ideaId);
  await supabase.from('ideas').delete().eq('id', ideaId);

  revalidatePath('/', 'layout');

  return { success: true };
}

export async function shareIdeaAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; sharesCount?: number }> {
  const ideaId = formData.get('ideaId');
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (typeof ideaId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const { data: idea } = await supabase.from('ideas').select('author_id').eq('id', ideaId).single();

  if (!idea) {
    return { success: false, error: 'not_found' };
  }

  const { data: sharesCount, error: shareCountError } = await supabase.rpc(
    'increment_share_count',
    {
      p_entity_type: 'idea',
      p_entity_id: ideaId,
    },
  );

  if (shareCountError || typeof sharesCount !== 'number') {
    console.error('shareIdeaAction increment_share_count error:', shareCountError);
    return { success: false, error: 'share_count_failed' };
  }

  if (idea.author_id && idea.author_id !== user.id) {
    await supabase.from('notifications').insert({
      user_id: idea.author_id,
      actor_id: user.id,
      type: 'share',
      entity_type: 'idea',
      entity_id: ideaId,
      title: 'Shared your idea',
      message: null,
    });
  }

  return { success: true, sharesCount };
}

export async function addIdeaCommentAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; comment?: IdeaCommentWithAuthor }> {
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const ideaId = formData.get('ideaId');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (await isUserRateLimited('comment', user.id)) {
    return { success: false, error: 'rate_limited' };
  }

  const parsed = commentSchema.safeParse({
    content: formData.get('content'),
  });

  if (!parsed.success || typeof ideaId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const { data: idea, error: ideaError } = await supabase
    .from('ideas')
    .select('author_id')
    .eq('id', ideaId)
    .single();

  if (ideaError || !idea) {
    return { success: false, error: 'not_found' };
  }

  const { data: newComment, error: insertError } = await supabase
    .from('idea_comments')
    .insert({
      idea_id: ideaId,
      author_id: user.id,
      content: parsed.data.content,
    })
    .select('*, author:profiles!idea_comments_author_id_fkey(id, username, full_name, avatar_url)')
    .single();

  if (insertError || !newComment) {
    return { success: false, error: 'insert_failed' };
  }

  if (idea.author_id !== user.id) {
    await createIdeaCommentNotification(idea.author_id, user.id, ideaId, newComment.id);
  }

  return { success: true, comment: newComment as unknown as IdeaCommentWithAuthor };
}

export async function deleteIdeaCommentAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const commentId = formData.get('commentId');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (typeof commentId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const { data: comment } = await supabase
    .from('idea_comments')
    .select('author_id, idea_id')
    .eq('id', commentId)
    .single();

  if (!comment) {
    return { success: false, error: 'not_found' };
  }

  const { data: idea } = await supabase
    .from('ideas')
    .select('author_id')
    .eq('id', comment.idea_id)
    .single();

  if (comment.author_id !== user.id && idea?.author_id !== user.id) {
    return { success: false, error: 'forbidden' };
  }

  const { error: deleteError } = await supabase.from('idea_comments').delete().eq('id', commentId);

  if (deleteError) {
    return { success: false, error: 'delete_failed' };
  }

  return { success: true };
}

export async function updateIdeaCommentAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string; comment?: IdeaCommentWithAuthor }> {
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const commentId = formData.get('commentId');
  const parsed = commentSchema.safeParse({ content: formData.get('content') });
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (typeof commentId !== 'string' || !parsed.success) {
    return { success: false, error: 'invalid' };
  }

  const { data: comment } = await supabase
    .from('idea_comments')
    .select('author_id')
    .eq('id', commentId)
    .single();

  if (!comment || comment.author_id !== user.id) {
    return { success: false, error: 'forbidden' };
  }

  const { data: updatedComment, error: updateError } = await supabase
    .from('idea_comments')
    .update({ content: parsed.data.content, updated_at: new Date().toISOString() })
    .eq('id', commentId)
    .select('*, author:profiles!idea_comments_author_id_fkey(id, username, full_name, avatar_url)')
    .single();

  if (updateError || !updatedComment) {
    return { success: false, error: 'update_failed' };
  }

  return { success: true, comment: updatedComment as unknown as IdeaCommentWithAuthor };
}

export async function voteIdeaAction(
  formData: FormData,
): Promise<{ success: boolean; voted?: boolean; votes?: number; error?: string }> {
  const ideaId = formData.get('ideaId');
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (await isUserRateLimited('reaction', user.id)) {
    return { success: false, error: 'rate_limited' };
  }

  if (typeof ideaId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const { data: existing } = await supabase
    .from('idea_votes')
    .select('id')
    .eq('idea_id', ideaId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('idea_votes').delete().eq('id', existing.id);
  } else {
    await supabase.from('idea_votes').insert({
      idea_id: ideaId,
      user_id: user.id,
    });
  }

  const { count } = await supabase
    .from('idea_votes')
    .select('*', { count: 'exact', head: true })
    .eq('idea_id', ideaId);

  await supabase
    .from('ideas')
    .update({ votes_count: count ?? 0 })
    .eq('id', ideaId);

  if (!existing) {
    await publishPlatformEvent({
      name: 'idea.voted',
      actorId: user.id,
      entityType: 'idea',
      entityId: ideaId,
      metadata: { votes: count ?? 0 },
    });
  }

  return {
    success: true,
    voted: !existing,
    votes: count ?? 0,
  };
}

export async function getUserVoteAction(
  ideaId: string,
): Promise<{ success: boolean; voted?: boolean; error?: string }> {
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };
  const { data: existing } = await supabase
    .from('idea_votes')
    .select('id')
    .eq('idea_id', ideaId)
    .eq('user_id', user.id)
    .maybeSingle();
  return { success: true, voted: !!existing };
}

export async function supportIdeaAction(
  formData: FormData,
): Promise<{ success: boolean; supported?: boolean; supportersCount?: number; error?: string }> {
  const ideaId = formData.get('ideaId');
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (await isUserRateLimited('reaction', user.id)) {
    return { success: false, error: 'rate_limited' };
  }

  if (typeof ideaId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const { data: existing } = await supabase
    .from('idea_supporters')
    .select('id')
    .eq('idea_id', ideaId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('idea_supporters').delete().eq('id', existing.id);
  } else {
    await supabase.from('idea_supporters').insert({
      idea_id: ideaId,
      user_id: user.id,
    });
  }

  const { count } = await supabase
    .from('idea_supporters')
    .select('*', { count: 'exact', head: true })
    .eq('idea_id', ideaId);

  await supabase
    .from('ideas')
    .update({ supporters_count: count ?? 0 })
    .eq('id', ideaId);

  if (!existing) {
    const idea = await getIdeaById(ideaId);
    if (idea?.author_id) {
      await createIdeaSupportNotification(idea.author_id, user.id, ideaId);
    }
  }

  return {
    success: true,
    supported: !existing,
    supportersCount: count ?? 0,
  };
}

export async function requestParticipateAction(
  formData: FormData,
): Promise<{ success: boolean; participantId?: string; status?: string; error?: string }> {
  const ideaId = formData.get('ideaId');
  const message = formData.get('message');
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (await isUserRateLimited('comment', user.id)) {
    return { success: false, error: 'rate_limited' };
  }

  if (typeof ideaId !== 'string') {
    return { success: false, error: 'invalid' };
  }

  const existing = await getIdeaUserParticipation(ideaId, user.id);
  if (existing) {
    return { success: false, error: 'already_requested' };
  }

  const idea = await getIdeaById(ideaId);
  if (!idea) {
    return { success: false, error: 'not_found' };
  }

  const { data: participant, error } = await supabase.from('idea_participants').insert({
    idea_id: ideaId,
    user_id: user.id,
    status: 'pending',
    message: typeof message === 'string' && message.length > 0 ? message.slice(0, 500) : null,
  }).select('id, status').single();

  if (error) {
    return { success: false, error: error.message };
  }

  if (idea.author_id) {
    await createIdeaParticipateRequestNotification(idea.author_id, user.id, ideaId);
  }

  await supabase
    .from('ideas')
    .update({ participants_count: (await getIdeaAcceptedParticipants(ideaId)).length })
    .eq('id', ideaId);

  return { success: true, participantId: participant?.id, status: participant?.status ?? 'pending' };
}

export async function respondToParticipantAction(
  formData: FormData,
): Promise<{ success: boolean; status?: string; participantsCount?: number; conversationId?: string; error?: string }> {
  const participantId = formData.get('participantId');
  const action = formData.get('action'); // "accept" or "decline"
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (typeof participantId !== 'string' || (action !== 'accept' && action !== 'decline')) {
    return { success: false, error: 'invalid' };
  }

  const { data: participant } = await supabase
    .from('idea_participants')
    .select('*, idea:ideas(author_id)')
    .eq('id', participantId)
    .single();

  if (!participant) {
    return { success: false, error: 'not_found' };
  }

  const ideaData = participant.idea as { author_id: string } | null;
  if (!ideaData || ideaData.author_id !== user.id) {
    return { success: false, error: 'unauthorized' };
  }

  const status = action === 'accept' ? 'accepted' : 'declined';
  const { error } = await supabase
    .from('idea_participants')
    .update({ status })
    .eq('id', participantId);

  if (error) {
    return { success: false, error: error.message };
  }

  let conversationId = '';

  if (action === 'accept') {
    try {
      const { ensureConversationExists } = await import('@/lib/data/conversations');
      const convId = await ensureConversationExists('idea', participant.idea_id);
      if (convId) {
        conversationId = convId;
        const sb = await createClient();
        await sb.rpc('add_conversation_participant', { p_conv_id: convId, p_user_id: participant.user_id });
      }
    } catch (e) {
      console.error('respondToParticipantAction conv add error:', e);
    }
    await createIdeaParticipantAcceptedNotification(participant.user_id, user.id, participant.idea_id, conversationId || undefined);
  } else {
    await createIdeaParticipantDeclinedNotification(participant.user_id, user.id, participant.idea_id);
  }

  const acceptedCount = (await getIdeaAcceptedParticipants(participant.idea_id)).length;
  await supabase
    .from('ideas')
    .update({ participants_count: acceptedCount })
    .eq('id', participant.idea_id);

  return { success: true, status, participantsCount: acceptedCount, conversationId: conversationId || undefined };
}

export async function updateIdeaStatusAction(
  formData: FormData,
): Promise<{ success: boolean; status?: IdeaStatus; error?: string }> {
  const ideaId = formData.get('ideaId');
  const newStatus = formData.get('status');
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const supabase = await createClient();

  const validStatuses = ['published', 'interested', 'discussion', 'in_progress', 'completed', 'archived'];
  if (typeof ideaId !== 'string' || typeof newStatus !== 'string' || !validStatuses.includes(newStatus)) {
    return { success: false, error: 'invalid' };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  const idea = await getIdeaById(ideaId);
  if (!idea) {
    return { success: false, error: 'not_found' };
  }

  if (idea.author_id !== user.id) {
    return { success: false, error: 'unauthorized' };
  }

  const { error } = await supabase
    .from('ideas')
    .update({ status: newStatus as IdeaStatus })
    .eq('id', ideaId);

  if (error) {
    return { success: false, error: error.message };
  }

  let ideaConversationId: string | null = null;
  try {
    const { ensureConversationExists } = await import('@/lib/data/conversations');
    ideaConversationId = await ensureConversationExists('idea', ideaId);
  } catch (e) {
    console.error('updateIdeaStatusAction conversation ensure error:', e);
  }

  const acceptedParticipants = await getIdeaAcceptedParticipants(ideaId);
  const participantIds = acceptedParticipants
    .map((p) => p.user?.id)
    .filter((id): id is string => !!id && id !== user.id);

  if (participantIds.length > 0) {
    await createIdeaStatusChangeNotification(ideaId, user.id, participantIds, newStatus);
  }

  if (newStatus === 'completed') {
    for (const participantId of participantIds) {
      await createNotification({
        userId: participantId,
        actorId: user.id,
        type: 'idea_completed',
        entityType: 'idea',
        entityId: ideaId,
        title: 'Idea completed',
        metadata: ideaConversationId ? { conversationId: ideaConversationId } : undefined,
      });
    }
  }

  if (newStatus === 'completed' || newStatus === 'archived') {
    try {
      const archivedIds = new Set<string>();
      if (ideaConversationId) {
        await supabase.rpc('archive_conversation', { p_conv_id: ideaConversationId });
        archivedIds.add(ideaConversationId);
      }
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('idea_id', ideaId)
        .in('type', ['idea', 'idea_project_room']);
      for (const conv of conversations ?? []) {
        if (archivedIds.has(conv.id)) continue;
        await supabase.rpc('archive_conversation', { p_conv_id: conv.id });
      }
    } catch (e) {
      console.error('updateIdeaStatusAction archive error:', e);
    }
  }

  if (newStatus === 'completed') {
    await publishPlatformEvent({
      name: 'idea.completed',
      actorId: user.id,
      entityType: 'idea',
      entityId: ideaId,
    });
  }

  return { success: true, status: newStatus as IdeaStatus };
}

export async function updateIdeaOwnerProgressAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const locale = normalizeLocale(formData.get('locale'));
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const ideaId = formData.get('ideaId');
  const status = formData.get('status');
  const progressRaw = formData.get('progressPercentage');
  const latestUpdate = formData.get('latestUpdate');
  const projectNotes = formData.get('projectNotes');
  const validStatuses = ['published', 'discussion', 'interested', 'approved', 'in_progress', 'completed'];
  const normalizeProgressStatus = (value: string): string => {
    if (validStatuses.includes(value)) return value;
    if (value === 'submitted') return 'published';
    if (value === 'under_review') return 'discussion';
    if (value === 'accepted') return 'approved';
    if (value === 'gathering_participants') return 'interested';
    return 'published';
  };
  const legacySafeStatus = (value: string): string => {
    if (value === 'approved') return 'in_progress';
    if (value === 'discussion') return 'interested';
    return value;
  };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'unauthorized' };
  if (typeof ideaId !== 'string' || typeof status !== 'string') {
    return { success: false, error: 'invalid' };
  }
  const normalizedStatus = normalizeProgressStatus(status);
  if (!validStatuses.includes(normalizedStatus)) return { success: false, error: 'invalid' };

  const { data: idea } = await supabase
    .from('ideas')
    .select('author_id')
    .eq('id', ideaId)
    .maybeSingle();

  if (!idea) return { success: false, error: 'not_found' };
  if (idea.author_id !== user.id) return { success: false, error: 'forbidden' };

  const progressPercentage = Math.max(0, Math.min(100, Number(progressRaw ?? 0) || 0));
  const trimmedNotes = typeof projectNotes === 'string' ? projectNotes.trim().slice(0, 2000) : '';
  const trimmedUpdate = typeof latestUpdate === 'string' ? latestUpdate.trim().slice(0, 2000) : '';

  const now = new Date().toISOString();
  const safeStatus = legacySafeStatus(normalizedStatus);
  const updateAttempts: Record<string, unknown>[] = [
    {
      status: normalizedStatus,
      progress_percentage: progressPercentage,
      project_notes: trimmedNotes || null,
      updated_at: now,
    },
    {
      progress_percentage: progressPercentage,
      project_notes: trimmedNotes || null,
      updated_at: now,
    },
    {status: safeStatus, updated_at: now},
    {updated_at: now},
  ];

  let savedCore = false;
  let lastUpdateError: string | undefined;
  for (const payload of updateAttempts) {
    const {data, error} = await supabase
      .from('ideas')
      .update(payload)
      .eq('id', ideaId)
      .select('id')
      .maybeSingle();

    if (!error && data?.id) {
      savedCore = true;
      break;
    }

    if (error) {
      lastUpdateError = error.message;
    }
  }

  let savedUpdate = false;
  if (trimmedUpdate) {
    const { error: insertError } = await supabase
      .from('idea_updates')
      .insert({
        idea_id: ideaId,
        author_id: user.id,
        content: trimmedUpdate,
      });

    if (!insertError) {
      savedUpdate = true;
    } else {
      console.error('updateIdeaOwnerProgressAction latest update insert error:', insertError.message);
    }
  }

  if (!savedCore && !savedUpdate) {
    return { success: false, error: lastUpdateError ?? 'not_saved' };
  }

  if (normalizedStatus === 'completed') {
    try {
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('idea_id', ideaId)
        .in('type', ['idea', 'idea_project_room']);
      for (const conv of conversations ?? []) {
        await supabase.rpc('archive_conversation', { p_conv_id: conv.id });
      }
    } catch (e) {
      console.error('updateIdeaOwnerProgressAction archive error:', e);
    }
    await publishPlatformEvent({
      name: 'idea.completed',
      actorId: user.id,
      entityType: 'idea',
      entityId: ideaId,
    });
  }

  revalidatePath(toPath(locale, `/ideas/${ideaId}`));
  revalidatePath(toPath(locale, '/ideas'));
  revalidatePath(toPath(locale, '/messages'));
  return { success: true };
}

export async function getIdeaMessagesAction(
  ideaId: string,
): Promise<{ success: boolean; messages?: IdeaMessageWithSender[]; error?: string }> {
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  const {data: messages} = await supabase
    .from("idea_messages")
    .select("*, sender:sender_id(id, username, full_name, avatar_url)")
    .eq("idea_id", ideaId)
    .order("created_at", {ascending: true});

  return { success: true, messages: (messages ?? []) as unknown as IdeaMessageWithSender[] };
}

export async function openIdeaProjectRoomAction(
  ideaId: string,
): Promise<{ success: boolean; conversationId?: string; error?: string }> {
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'unauthorized' };
  if (!ideaId) return { success: false, error: 'invalid' };

  const { data: idea } = await supabase
    .from('ideas')
    .select('id, title, image_url, author_id')
    .eq('id', ideaId)
    .maybeSingle();

  if (!idea) return { success: false, error: 'not_found' };

  const [{ data: vote }, { data: profile }] = await Promise.all([
    supabase
      .from('idea_votes')
      .select('id')
      .eq('idea_id', ideaId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  const isOwner = idea.author_id === user.id;
  const isAdmin = profile?.role === 'admin';
  if (!isOwner && !isAdmin && !vote) return { success: false, error: 'vote_required' };

  const { data: conversationId, error } = await supabase.rpc('join_idea_project_room', {
    p_idea_id: ideaId,
    p_user_id: user.id,
  });

  let resolvedConversationId = typeof conversationId === 'string' ? conversationId : null;

  if (error || !resolvedConversationId) {
    const message = error?.message?.toLowerCase() ?? '';
    if (message.includes('vote_required')) return { success: false, error: 'vote_required' };
    if (message.includes('unauthorized')) return { success: false, error: 'unauthorized' };
    if (message.includes('not_found')) return { success: false, error: 'not_found' };

    const writeClient = createAdminClient() ?? supabase;

    const { data: existingProjectRoom } = await writeClient
      .from('conversations')
      .select('id')
      .eq('idea_id', ideaId)
      .eq('type', 'idea_project_room')
      .maybeSingle();

    resolvedConversationId = existingProjectRoom?.id ?? null;

    if (!resolvedConversationId) {
      const { data: insertedProjectRoom, error: insertProjectRoomError } = await writeClient
        .from('conversations')
        .insert({
          type: 'idea_project_room',
          idea_id: ideaId,
          title: idea.title ?? '',
          image_url: idea.image_url ?? null,
        })
        .select('id')
        .single();

      resolvedConversationId = insertedProjectRoom?.id ?? null;

      if (insertProjectRoomError || !resolvedConversationId) {
        const { data: existingIdeaRoom } = await writeClient
          .from('conversations')
          .select('id')
          .eq('idea_id', ideaId)
          .eq('type', 'idea')
          .maybeSingle();

        resolvedConversationId = existingIdeaRoom?.id ?? null;

        if (!resolvedConversationId) {
          const { data: insertedIdeaRoom, error: insertIdeaRoomError } = await writeClient
            .from('conversations')
            .insert({
              type: 'idea',
              idea_id: ideaId,
              title: idea.title ?? '',
              image_url: idea.image_url ?? null,
            })
            .select('id')
            .single();

          if (insertIdeaRoomError || !insertedIdeaRoom?.id) {
            console.error('openIdeaProjectRoomAction fallback error:', error, insertProjectRoomError, insertIdeaRoomError);
            return { success: false, error: 'failed' };
          }

          resolvedConversationId = insertedIdeaRoom.id;
        }
      }
    }

    const participantRows = [
      { conversation_id: resolvedConversationId, user_id: idea.author_id, role: 'admin', left_at: null, removed_at: null, removed_by: null },
      { conversation_id: resolvedConversationId, user_id: user.id, role: isOwner ? 'admin' : 'member', left_at: null, removed_at: null, removed_by: null },
    ].filter((row, index, rows) => row.user_id && rows.findIndex((item) => item.user_id === row.user_id) === index);

    const { error: participantError } = await writeClient
      .from('conversation_participants')
      .upsert(participantRows, { onConflict: 'conversation_id,user_id' });

    if (participantError) {
      console.error('openIdeaProjectRoomAction participant fallback error:', participantError);
      return { success: false, error: 'failed' };
    }
  }

  if (!resolvedConversationId) return { success: false, error: 'failed' };

  const { getConversationById } = await import('@/lib/data/conversations');
  const conversation = await getConversationById(resolvedConversationId, user.id);
  if (!conversation) return { success: false, error: 'forbidden' };

  const owner = conversation.participants.find((participant) => participant.role === 'admin')?.user_id;
  if (owner && owner !== user.id) {
    await createNotification({
      userId: owner,
      actorId: user.id,
      type: 'idea_project_room_joined',
      entityType: 'idea',
      entityId: ideaId,
      title: 'Joined your project room',
      metadata: { conversationId: resolvedConversationId },
    });
  }

  return { success: true, conversationId: resolvedConversationId };
}

export async function getIdeaParticipationDataAction(
  ideaId: string,
): Promise<{
  success: boolean;
  userParticipation?: {status: string; message: string | null} | null;
  userSupported?: boolean;
  participants?: {id: string; user_id: string; status: string; message: string | null; user: {id: string; username: string | null; full_name: string | null; avatar_url: string | null} | null}[];
  acceptedParticipants?: {id: string; user_id: string; status: string; message: string | null; user: {id: string; username: string | null; full_name: string | null; avatar_url: string | null} | null}[];
  error?: string;
}> {
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  const {data: idea} = await supabase
    .from("ideas")
    .select("author_id")
    .eq("id", ideaId)
    .maybeSingle();

  const isOwner = idea?.author_id === user.id;
  const [participation, supported, participants] = await Promise.all([
    getIdeaUserParticipation(ideaId, user.id),
    getIdeaUserSupport(ideaId, user.id),
    isOwner ? getIdeaParticipants(ideaId) : getIdeaAcceptedParticipants(ideaId),
  ]);

  return {
    success: true,
    userParticipation: participation,
    userSupported: supported,
    participants,
    acceptedParticipants: participants,
  };
}

export async function sendIdeaMessageAction(
  formData: FormData,
): Promise<{ success: boolean; message?: {id: string; created_at: string}; error?: string }> {
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const ideaId = formData.get('ideaId');
  const message = formData.get('message');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'unauthorized' };
  }

  if (await isUserRateLimited('comment', user.id)) {
    return { success: false, error: 'rate_limited' };
  }

  if (typeof ideaId !== 'string' || typeof message !== 'string' || message.trim().length === 0) {
    return { success: false, error: 'invalid' };
  }

  const trimmed = message.trim().slice(0, 500);

  const idea = await getIdeaById(ideaId);
  if (!idea) {
    return { success: false, error: 'not_found' };
  }

  if (idea.status === 'completed' || idea.status === 'archived') {
    return { success: false, error: 'archived' };
  }

  const isAuthorized = await isUserAcceptedParticipant(ideaId, user.id, idea.author_id ?? '');
  if (!isAuthorized) {
    return { success: false, error: 'unauthorized' };
  }

  const { data: newMessage, error } = await supabase.from('idea_messages').insert({
    idea_id: ideaId,
    sender_id: user.id,
    message: trimmed,
  }).select('id, created_at').single();

  if (error || !newMessage) {
    return { success: false, error: error?.message ?? 'insert_failed' };
  }

  // also write to conversation_messages for unified inbox
  try {
    const { ensureConversationExists, sendConversationMessage } = await import('@/lib/data/conversations');
    const convId = await ensureConversationExists('idea', ideaId);
    if (convId) {
      await sendConversationMessage(convId, user.id, trimmed);
    }
  } catch (e) {
    console.error('sendIdeaMessageAction conv sync error:', e);
  }

  const acceptedParticipants = await getIdeaAcceptedParticipants(ideaId);
  const participantIds = acceptedParticipants
    .map((p) => p.user?.id)
    .filter((id): id is string => !!id);

  const recipientIds = new Set(participantIds);
  if (idea.author_id) recipientIds.add(idea.author_id);
  recipientIds.delete(user.id);

  await createIdeaMessageNotification(ideaId, user.id, [...recipientIds]);

  return { success: true, message: {id: newMessage.id, created_at: newMessage.created_at} };
}

export async function updateIdeaGroupProfileAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const conversationId = formData.get('conversationId');
  const title = formData.get('title');
  const imageUrl = formData.get('imageUrl');
  const imageStoragePath = formData.get('imageStoragePath');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'unauthorized' };
  if (typeof conversationId !== 'string') return { success: false, error: 'invalid' };

  const { getConversationById, updateIdeaGroupProfile } = await import('@/lib/data/conversations');
  const conversation = await getConversationById(conversationId, user.id);
  if (!conversation || (conversation.type !== 'idea' && conversation.type !== 'idea_project_room')) return { success: false, error: 'not_found' };

  const currentUser = conversation.participants.find((p) => p.user_id === user.id);
  if (currentUser?.role !== 'admin') return { success: false, error: 'unauthorized' };

  const cleanedTitle = typeof title === 'string' ? title.trim() : null;
  if (cleanedTitle !== null && (cleanedTitle.length < 2 || cleanedTitle.length > 120)) {
    return { success: false, error: 'name_too_short' };
  }

  const ok = await updateIdeaGroupProfile(conversationId, user.id, {
    title: cleanedTitle,
    imageUrl: typeof imageUrl === 'string' && imageUrl ? imageUrl : null,
    imageStoragePath: typeof imageStoragePath === 'string' && imageStoragePath ? imageStoragePath : null,
  });
  if (!ok) return { success: false, error: 'update_failed' };

  for (const participant of conversation.participants) {
    if (participant.user_id === user.id) continue;
    await createNotification({
      userId: participant.user_id,
      actorId: user.id,
      type: 'idea_group_updated',
      entityType: 'idea',
      entityId: conversation.idea_id ?? conversationId,
      title: 'Idea group updated',
      metadata: { conversationId },
    });
  }

  revalidatePath('/messages');
  return { success: true };
}

export async function removeIdeaGroupMemberAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const conversationId = formData.get('conversationId');
  const memberId = formData.get('memberId');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'unauthorized' };
  if (typeof conversationId !== 'string' || typeof memberId !== 'string') return { success: false, error: 'invalid' };
  if (memberId === user.id) return { success: false, error: 'invalid' };

  const { getConversationById, removeIdeaGroupMember } = await import('@/lib/data/conversations');
  const conversation = await getConversationById(conversationId, user.id);
  if (!conversation || (conversation.type !== 'idea' && conversation.type !== 'idea_project_room')) return { success: false, error: 'not_found' };

  const currentUser = conversation.participants.find((p) => p.user_id === user.id);
  const target = conversation.participants.find((p) => p.user_id === memberId);
  if (currentUser?.role !== 'admin') return { success: false, error: 'unauthorized' };
  if (!target || target.role === 'admin') return { success: false, error: 'invalid' };

  const ok = await removeIdeaGroupMember(conversationId, user.id, memberId);
  if (!ok) return { success: false, error: 'remove_failed' };

  await createNotification({
    userId: memberId,
    actorId: user.id,
    type: 'idea_group_removed',
    entityType: 'idea',
    entityId: conversation.idea_id ?? conversationId,
    title: 'Removed from idea group',
    metadata: { conversationId },
  });

  revalidatePath('/messages');
  return { success: true };
}

export async function leaveIdeaGroupAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const disabled = await guardFeatureAction('ideas');
  if (disabled) return { success: false, error: disabled };
  const conversationId = formData.get('conversationId');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'unauthorized' };
  if (typeof conversationId !== 'string') return { success: false, error: 'invalid' };

  const { getConversationById, leaveIdeaGroup } = await import('@/lib/data/conversations');
  const conversation = await getConversationById(conversationId, user.id);
  if (!conversation || (conversation.type !== 'idea' && conversation.type !== 'idea_project_room')) return { success: false, error: 'not_found' };

  const currentUser = conversation.participants.find((p) => p.user_id === user.id);
  if (currentUser?.role === 'admin') return { success: false, error: 'admin_cannot_leave' };

  const ok = await leaveIdeaGroup(conversationId, user.id);
  if (!ok) return { success: false, error: 'leave_failed' };

  const admins = conversation.participants.filter((p) => p.role === 'admin' && p.user_id !== user.id);
  for (const admin of admins) {
    await createNotification({
      userId: admin.user_id,
      actorId: user.id,
      type: 'idea_group_left',
      entityType: 'idea',
      entityId: conversation.idea_id ?? conversationId,
      title: 'Member left idea group',
      metadata: { conversationId },
    });
  }

  revalidatePath('/messages');
  return { success: true };
}

export async function adminUpdateIdeaStatusAction(formData: FormData) {
  const locale = normalizeLocale(formData.get('locale'));
  const disabled = await guardFeatureAction('ideas');
  if (disabled) redirect(withLocale('/admin/ideas', locale));
  const ideaId = formData.get('ideaId');
  const newStatus = formData.get('status');

  const validStatuses = ['published', 'interested', 'discussion', 'in_progress', 'completed', 'archived'];
  if (typeof ideaId !== 'string' || typeof newStatus !== 'string' || !validStatuses.includes(newStatus)) {
    redirect(withLocale('/admin/ideas', locale));
  }

  const { getCurrentAdminProfile } = await import('@/lib/data/admin');
  const adminProfile = await getCurrentAdminProfile();
  if (!adminProfile) {
    redirect(withLocale('/', locale));
  }

  const supabase = await createClient();
  const { error } = await supabase.from('ideas').update({ status: newStatus }).eq('id', ideaId);

  if (error) {
    console.error('adminUpdateIdeaStatusAction error:', error);
  }

  revalidatePath('/admin/ideas');
  redirect(withLocale('/admin/ideas', locale));
}
