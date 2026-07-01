"use server";

import {createAdminClient} from "@/lib/supabase/admin";
import {getPlugin, setPluginState} from "@/core/plugins/registry";
import {revalidatePath} from "next/cache";

async function syncFeatureFlag(
  supabase: ReturnType<typeof createAdminClient>,
  pluginId: string,
  enabled: boolean,
) {
  if (!supabase) return;
  const plugin = getPlugin(pluginId as Parameters<typeof setPluginState>[0]);
  const featureFlag = plugin?.manifest.featureFlag;
  if (!featureFlag) return;

  const {data} = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "feature_flags")
    .maybeSingle();

  const raw = (data as {value: unknown} | null)?.value;
  let flags: Record<string, boolean> = {};
  try {
    flags = raw ? (typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, boolean>)) : {};
  } catch {
    flags = {};
  }
  flags[featureFlag] = enabled;

  const {error} = await supabase
    .from("platform_settings")
    .upsert({key: "feature_flags", value: JSON.stringify(flags)}, {onConflict: "key"});

  if (error) throw new Error(`Failed to sync feature flag: ${error.message}`);
}

export async function togglePlugin(pluginId: string, enabled: boolean) {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Admin client not available");
  const state = enabled ? "enabled" : "disabled";

  const {error} = await supabase
    .from("plugin_settings")
    .upsert(
      {plugin_id: pluginId, key: "state", value: state},
      {onConflict: "plugin_id, key"},
    );

  if (error) throw new Error(`Failed to update plugin state: ${error.message}`);

  setPluginState(pluginId as Parameters<typeof setPluginState>[0], state as "enabled" | "disabled");

  // Route/nav/mutation enforcement (core/features/*) reads platform_settings.feature_flags,
  // not plugin_settings — keep both in sync so toggling here actually takes effect.
  await syncFeatureFlag(supabase, pluginId, enabled);

  revalidatePath("/admin/plugins");
}

export async function getPluginStates(): Promise<Record<string, string>> {
  const supabase = createAdminClient();
  if (!supabase) return {};
  const {data} = await supabase
    .from("plugin_settings")
    .select("plugin_id, value")
    .eq("key", "state");

  const states: Record<string, string> = {};
  for (const row of data ?? []) {
    states[row.plugin_id] = row.value;
  }
  return states;
}
