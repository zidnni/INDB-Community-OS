import { createClient } from "@/lib/supabase/server";
import { getConversationById, getConversationMessages, getDirectConversationBlockState, getUserConversations } from "@/lib/data/conversations";
import { ConversationList } from "@/components/messages/conversation-list";
import { ConversationChat } from "@/components/messages/conversation-chat";
import { notFound, redirect } from "next/navigation";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const conversations = await getUserConversations(user.id);
  const inboxConversation = conversations.find((item) => item.id === id) ?? null;
  const conversation = await getConversationById(id, user.id, inboxConversation);
  if (!conversation) {
    console.error("Conversation not found:", id, "userId:", user.id);
    notFound();
  }

  const isParticipant = conversation.participants.some((p) => p.user_id === user.id);
  if (!isParticipant) notFound();

  const messages = await getConversationMessages(id, 80, user.id);
  const blockState = await getDirectConversationBlockState(id, user.id, conversation);

  return (
    <section className="fixed inset-x-0 top-[var(--chat-viewport-top,0px)] bottom-auto z-[60] flex h-[var(--chat-viewport-height,100dvh)] min-h-0 w-full max-w-[100vw] overflow-hidden bg-background [touch-action:pan-y] md:relative md:inset-auto md:z-auto md:h-full md:max-w-none">
      <div className="hidden min-h-0 w-full flex-col md:flex md:w-[30%] md:min-w-[17rem] md:shrink-0 md:border-e md:border-border/70">
        <ConversationList initialConversations={conversations} currentUserId={user.id} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:w-[70%]">
        <ConversationChat
          conversationId={id}
          initialMessages={messages}
          currentUserId={user.id}
          isArchived={!!conversation.archived_at}
          conversationTitle={conversation.title}
          conversationType={conversation.type}
          conversationImageUrl={conversation.image_url}
          conversationImageStoragePath={conversation.image_storage_path}
          ideaId={conversation.idea_id}
          ideaTitle={conversation.idea_title}
          ideaStatus={conversation.idea_status}
          memberCount={conversation.member_count}
          participants={conversation.participants}
          initialBlockState={blockState}
          initialConversations={conversations}
        />
      </div>
    </section>
  );
}
