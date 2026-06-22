#!/usr/bin/env node
/**
 * I Love NDB performance and readiness report.
 *
 * Usage:
 *   npm run seed:report
 *
 * Measures the read paths needed after the living-city seed:
 * feed, search, Graatek, memories, ideas, notifications, profile loading,
 * database size, slow queries, and realtime notification latency.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { performance } from "perf_hooks";
import { randomUUID } from "crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadEnvFiles() {
  for (const fileName of [".env.local", ".env.supabase", ".env.production.local"]) {
    const envPath = path.join(ROOT, fileName);
    if (!fs.existsSync(envPath)) continue;
    const body = fs.readFileSync(envPath, "utf8");
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx < 0) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadEnvFiles();

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const pool = new pg.Pool({
  host: requireEnv("SUPABASE_DB_HOST"),
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  database: process.env.SUPABASE_DB_NAME ?? "postgres",
  user: requireEnv("SUPABASE_DB_USER"),
  password: requireEnv("SUPABASE_DB_PASSWORD"),
  ssl: { rejectUnauthorized: false },
  max: 6,
});

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 10 } },
});

async function query(sql, params = []) {
  return pool.query(sql, params);
}

async function timed(name, fn) {
  const start = performance.now();
  const result = await fn();
  const durationMs = Number((performance.now() - start).toFixed(2));
  const rowCount = Array.isArray(result?.rows) ? result.rows.length : result?.rowCount ?? null;
  return { name, durationMs, rowCount };
}

async function scalar(sql, params = []) {
  const { rows } = await query(sql, params);
  return Number(rows[0]?.value ?? 0);
}

async function collectTableStats() {
  const tables = [
    "profiles",
    "profile_interests",
    "posts",
    "comments",
    "post_reactions",
    "saved_posts",
    "memories",
    "memory_comments",
    "memory_reactions",
    "saved_memories",
    "ideas",
    "idea_votes",
    "idea_supporters",
    "idea_participants",
    "idea_comments",
    "idea_messages",
    "community_shares",
    "community_share_requests",
    "fadla_request_messages",
    "notifications",
    "user_follows",
    "recommendation_events",
  ];

  const stats = {};
  for (const table of tables) {
    try {
      const { rows } = await query(`
        select
          count(*)::int as total,
          count(*) filter (where created_at > now() - interval '24 hours')::int as last_24h,
          count(*) filter (where created_at > now() - interval '7 days')::int as last_7d
        from public.${table}
      `);
      stats[table] = rows[0];
    } catch (error) {
      stats[table] = { total: null, last_24h: null, last_7d: null, error: error.message };
    }
  }
  return stats;
}

async function collectWorkflowCounts() {
  const [completedGraatek, activeGraatek, availableGraatek, acceptedIdeas, rejectedIdeas, trendingIdeas, isolatedUsers, recommendationEvents] = await Promise.all([
    scalar(`select count(*) as value from public.community_shares where status = 'completed'`),
    scalar(`select count(*) as value from public.community_shares where status = 'requested'`),
    scalar(`select count(*) as value from public.community_shares where status = 'published'`),
    scalar(`select count(*) as value from public.ideas where status in ('in_progress', 'completed')`),
    scalar(`select count(*) as value from public.ideas where status = 'archived'`),
    scalar(`select count(*) as value from public.ideas where votes_count >= 45 or supporters_count >= 28`),
    scalar(`
      select count(*) as value
      from public.profiles p
      where not exists (
        select 1 from public.user_follows uf
        where uf.follower_id = p.id or uf.following_id = p.id
      )
    `),
    scalar(`select count(*) as value from public.recommendation_events`),
  ]);

  return {
    completedGraatek,
    activeGraatek,
    availableGraatek,
    acceptedIdeas,
    rejectedIdeas,
    trendingIdeas,
    isolatedUsers,
    recommendationEvents,
  };
}

async function collectBenchmarks(sampleUserId) {
  const benchmarks = [];

  benchmarks.push(await timed("feed loading", () => query(`
    with feed_posts as (
      select p.id, p.author_id, p.title, p.content, p.created_at, p.likes_count, p.comments_count, p.saves_count,
             row_to_json(pr) as author
      from public.posts p
      join public.profiles pr on pr.id = p.author_id
      where p.status = 'published'
      order by p.created_at desc
      limit 20
    )
    select fp.*,
      coalesce((
        select jsonb_object_agg(reaction_type, reaction_count)
        from (
          select reaction_type, count(*) as reaction_count
          from public.post_reactions r
          where r.post_id = fp.id
          group by reaction_type
        ) grouped
      ), '{}'::jsonb) as reaction_counts
    from feed_posts fp
  `)));

  benchmarks.push(await timed("search", () => query(`
    with q as (select '%school%'::text as pattern)
    select 'posts' as surface, count(*)::int as matches from public.posts, q
      where status = 'published' and (title ilike q.pattern or content ilike q.pattern)
    union all
    select 'ideas', count(*)::int from public.ideas, q
      where title ilike q.pattern or description ilike q.pattern
    union all
    select 'memories', count(*)::int from public.memories, q
      where verification_status = 'approved' and (title ilike q.pattern or description ilike q.pattern or location ilike q.pattern)
    union all
    select 'graatek', count(*)::int from public.community_shares, q
      where title ilike q.pattern or description ilike q.pattern or category ilike q.pattern or location ilike q.pattern
    union all
    select 'profiles', count(*)::int from public.profiles, q
      where full_name ilike q.pattern or username ilike q.pattern or bio ilike q.pattern or city ilike q.pattern
  `)));

  benchmarks.push(await timed("Graatek listing", () => query(`
    select cs.id, cs.title, cs.category, cs.status, cs.urgency_level, cs.created_at,
           row_to_json(p) as owner,
           (select count(*)::int from public.community_share_requests r where r.share_id = cs.id) as requests_count
    from public.community_shares cs
    join public.profiles p on p.id = cs.owner_id
    where cs.status in ('published', 'requested', 'reserved', 'collected', 'completed')
    order by cs.created_at desc
    limit 20
  `)));

  benchmarks.push(await timed("memory listing", () => query(`
    select m.id, m.title, m.year, m.category, m.reactions_count, m.comments_count, m.saves_count,
           row_to_json(p) as contributor
    from public.memories m
    join public.profiles p on p.id = m.contributor_id
    where m.verification_status = 'approved'
    order by m.year desc, m.created_at desc
    limit 20
  `)));

  benchmarks.push(await timed("ideas listing", () => query(`
    select i.id, i.title, i.status, i.votes_count, i.supporters_count, i.participants_count,
           row_to_json(p) as author,
           row_to_json(c) as category
    from public.ideas i
    join public.profiles p on p.id = i.author_id
    left join public.categories c on c.id = i.category_id
    order by i.votes_count desc, i.created_at desc
    limit 20
  `)));

  benchmarks.push(await timed("notifications", () => query(`
    select n.id, n.type, n.title, n.read, n.created_at,
           row_to_json(actor) as actor
    from public.notifications n
    left join public.profiles actor on actor.id = n.actor_id
    where n.user_id = $1
    order by n.created_at desc
    limit 20
  `, [sampleUserId])));

  benchmarks.push(await timed("profile loading", () => query(`
    select p.*,
      (select count(*)::int from public.posts where author_id = p.id) as posts_count,
      (select count(*)::int from public.memories where contributor_id = p.id) as memories_count,
      (select count(*)::int from public.ideas where author_id = p.id) as ideas_count,
      (select count(*)::int from public.comments where author_id = p.id) as comments_count,
      (select count(*)::int from public.community_shares where owner_id = p.id) as shares_count,
      (select count(*)::int from public.user_follows where following_id = p.id) as followers_count,
      (select count(*)::int from public.user_follows where follower_id = p.id) as following_count
    from public.profiles p
    where p.id = $1
  `, [sampleUserId])));

  return benchmarks;
}

async function collectSlowQueries() {
  try {
    const { rows } = await query(`
      select
        query,
        calls,
        round(mean_exec_time::numeric, 2) as mean_exec_time,
        round(max_exec_time::numeric, 2) as max_exec_time,
        rows,
        shared_blks_hit,
        shared_blks_read
      from pg_stat_statements
      order by mean_exec_time desc
      limit 20
    `);
    return rows;
  } catch (error) {
    return [{ note: "pg_stat_statements is not available", detail: error.message }];
  }
}

async function collectIndexUsage() {
  const { rows } = await query(`
    select
      schemaname,
      tablename,
      indexname,
      idx_scan,
      idx_tup_read,
      idx_tup_fetch
    from pg_stat_user_indexes
    where schemaname = 'public'
    order by idx_scan asc, indexname asc
    limit 40
  `);
  return rows;
}

async function collectTableSizes() {
  const { rows } = await query(`
    select
      relname as table_name,
      pg_size_pretty(pg_total_relation_size(relid)) as total_size,
      pg_size_pretty(pg_relation_size(relid)) as table_size,
      pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) as index_size,
      n_live_tup as row_count
    from pg_stat_user_tables
    where schemaname = 'public'
    order by pg_total_relation_size(relid) desc
  `);
  return rows;
}

async function collectDatabaseHealth() {
  const [{ rows: connectionRows }, { rows: lockRows }, { rows: cacheRows }, { rows: realtimeRows }, { rows: sizeRows }] = await Promise.all([
    query(`
      select
        count(*)::int as total_connections,
        count(*) filter (where state = 'active')::int as active,
        count(*) filter (where state = 'idle')::int as idle,
        count(*) filter (where state = 'idle in transaction')::int as idle_in_txn
      from pg_stat_activity
      where datname = current_database() and pid <> pg_backend_pid()
    `),
    query(`
      select
        count(*)::int as total_locks,
        count(*) filter (where granted = false)::int as waiting_locks
      from pg_locks
      where database = (select oid from pg_database where datname = current_database())
    `),
    query(`
      select
        round((sum(heap_blks_hit) * 100.0 / nullif(sum(heap_blks_hit + heap_blks_read), 0))::numeric, 2) as cache_hit_ratio,
        round((sum(idx_blks_hit) * 100.0 / nullif(sum(idx_blks_hit + idx_blks_read), 0))::numeric, 2) as index_cache_hit_ratio
      from pg_statio_user_tables
    `),
    query(`
      select count(*)::int as total_publication_tables
      from pg_publication_tables
      where pubname = 'supabase_realtime'
    `),
    query(`select pg_size_pretty(pg_database_size(current_database())) as pretty, pg_database_size(current_database()) as bytes`),
  ]);

  return {
    connections: connectionRows[0],
    locks: lockRows[0],
    cache: cacheRows[0],
    realtime: realtimeRows[0],
    databaseSize: sizeRows[0],
  };
}

async function measureRealtimeLatency(sampleUserId) {
  if (process.env.SKIP_REALTIME_PROBE === "1") {
    return { status: "skipped", latencyMs: null, reason: "SKIP_REALTIME_PROBE=1" };
  }

  const probeId = randomUUID();
  const actorId = sampleUserId;
  let subscribed = false;
  let resolveEvent;
  const eventPromise = new Promise((resolve) => {
    resolveEvent = resolve;
  });

  const channel = supabase
    .channel(`seed-report-${probeId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `id=eq.${probeId}` },
      () => resolveEvent(Number((performance.now() - startTime).toFixed(2))),
    );

  const subscribePromise = new Promise((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        subscribed = true;
        resolve();
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        reject(new Error(`Realtime subscribe status: ${status}`));
      }
    });
  });

  let startTime = performance.now();
  try {
    await Promise.race([
      subscribePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Realtime subscribe timeout")), 7000)),
    ]);
    startTime = performance.now();
    await query(`
      insert into public.notifications (id, user_id, actor_id, type, entity_type, entity_id, title, message, read, metadata, created_at)
      values ($1, $2, $3, 'qa_realtime_probe', 'profile', $2, 'Realtime probe', 'Temporary report probe', true, '{"probe": true}'::jsonb, now())
    `, [probeId, sampleUserId, actorId]);
    const latencyMs = await Promise.race([
      eventPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Realtime event timeout")), 10000)),
    ]);
    return { status: "ok", latencyMs, subscribed };
  } catch (error) {
    return { status: "failed", latencyMs: null, subscribed, error: error.message };
  } finally {
    await query(`delete from public.notifications where id = $1`, [probeId]).catch(() => {});
    await supabase.removeChannel(channel).catch(() => {});
  }
}

function rateReadiness(report) {
  const maxBenchmarkMs = Math.max(...report.performance.benchmarks.map((benchmark) => benchmark.durationMs));
  const slowBenchmarks = report.performance.benchmarks.filter((benchmark) => benchmark.durationMs > 750);
  const hasSeedScale =
    report.tables.profiles?.total >= 500 &&
    report.tables.posts?.total >= 500 &&
    report.tables.memories?.total >= 500 &&
    report.tables.ideas?.total >= 500 &&
    report.tables.community_shares?.total >= 500 &&
    report.tables.notifications?.total >= 5000;
  const graatekReady =
    report.workflow.completedGraatek >= 200 &&
    report.workflow.activeGraatek >= 150 &&
    report.workflow.availableGraatek >= 150;
  const noIsolation = report.workflow.isolatedUsers === 0;
  const recommendationReady = report.workflow.recommendationEvents >= 30000;
  const realtimeOk = report.performance.realtimeLatency.status === "ok" && report.performance.realtimeLatency.latencyMs < 2000;
  const lockOk = Number(report.health.locks?.waiting_locks ?? 0) === 0;

  return {
    users_5000: hasSeedScale && graatekReady && noIsolation && maxBenchmarkMs < 750 && lockOk
      ? "Ready for 5,000 users in controlled beta."
      : "Partially ready for 5,000 users; review slow paths, locks, or missing seed targets.",
    users_50000: hasSeedScale && maxBenchmarkMs < 300 && lockOk && realtimeOk
      ? "Promising for 50,000 users, but still requires k6 load testing and production pool sizing."
      : "Not yet proven for 50,000 users; run k6 scenarios, tune indexes, and verify connection pooling.",
    recommendation_engine: recommendationReady && noIsolation
      ? "Ready for first recommendation-engine experiments: personalized feeds, trending, and ranking features have event history."
      : "Needs more event history or social coverage before recommendation-engine experiments.",
    notes: {
      maxBenchmarkMs,
      slowBenchmarks: slowBenchmarks.map((benchmark) => benchmark.name),
      realtimeOk,
    },
  };
}

function printReport(report) {
  console.log("\n=== I Love NDB performance report ===");
  console.log("COUNTS");
  console.log(`  users:              ${report.tables.profiles?.total ?? "?"}`);
  console.log(`  Graatek:            ${report.tables.community_shares?.total ?? "?"} (${report.workflow.completedGraatek} completed, ${report.workflow.activeGraatek} active, ${report.workflow.availableGraatek} available)`);
  console.log(`  memories:           ${report.tables.memories?.total ?? "?"}`);
  console.log(`  posts:              ${report.tables.posts?.total ?? "?"}`);
  console.log(`  ideas:              ${report.tables.ideas?.total ?? "?"}`);
  console.log(`  notifications:      ${report.tables.notifications?.total ?? "?"}`);
  console.log(`  interactions/events:${report.workflow.recommendationEvents} recommendation events`);

  console.log("\nBENCHMARKS");
  for (const benchmark of report.performance.benchmarks) {
    console.log(`  ${benchmark.name.padEnd(18)} ${String(benchmark.durationMs).padStart(8)} ms`);
  }
  const realtime = report.performance.realtimeLatency;
  console.log(`  realtime latency    ${realtime.status === "ok" ? `${realtime.latencyMs} ms` : realtime.status}`);

  console.log("\nDATABASE");
  console.log(`  size:               ${report.health.databaseSize?.pretty ?? "?"}`);
  console.log(`  cache hit:          ${report.health.cache?.cache_hit_ratio ?? "?"}%`);
  console.log(`  index cache hit:    ${report.health.cache?.index_cache_hit_ratio ?? "?"}%`);
  console.log(`  connections:        ${report.health.connections?.total_connections ?? "?"} (${report.health.connections?.active ?? "?"} active)`);
  console.log(`  waiting locks:      ${report.health.locks?.waiting_locks ?? "?"}`);
  console.log(`  realtime tables:    ${report.health.realtime?.total_publication_tables ?? "?"}`);

  console.log("\nREADINESS");
  console.log(`  5,000 users:        ${report.readiness.users_5000}`);
  console.log(`  50,000 users:       ${report.readiness.users_50000}`);
  console.log(`  recommendations:    ${report.readiness.recommendation_engine}`);
}

async function main() {
  try {
    console.log("Generating I Love NDB performance report...");
    const { rows: sampleRows } = await query(`select id from public.profiles order by created_at desc limit 1`);
    if (!sampleRows[0]?.id) throw new Error("No profile rows found. Run npm run seed first.");
    const sampleUserId = sampleRows[0].id;

    const [tables, workflow, benchmarks, slowQueries, indexes, sizes, health] = await Promise.all([
      collectTableStats(),
      collectWorkflowCounts(),
      collectBenchmarks(sampleUserId),
      collectSlowQueries(),
      collectIndexUsage(),
      collectTableSizes(),
      collectDatabaseHealth(),
    ]);
    const realtimeLatency = await measureRealtimeLatency(sampleUserId);

    const report = {
      generatedAt: new Date().toISOString(),
      sampleUserId,
      tables,
      workflow,
      performance: {
        benchmarks,
        realtimeLatency,
      },
      health,
      tableSizes: sizes,
      indexUsage: indexes,
      slowQueries,
    };
    report.readiness = rateReadiness(report);

    const outPath = path.join(ROOT, "performance-report.json");
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    printReport(report);
    console.log(`\nReport saved to: ${outPath}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Report generation failed:", error.message);
  console.error(error.stack);
  process.exit(1);
});
