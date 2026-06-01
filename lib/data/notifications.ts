import {createClient} from "@/lib/supabase/server";

export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const {count} = await supabase
    .from("notifications")
    .select("*", {count: "exact", head: true})
    .eq("user_id", userId)
    .eq("read", false);
  return count ?? 0;
}
