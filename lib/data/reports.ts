import {createClient} from "@/lib/supabase/server";
import type {ReportRow} from "@/types/database";

export async function getReportsCount(): Promise<number> {
  const supabase = await createClient();
  const {count} = await supabase
    .from("reports")
    .select("*", {count: "exact", head: true})
    .eq("status", "pending");
  return count ?? 0;
}

export async function getPendingReports(): Promise<ReportRow[]> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("reports")
    .select("*")
    .eq("status", "pending")
    .order("created_at", {ascending: false})
    .limit(20);

  return (data ?? []) as ReportRow[];
}
