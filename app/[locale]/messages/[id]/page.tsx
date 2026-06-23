import { createClient } from "@/lib/supabase/server";
import { getConversationById, getConversationMessages, getUserConversations } from "@/lib/data/conversations";
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

  const conversation = await getConversationById(id, user.id);
  if (!conversation) {
    console.error("Conversation not found:", id, "userId:", user.id);
    notFound();
  }

  const isParticipant = conversation.participants.some((p) => p.user_id === user.id);
  if (!isParticipant) notFound();

  const messages = await getConversationMessages(id);
  const conversations = await getUserConversations(user.id);

  return (
    <section className="mx-auto flex h-[calc(100dvh-8.75rem)] min-h-[560px] w-full overflow-hidden rounded-lg border border-border/70 bg-background shadow-sm md:h-[calc(100dvh-7.5rem)]">
      <div className="hidden w-full flex-col md:flex md:w-[32%] md:min-w-0 md:shrink-0 md:border-e md:border-border/70">
        <ConversationList initialConversations={conversations} currentUserId={user.id} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col md:w-[68%]">
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
        />
      </div>
    </section>
  );
}
