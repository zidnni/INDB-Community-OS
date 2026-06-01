import {createClient} from "@/lib/supabase/server";
import type {CategoryRow} from "@/types/database";

export async function getCategories(): Promise<CategoryRow[]> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("categories")
    .select("*")
    .order("id", {ascending: true});

  return (data ?? []) as CategoryRow[];
}

export async function getCategoryBySlug(slug: string): Promise<CategoryRow | null> {
  const supabase = await createClient();

  const {data} = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .single();

  return data as CategoryRow | null;
}
