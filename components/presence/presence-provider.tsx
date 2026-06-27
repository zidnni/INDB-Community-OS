"use client";

import {createContext, useContext, useEffect, useState, useRef} from "react";
import {createClient} from "@/lib/supabase/client";
import {useCurrentUser} from "@/hooks/use-current-user";

interface PresenceContextValue {
  onlineUsers: Set<string>;
}

const PresenceContext = createContext<PresenceContextValue>({onlineUsers: new Set()});

export function useIsOnline(userId: string | null | undefined): boolean {
  const {onlineUsers} = useContext(PresenceContext);
  if (!userId) return false;
  return onlineUsers.has(userId);
}

export function PresenceProvider({children}: {children: React.ReactNode}) {
  const {userId} = useCurrentUser();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    let cancelled = false;

    supabase
      .from("user_settings")
      .select("show_online_status")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({data}) => {
        if (cancelled) return;
        const showOnline = data?.show_online_status ?? false;

        const channel = supabase.channel("presence-online");
        channelRef.current = channel;

        channel
          .on("presence", {event: "sync"}, () => {
            const state = channel.presenceState();
            const online = new Set<string>();
            for (const presences of Object.values(state)) {
              for (const p of (presences as {user_id?: string}[])) {
                if (p.user_id) online.add(p.user_id);
              }
            }
            if (!cancelled) setOnlineUsers(online);
          })
          .subscribe(async (status) => {
            if (status === "SUBSCRIBED" && showOnline && !cancelled) {
              await channel.track({
                user_id: userId,
                online_at: new Date().toISOString(),
              });
            }
          });
      });

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  return (
    <PresenceContext.Provider value={{onlineUsers}}>
      {children}
    </PresenceContext.Provider>
  );
}
