import {createClient} from "@/lib/supabase/server";
import type {ProjectWithCreator} from "@/types/database";

export async function getProjects(): Promise<ProjectWithCreator[]> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("projects")
    .select(`
      *,
      creator:profiles!projects_creator_id_fkey(id, username, full_name, avatar_url)
    `)
    .order("created_at", {ascending: false});

  return (data ?? []) as unknown as ProjectWithCreator[];
}
