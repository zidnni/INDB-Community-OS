import {createClient} from "@/lib/supabase/server";
import type {PollWithOptions} from "@/types/database";

export async function getPolls(): Promise<PollWithOptions[]> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("polls")
    .select(`
      *,
      options:poll_options(*)
    `)
    .order("created_at", {ascending: false});

  return (data ?? []) as unknown as PollWithOptions[];
}
