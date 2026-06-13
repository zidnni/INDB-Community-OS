import {createClient} from "@supabase/supabase-js";

const SUPABASE_URL = "https://oanwmlouezwtcirrhbyl.supabase.co";

async function main() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY not set");
    console.error("Run: $env:SUPABASE_SERVICE_ROLE_KEY='<your-key>'  (PowerShell)");
    console.error("Or paste the key from Vercel/Supabase dashboard");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, serviceRoleKey, {db: {schema: "public"}});

  const migrationSql = `-- ============================================================
-- FADLA RLS FIX: Allow requests for 'published' OR 'requested'
-- Multiple users should be able to request the same item.
-- Only the first request changes status from published → requested.
-- ============================================================

drop policy if exists "Authenticated users can request shares" on public.community_share_requests;

create policy "Authenticated users can request shares"
  on public.community_share_requests for insert
  to authenticated
  with check (
    requester_id = auth.uid()
    and exists (
      select 1 from public.community_shares
      where community_shares.id = share_id
        and community_shares.owner_id <> auth.uid()
        and community_shares.status in ('published', 'requested')
    )
    and not exists (
      select 1 from public.community_share_requests existing
      where existing.share_id = share_id
        and existing.requester_id = auth.uid()
        and existing.status = 'pending'
    )
  );`;

  const {data, error} = await supabase.rpc("exec_sql", {query: migrationSql});

  if (error) {
    console.error("RPC exec_sql failed:", error.message);
    console.log("Trying direct SQL via pg_dump query instead...");

    const {error: sqlError} = await supabase.from("_exec_sql").select().eq("1", "1").limit(0);
    console.log("Fallback also failed:", sqlError?.message);

    console.log("\nPlease run the SQL manually in Supabase dashboard SQL editor:");
    console.log("https://supabase.com/dashboard/project/oanwmlouezwtcirrhbyl/sql/new");
    console.log("\nSQL to run:");
    console.log(migrationSql);
    process.exit(1);
  }

  console.log("Migration applied successfully:", data);
}

main();
