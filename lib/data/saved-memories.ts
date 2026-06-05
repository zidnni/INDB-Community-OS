import {createClient} from "@/lib/supabase/server";

export async function isMemorySaved(memoryId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const {data} = await supabase
    .from("saved_memories")
    .select("id")
    .eq("memory_id", memoryId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function saveMemoryDb(memoryId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const {error} = await supabase.from("saved_memories").insert({
    memory_id: memoryId,
    user_id: userId,
  });
  return !error;
}

export async function unsaveMemoryDb(memoryId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const {error} = await supabase
    .from("saved_memories")
    .delete()
    .eq("memory_id", memoryId)
    .eq("user_id", userId);
  return !error;
}

export async function toggleSaveMemoryDb(memoryId: string, userId: string): Promise<boolean> {
  const saved = await isMemorySaved(memoryId, userId);
  if (saved) {
    return unsaveMemoryDb(memoryId, userId);
  }
  return saveMemoryDb(memoryId, userId);
}
