import {createClient} from "@/lib/supabase/server";
import type {EventWithCreator} from "@/types/database";

export async function getEvents(): Promise<EventWithCreator[]> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("events")
    .select(`
      *,
      creator:profiles!events_creator_id_fkey(id, username, full_name, avatar_url)
    `)
    .order("date", {ascending: false, nullsFirst: false});

  return (data ?? []) as unknown as EventWithCreator[];
}
