import { createClient } from "@/lib/supabase/server";
import { getUserConversations, getConversationById, getConversationMessages } from "@/lib/data/conversations";
import { ConversationList } from "@/components/messages/conversation-list";
import { ConversationChat } from "@/components/messages/conversation-chat";
import { MessageSquare } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function MessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ conversation?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const t = await getTranslations({ locale, namespace: "Messages" });

  let conversations: Awaited<ReturnType<typeof getUserConversations>> = [];
  let currentUserId = "";
  let totalCount = 0;
  let unreadCount = 0;

  if (user) {
    currentUserId = user.id;
    conversations = await getUserConversations(user.id);
    totalCount = conversations.length;
    unreadCount = conversations.reduce((sum, c) => sum + c.unread_count, 0);
  }

  // Handle ?conversation= param: auto-select that conversation in the right panel
  let selectedConversation: Awaited<ReturnType<typeof getConversationById>> = null;
  let selectedMessages: Awaited<ReturnType<typeof getConversationMessages>> = [];

  if (sp.conversation && user) {
    selectedConversation = await getConversationById(sp.conversation, user.id);
    if (selectedConversation) {
      const isParticipant = selectedConversation.participants.some((p) => p.user_id === user.id);
      if (isParticipant) {
        selectedMessages = await getConversationMessages(sp.conversation);
      }
    }
  }

  return (
    <section className="mx-auto flex h-[calc(100dvh-8.75rem)] min-h-[560px] w-full overflow-hidden rounded-lg border border-border/70 bg-background shadow-sm md:h-[calc(100dvh-7.5rem)]">
      <div className={`${selectedConversation ? "hidden md:flex" : "flex"} w-full flex-col md:w-[32%] md:min-w-0 md:shrink-0 md:border-e md:border-border/70`}>
        <ConversationList initialConversations={conversations} currentUserId={currentUserId} />
      </div>

      {selectedConversation ? (
        <div className="flex min-w-0 flex-1 flex-col md:w-[68%]">
          <ConversationChat
            conversationId={sp.conversation!}
            initialMessages={selectedMessages}
            currentUserId={currentUserId}
            isArchived={!!selectedConversation.archived_at}
            conversationTitle={selectedConversation.title}
            conversationType={selectedConversation.type}
            conversationImageUrl={selectedConversation.image_url}
            conversationImageStoragePath={selectedConversation.image_storage_path}
            ideaId={selectedConversation.idea_id}
            ideaTitle={selectedConversation.idea_title}
            ideaStatus={selectedConversation.idea_status}
            memberCount={selectedConversation.member_count}
            participants={selectedConversation.participants}
          />
        </div>
      ) : (
        <div className="hidden min-w-0 flex-1 items-center justify-center md:flex md:w-[68%]">
          <div className="mx-auto max-w-sm px-6 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
              <MessageSquare size={40} className="text-primary/60" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">{t("emptyTitle")}</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {t("emptyDescription")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {t("selectConversationHint")}
            </p>
            {totalCount > 0 && (
              <div className="mt-7 flex items-center justify-center gap-8">
                <div className="text-center">
                  <p className="text-2xl font-bold tracking-tight text-foreground">{totalCount}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("activeConversations", { count: totalCount })}
                  </p>
                </div>
                <div className="h-10 w-px bg-border/60" />
                <div className="text-center">
                  <p className="text-2xl font-bold tracking-tight text-primary">{unreadCount}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("unreadMessages", { count: unreadCount })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
