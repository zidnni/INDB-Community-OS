import { createClient } from "@/lib/supabase/server";
import { getUserConversations } from "@/lib/data/conversations";
import { ConversationList } from "@/components/messages/conversation-list";
import { MessageSquare } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function MessagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
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

  return (
    <>
      <div className="flex w-full flex-col md:w-[32%] md:min-w-0 md:shrink-0 md:border-e md:border-border/70">
        <ConversationList initialConversations={conversations} currentUserId={currentUserId} />
      </div>

      <div className="hidden flex-1 items-center justify-center md:flex">
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
    </>
  );
}
