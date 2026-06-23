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

  const otherParticipant = conversation.participants.find((p) => p.user_id !== user.id);
  const otherName = otherParticipant?.user?.full_name ?? otherParticipant?.user?.username ?? "?";
  const otherAvatarUrl = otherParticipant?.user?.avatar_url ?? null;

  const conversations = await getUserConversations(user.id);

  return (
    <>
      <div className="hidden w-full flex-col md:flex md:w-[32%] md:min-w-0 md:shrink-0 md:border-e md:border-border/70">
        <ConversationList initialConversations={conversations} currentUserId={user.id} />
      </div>

      <div className="flex flex-1 flex-col">
        <ConversationChat
          conversationId={id}
          initialMessages={messages}
          currentUserId={user.id}
          otherUserName={otherName}
          otherUserAvatarUrl={otherAvatarUrl}
          isArchived={!!conversation.archived_at}
          conversationTitle={conversation.title}
          conversationType={conversation.type}
        />
      </div>
    </>
  );
}
