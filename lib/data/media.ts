import {createClient} from "@/lib/supabase/server";
import type {PostMediaRow, MemoryMediaRow, IdeaMediaRow} from "@/types/database";

export async function getPostMedia(postId: string): Promise<PostMediaRow[]> {
  const supabase = await createClient();
  const {data} = await supabase
    .from("post_media")
    .select("*")
    .eq("post_id", postId)
    .order("position", {ascending: true});
  return (data ?? []) as PostMediaRow[];
}

export async function getMemoryMedia(memoryId: string): Promise<MemoryMediaRow[]> {
  const supabase = await createClient();
  const {data} = await supabase
    .from("memory_media")
    .select("*")
    .eq("memory_id", memoryId)
    .order("position", {ascending: true});
  return (data ?? []) as MemoryMediaRow[];
}

export async function getIdeaMedia(ideaId: string): Promise<IdeaMediaRow[]> {
  const supabase = await createClient();
  const {data} = await supabase
    .from("idea_media")
    .select("*")
    .eq("idea_id", ideaId)
    .order("position", {ascending: true});
  return (data ?? []) as IdeaMediaRow[];
}

export async function insertPostMedia(
  items: Array<{post_id: string; url: string; type: "image" | "video"; mime_type: string; storage_path: string; position: number}>,
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("post_media").insert(items);
}

export async function insertMemoryMedia(
  items: Array<{memory_id: string; url: string; type: "image" | "video"; mime_type: string; storage_path: string; position: number}>,
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("memory_media").insert(items);
}

export async function insertIdeaMedia(
  items: Array<{idea_id: string; url: string; type: "image" | "video"; mime_type: string; storage_path: string; position: number}>,
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("idea_media").insert(items);
}

export async function deletePostMedia(postId: string): Promise<void> {
  const supabase = await createClient();
  const {data: existing} = await supabase
    .from("post_media")
    .select("storage_path")
    .eq("post_id", postId);
  const paths = existing?.map((m) => m.storage_path) ?? [];
  if (paths.length > 0) {
    await supabase.storage.from("post-media").remove(paths);
  }
  await supabase.from("post_media").delete().eq("post_id", postId);
}

export async function deleteMemoryMedia(memoryId: string): Promise<void> {
  const supabase = await createClient();
  const {data: existing} = await supabase
    .from("memory_media")
    .select("storage_path")
    .eq("memory_id", memoryId);
  const paths = existing?.map((m) => m.storage_path) ?? [];
  if (paths.length > 0) {
    await supabase.storage.from("memory-archive").remove(paths);
  }
  await supabase.from("memory_media").delete().eq("memory_id", memoryId);
}

export async function deleteIdeaMedia(ideaId: string): Promise<void> {
  const supabase = await createClient();
  const {data: existing} = await supabase
    .from("idea_media")
    .select("storage_path")
    .eq("idea_id", ideaId);
  const paths = existing?.map((m) => m.storage_path) ?? [];
  if (paths.length > 0) {
    await supabase.storage.from("idea-media").remove(paths);
  }
  await supabase.from("idea_media").delete().eq("idea_id", ideaId);
}

export async function deletePostMediaByStoragePaths(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = await createClient();
  await supabase.storage.from("post-media").remove(paths);
  await supabase.from("post_media").delete().in("storage_path", paths);
}

export async function deleteMemoryMediaByStoragePaths(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = await createClient();
  await supabase.storage.from("memory-archive").remove(paths);
  await supabase.from("memory_media").delete().in("storage_path", paths);
}

export async function deleteIdeaMediaByStoragePaths(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = await createClient();
  await supabase.storage.from("idea-media").remove(paths);
  await supabase.from("idea_media").delete().in("storage_path", paths);
}
