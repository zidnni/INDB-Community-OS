#!/usr/bin/env node
/**
 * I Love NDB living-city seed.
 *
 * Creates a repeatable Nouadhibou community simulation for product QA,
 * performance checks, and future recommendation/ranking work.
 *
 * Usage:
 *   npm run seed
 *
 * Loads env from .env.local, .env.supabase, and .env.production.local when
 * process env vars are not already set.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CONFIG = {
  totalUsers: 500,
  totalPosts: 500,
  totalMemories: 500,
  totalIdeas: 500,
  totalFadla: 500,
  completedFadla: 200,
  activeFadlaRequests: 150,
  availableFadla: 150,
  totalNotifications: 5000,
  testPassword: process.env.TEST_PASSWORD || "TestPass123!",
  authBatchSize: 20,
  authBatchDelayMs: 650,
  dbBatchSize: 500,
  seedNamespace: "indb-living-city-v2",
};

const LANGUAGES = [
  { code: "ar", label: "Arabic" },
  { code: "fr", label: "French" },
  { code: "ff", label: "Pulaar" },
  { code: "snk", label: "Soninke" },
  { code: "wo", label: "Wolof" },
];

const PROFESSIONS = [
  "fisherman",
  "student",
  "teacher",
  "entrepreneur",
  "volunteer",
  "retiree",
  "health_worker",
  "craftsman",
  "parent",
  "community_leader",
];

const AREAS = [
  "Cansado",
  "Numerowatt",
  "Dubai",
  "Tcharka",
  "Robinet 10",
  "Port Artisanal",
  "Boulenoir",
  "Centre Ville",
  "Socogim",
  "Tarhil",
  "PK 55",
  "Baghdad",
  "Basra",
  "Madrid",
  "La Batterie",
];

const FIRST_NAMES = [
  "Mohamed",
  "Ahmed",
  "Sidi",
  "Aminetou",
  "Mariem",
  "Khadijetou",
  "Mamadou",
  "Aissata",
  "Fatou",
  "Boubacar",
  "Oumar",
  "Samba",
  "Hawa",
  "Aminata",
  "Cheikh",
  "Moussa",
  "Salma",
  "Bilal",
  "Yero",
  "Adama",
  "Ndeye",
  "Maimouna",
  "Seydou",
  "Ibrahima",
  "Fatimetou",
];

const LAST_NAMES = [
  "Ould Salem",
  "Mint Ahmed",
  "Fall",
  "Diallo",
  "Ba",
  "Sy",
  "Kane",
  "Diop",
  "Ndiaye",
  "Sow",
  "Tall",
  "Camara",
  "Cisse",
  "Traore",
  "Dieng",
  "Niang",
  "Thiam",
  "Gueye",
  "Bah",
  "Sall",
  "Cheikh",
  "Mahmoud",
];

const INTERESTS_BY_PROFESSION = {
  fisherman: ["fishing", "environment", "local economy", "weather", "ports"],
  student: ["education", "sports", "technology", "youth activities", "culture"],
  teacher: ["education", "history", "volunteering", "books", "youth development"],
  entrepreneur: ["entrepreneurship", "business", "local economy", "tourism", "technology"],
  volunteer: ["volunteering", "environment", "community issues", "public spaces", "health"],
  retiree: ["history", "old Nouadhibou", "family memories", "local traditions", "culture"],
  health_worker: ["health", "volunteering", "education", "community issues", "family"],
  craftsman: ["crafts", "culture", "local economy", "furniture", "traditions"],
  parent: ["education", "family", "school supplies", "sports", "community safety"],
  community_leader: ["public spaces", "volunteering", "local economy", "culture", "environment"],
};

const HOBBIES = [
  "football",
  "reading",
  "tea gatherings",
  "walking by the bay",
  "handcrafts",
  "storytelling",
  "photography",
  "Quran study",
  "music",
  "local history",
];

const POST_TOPICS = [
  "daily life",
  "fishing",
  "business",
  "education",
  "community issues",
  "youth activities",
  "sports",
  "environment",
  "culture",
];

const MEMORY_TOPICS = [
  "Old Nouadhibou",
  "Fishing history",
  "School memories",
  "Ramadan memories",
  "Family memories",
  "Community events",
  "Local traditions",
  "Historical places",
];

const IDEA_TOPICS = [
  "Education",
  "Environment",
  "Youth development",
  "Public spaces",
  "Local economy",
  "Volunteering",
  "Culture",
  "Tourism",
];

const FADLA_CATEGORIES = [
  "food",
  "clothes",
  "school_supplies",
  "electronics",
  "furniture",
  "household",
  "books",
  "other",
];

const FADLA_CATEGORY_LABELS = {
  food: ["rice bag", "tea and sugar set", "dates box", "fish meal pack", "cooking oil"],
  clothes: ["children clothes", "winter jackets", "school uniforms", "women scarves", "work boots"],
  school_supplies: ["exercise books", "geometry set", "school bags", "pens and pencils", "French textbooks"],
  electronics: ["used tablet", "phone charger", "small radio", "LED lamp", "older laptop"],
  furniture: ["wooden table", "study desk", "plastic chairs", "baby bed", "small cupboard"],
  household: ["cooking pot", "water container", "blankets", "floor mats", "kitchen plates"],
  books: ["history books", "Arabic readers", "French novels", "exam prep books", "children stories"],
  other: ["baby stroller", "baby clothes bundle", "fishing net repair kit", "sewing supplies", "sports shoes"],
};

const REACTION_TYPES = ["like", "love", "support", "celebrate", "insightful", "sad"];
const FADLA_CONDITIONS = ["new", "like_new", "good", "fair"];
const URGENCY_LEVELS = ["urgent", "this_week", "no_urgency"];
const POST_TYPES = ["community", "news", "memory", "event", "idea", "project"];
const MEMORY_CATEGORIES = ["port", "railway", "schools", "families", "culture", "sport", "market", "beach", "fishing", "other"];

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

const DB_CONFIG = {
  host: requireEnv("SUPABASE_DB_HOST"),
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  database: process.env.SUPABASE_DB_NAME ?? "postgres",
  user: requireEnv("SUPABASE_DB_USER"),
  password: requireEnv("SUPABASE_DB_PASSWORD"),
  ssl: { rejectUnauthorized: false },
  max: 8,
};

const pool = new pg.Pool(DB_CONFIG);
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function query(sql, params = []) {
  return pool.query(sql, params);
}

function stableUuid(key) {
  const hex = createHash("sha1").update(`${CONFIG.seedNamespace}:${key}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function pick(values, index, offset = 0) {
  return values[(index + offset) % values.length];
}

function daysAgo(index, maxDays = 90, minuteStep = 17) {
  const days = index % maxDays;
  const minutes = (index * minuteStep) % 1440;
  return new Date(Date.now() - days * 86400000 - minutes * 60000).toISOString();
}

function padIndex(index) {
  return String(index).padStart(4, "0");
}

function genPhone(index) {
  const prefix = index < 250 ? "3" : "4";
  return `+222${prefix}${String(index).padStart(7, "0")}`;
}

function toEmail(phone) {
  return `${phone.slice(1)}@phone.indb.local`;
}

function genUsername(index) {
  return `user_${padIndex(index)}`;
}

function genName(index) {
  return `${pick(FIRST_NAMES, index, index % 7)} ${pick(LAST_NAMES, index, index % 11)}`;
}

function professionFor(index) {
  return PROFESSIONS[index % PROFESSIONS.length];
}

function languageFor(index) {
  return LANGUAGES[index % LANGUAGES.length];
}

function interestsFor(profession, index) {
  const base = INTERESTS_BY_PROFESSION[profession] ?? ["community", "culture", "education"];
  const cityWide = ["Nouadhibou", "fishing", "history", "sports", "entrepreneurship", "volunteering", "education"];
  return Array.from(new Set([...base, pick(cityWide, index, 2), pick(cityWide, index, 5)])).slice(0, 6);
}

function titleCase(value) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function quoteIdent(value) {
  return `"${value.replace(/"/g, '""')}"`;
}

function tableName(table) {
  return table.split(".").map(quoteIdent).join(".");
}

function buildInsert(table, columns, rows, options = {}) {
  if (rows.length === 0) return null;
  const colList = columns.map(quoteIdent).join(", ");
  const placeholders = rows
    .map((_, rowIndex) => `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(", ")})`)
    .join(", ");
  const values = rows.flatMap((row) => columns.map((column) => row[column] ?? null));
  let conflict = "ON CONFLICT DO NOTHING";

  if (options.conflictColumns?.length && options.update !== false) {
    const target = `(${options.conflictColumns.map(quoteIdent).join(", ")})`;
    const updateColumns = (options.updateColumns ?? columns.filter((column) => !options.conflictColumns.includes(column)));
    if (updateColumns.length > 0) {
      conflict = `ON CONFLICT ${target} DO UPDATE SET ${updateColumns.map((column) => `${quoteIdent(column)} = EXCLUDED.${quoteIdent(column)}`).join(", ")}`;
    }
  }

  return {
    text: `INSERT INTO ${tableName(table)} (${colList}) VALUES ${placeholders} ${conflict}`,
    values,
  };
}

async function batchInsert(table, columns, rows, label, options = {}) {
  if (rows.length === 0) {
    console.log(`  ${label}: 0 rows`);
    return 0;
  }
  let written = 0;
  for (let i = 0; i < rows.length; i += CONFIG.dbBatchSize) {
    const chunk = rows.slice(i, i + CONFIG.dbBatchSize);
    const stmt = buildInsert(table, columns, chunk, options);
    await query(stmt.text, stmt.values);
    written += chunk.length;
    process.stdout.write(".");
  }
  console.log(` ${written} ${label}`);
  return written;
}

async function getPublicColumns(table) {
  const { rows } = await query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = $1
    `,
    [table],
  );
  return new Set(rows.map((row) => row.column_name));
}

function columnsPresent(columns, available) {
  return columns.filter((column) => available.has(column));
}

async function ensureSeedInfrastructure() {
  console.log("\n=== Step 0: Ensuring seed infrastructure ===");
  await query(`alter table public.categories add column if not exists name_ff text`);
  await query(`alter table public.categories add column if not exists name_snk text`);
  await query(`alter table public.categories add column if not exists name_wo text`);
  await query(`
    create table if not exists public.recommendation_events (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.profiles(id) on delete cascade,
      event_type text not null,
      entity_type text not null,
      entity_id uuid not null,
      weight numeric(6, 3) not null default 1,
      source text not null default 'seed',
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `);
  await query(`create index if not exists recommendation_events_user_created_idx on public.recommendation_events(user_id, created_at desc)`);
  await query(`create index if not exists recommendation_events_entity_idx on public.recommendation_events(entity_type, entity_id)`);
  await query(`create index if not exists recommendation_events_type_created_idx on public.recommendation_events(event_type, created_at desc)`);
  await query(`alter table public.recommendation_events enable row level security`);
  await query(`
    do $$
    begin
      if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'recommendation_events'
          and policyname = 'Users can read own recommendation events'
      ) then
        create policy "Users can read own recommendation events"
          on public.recommendation_events for select
          to authenticated
          using (user_id = auth.uid());
      end if;
    end $$;
  `);
  console.log("  Infrastructure ready");
}

async function ensureCategories() {
  const categories = [
    ["community", "Community", "Communaute", "Mujtama", "Renndo", "Jamaane", "Mbooloo", "Users"],
    ["education", "Education", "Education", "Taaliim", "Janngde", "Xaran", "Jang", "BookOpen"],
    ["fishing", "Fishing", "Peche", "Sayd", "Njaaje", "Xotte", "Gaal", "Anchor"],
    ["environment", "Environment", "Environnement", "Bii-a", "Taariindi", "Keneya", "Suuf", "Leaf"],
    ["culture", "Culture", "Culture", "Thaqafa", "Aada", "Lada", "Cosaan", "Music"],
    ["business", "Business", "Commerce", "Tijara", "Jaayde", "Soodo", "Jula", "Store"],
    ["sports", "Sports", "Sports", "Riyada", "Fijirde", "Takkande", "Po", "Trophy"],
    ["health", "Health", "Sante", "Sihha", "Cellal", "Keneya", "Wergu-yaram", "HeartPulse"],
  ];
  const rows = categories.map(([slug, name_en, name_fr, name_ar, name_ff, name_snk, name_wo, icon], index) => ({
    slug,
    name_en,
    name_fr,
    name_ar,
    name_ff,
    name_snk,
    name_wo,
    icon,
    color: ["#0f766e", "#2563eb", "#0284c7", "#16a34a", "#c2410c", "#7c3aed", "#dc2626", "#0891b2"][index],
  }));
  await batchInsert(
    "categories",
    ["name_en", "name_fr", "name_ar", "name_ff", "name_snk", "name_wo", "slug", "icon", "color"],
    rows,
    "categories",
    { conflictColumns: ["slug"] },
  );
  const { rows: categoryRows } = await query(`select id, slug from public.categories order by id`);
  return categoryRows;
}

async function authAdminCall(fn, label) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await fn();
      if (!result?.error) return result;
      lastError = result.error;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 750));
  }
  throw new Error(`${label}: ${lastError?.message ?? lastError}`);
}

async function createAuthUsers() {
  console.log(`\n=== Step 1: Creating/updating ${CONFIG.totalUsers} auth users ===`);
  const wanted = Array.from({ length: CONFIG.totalUsers }, (_, index) => {
    const phone = genPhone(index);
    const profession = professionFor(index);
    const language = languageFor(index);
    return {
      index,
      phone,
      email: toEmail(phone),
      username: genUsername(index),
      name: genName(index),
      profession,
      language,
      area: pick(AREAS, index, 3),
      interests: interestsFor(profession, index),
    };
  });

  for (let i = 0; i < wanted.length; i += CONFIG.authBatchSize) {
    const batch = wanted.slice(i, i + CONFIG.authBatchSize);
    await Promise.all(batch.map(async (user) => {
      const metadata = {
        full_name: user.name,
        username: user.username,
        phone: user.phone,
        avatar_url: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.username)}`,
      };
      const { error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: CONFIG.testPassword,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: metadata,
      });
      if (error && !/already|registered|exists/i.test(error.message)) {
        throw new Error(`createUser ${user.email}: ${error.message}`);
      }
    }));
    process.stdout.write(`  auth create batch ${Math.floor(i / CONFIG.authBatchSize) + 1}/${Math.ceil(wanted.length / CONFIG.authBatchSize)}\n`);
    await new Promise((resolve) => setTimeout(resolve, CONFIG.authBatchDelayMs));
  }

  const emails = wanted.map((user) => user.email);
  const { rows } = await query(`select id, email from auth.users where email = any($1::text[])`, [emails]);
  const idByEmail = new Map(rows.map((row) => [row.email, row.id]));
  const users = wanted.map((user) => ({ ...user, userId: idByEmail.get(user.email) }));
  const missing = users.filter((user) => !user.userId);
  if (missing.length > 0) {
    throw new Error(`Auth users missing after creation: ${missing.slice(0, 5).map((user) => user.email).join(", ")}`);
  }

  for (let i = 0; i < users.length; i += CONFIG.authBatchSize) {
    const batch = users.slice(i, i + CONFIG.authBatchSize);
    await Promise.all(batch.map((user) => authAdminCall(
      () => supabase.auth.admin.updateUserById(user.userId, {
        password: CONFIG.testPassword,
        user_metadata: {
          full_name: user.name,
          username: user.username,
          phone: user.phone,
          avatar_url: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.username)}`,
        },
      }),
      `updateUserById ${user.email}`,
    )));
    process.stdout.write(`  auth update batch ${Math.floor(i / CONFIG.authBatchSize) + 1}/${Math.ceil(users.length / CONFIG.authBatchSize)}\n`);
    await new Promise((resolve) => setTimeout(resolve, CONFIG.authBatchDelayMs));
  }

  console.log(`  ${users.length} auth users ready`);
  return users;
}

async function seedProfiles(users) {
  console.log("\n=== Step 2: Profiles, interests, and hobbies ===");
  const available = await getPublicColumns("profiles");
  const possibleColumns = [
    "id",
    "full_name",
    "username",
    "avatar_url",
    "cover_image_url",
    "bio",
    "city",
    "hometown",
    "languages_spoken",
    "phone",
    "phone_verified",
    "role",
    "contribution_score",
    "onboarding_completed",
    "onboarding_completed_at",
    "language_preference",
    "created_at",
    "updated_at",
  ];
  const columns = columnsPresent(possibleColumns, available);
  const rows = users.map((user) => {
    const languageCodes = Array.from(new Set([user.language.code, "fr", "ar"]));
    const bio = `${titleCase(user.profession)} from ${user.area}. Interested in ${user.interests.slice(0, 3).join(", ")} and helping Nouadhibou neighbors connect.`;
    return {
      id: user.userId,
      full_name: user.name,
      username: user.username,
      avatar_url: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.username)}`,
      cover_image_url: `https://picsum.photos/seed/ndb-${user.username}/1200/360`,
      bio,
      city: user.area,
      hometown: "Nouadhibou",
      languages_spoken: languageCodes,
      phone: user.phone,
      phone_verified: true,
      role: user.index === 0 ? "admin" : user.profession === "community_leader" ? "contributor" : "member",
      contribution_score: 20 + ((user.index * 13) % 480),
      onboarding_completed: true,
      onboarding_completed_at: daysAgo(user.index, 60),
      language_preference: user.language.code,
      created_at: daysAgo(user.index, 180, 29),
      updated_at: daysAgo(user.index, 14, 11),
    };
  });
  await batchInsert("profiles", columns, rows, "profiles", { conflictColumns: ["id"] });

  const interestRows = [];
  const hobbyRows = [];
  for (const user of users) {
    for (const name of user.interests) {
      interestRows.push({
        id: stableUuid(`interest:${user.username}:${name}`),
        profile_id: user.userId,
        name,
        created_at: daysAgo(user.index, 120, 7),
      });
    }
    for (let i = 0; i < 2; i++) {
      const name = pick(HOBBIES, user.index, i * 3);
      hobbyRows.push({
        id: stableUuid(`hobby:${user.username}:${name}`),
        profile_id: user.userId,
        name,
        created_at: daysAgo(user.index + i, 120, 9),
      });
    }
  }
  await batchInsert("profile_interests", ["id", "profile_id", "name", "created_at"], interestRows, "profile interests", {
    conflictColumns: ["profile_id", "name"],
    update: false,
  });
  await batchInsert("profile_hobbies", ["id", "profile_id", "name", "created_at"], hobbyRows, "profile hobbies", {
    conflictColumns: ["profile_id", "name"],
    update: false,
  });
}

function postTitle(topic, index) {
  const area = pick(AREAS, index);
  const templates = {
    "daily life": `Morning notes from ${area}`,
    fishing: `Fishing update near ${area}`,
    business: `Small business idea in ${area}`,
    education: `School support needed in ${area}`,
    "community issues": `Community concern around ${area}`,
    "youth activities": `Youth activity this week in ${area}`,
    sports: `Local sports weekend in ${area}`,
    environment: `Clean coast effort near ${area}`,
    culture: `Culture night in ${area}`,
  };
  return templates[topic] ?? `Community update ${index + 1}`;
}

function postContent(topic, index, author) {
  const area = pick(AREAS, index, 2);
  const details = {
    "daily life": `People in ${area} are sharing practical updates about transport, markets, and family routines today.`,
    fishing: `Fishers at the port discussed weather, safety, and fair prices before the next tide.`,
    business: `Several neighbors are testing ways to help small shops, home businesses, and young sellers find customers.`,
    education: `Parents and teachers are coordinating books, uniforms, revision groups, and exam encouragement.`,
    "community issues": `Residents raised a local concern and are comparing simple actions that can be handled together.`,
    "youth activities": `Young people are organizing training, sports, and volunteer time so weekends feel more useful.`,
    sports: `A friendly match brought families together and gave local teams a reason to train harder.`,
    environment: `Volunteers want cleaner streets and beaches, with a focus on plastic, safe bins, and awareness.`,
    culture: `Neighbors are sharing songs, tea, stories, and memories that make Nouadhibou feel like home.`,
  };
  return `${details[topic]} ${author.name} added this from the perspective of a ${titleCase(author.profession)}.`;
}

async function seedPosts(users, categoryRows) {
  console.log(`\n=== Step 3: ${CONFIG.totalPosts} posts ===`);
  const categoryIds = categoryRows.map((row) => row.id);
  const posts = [];
  for (let i = 0; i < CONFIG.totalPosts; i++) {
    const topic = pick(POST_TOPICS, i);
    const author = users[(i * 7 + 3) % users.length];
    posts.push({
      id: stableUuid(`post:${i}`),
      author_id: author.userId,
      category_id: categoryIds.length ? categoryIds[i % categoryIds.length] : null,
      type: pick(POST_TYPES, i),
      title: postTitle(topic, i),
      content: postContent(topic, i, author),
      content_language: author.language.code,
      status: "published",
      language: "auto",
      likes_count: 0,
      comments_count: 0,
      saves_count: 0,
      shares_count: 2 + ((i * 5) % 38),
      created_at: daysAgo(i, 75, 13),
      updated_at: daysAgo(i, 45, 17),
    });
  }
  await batchInsert(
    "posts",
    ["id", "author_id", "category_id", "type", "title", "content", "content_language", "status", "language", "likes_count", "comments_count", "saves_count", "shares_count", "created_at", "updated_at"],
    posts,
    "posts",
    { conflictColumns: ["id"] },
  );
  return posts;
}

function memoryTitle(topic, index) {
  const area = pick(AREAS, index, 4);
  const year = 1965 + (index % 55);
  return `${topic} in ${area}, ${year}`;
}

function memoryDescription(topic, index, contributor) {
  const area = pick(AREAS, index, 7);
  return `${contributor.name} remembers ${area} through ${topic.toLowerCase()}: neighbors greeting each other, long tea conversations, port sounds, school uniforms, family visits, and the city changing year by year.`;
}

async function seedMemories(users) {
  console.log(`\n=== Step 4: ${CONFIG.totalMemories} memories ===`);
  const memories = [];
  for (let i = 0; i < CONFIG.totalMemories; i++) {
    const topic = pick(MEMORY_TOPICS, i);
    const contributor = users[(i * 11 + 5) % users.length];
    const year = 1960 + (i % 64);
    memories.push({
      id: stableUuid(`memory:${i}`),
      contributor_id: contributor.userId,
      title: memoryTitle(topic, i),
      description: memoryDescription(topic, i, contributor),
      content_language: contributor.language.code,
      decade: `${Math.floor(year / 10) * 10}s`,
      year,
      location: pick(AREAS, i, 1),
      category: pick(MEMORY_CATEGORIES, i),
      media_type: "image",
      verification_status: "approved",
      tags: [topic.toLowerCase(), pick(["port", "school", "family", "ramadan", "fishing", "tradition"], i), pick(AREAS, i).toLowerCase()],
      shares_count: 1 + ((i * 3) % 21),
      reactions_count: 0,
      comments_count: 0,
      saves_count: 0,
      created_at: daysAgo(i, 365, 19),
      updated_at: daysAgo(i, 180, 23),
    });
  }
  await batchInsert(
    "memories",
    ["id", "contributor_id", "title", "description", "content_language", "decade", "year", "location", "category", "media_type", "verification_status", "tags", "shares_count", "reactions_count", "comments_count", "saves_count", "created_at", "updated_at"],
    memories,
    "memories",
    { conflictColumns: ["id"] },
  );
  return memories;
}

function ideaStatus(index) {
  if (index < 75) return "completed";
  if (index < 150) return "in_progress";
  if (index < 265) return "discussion";
  if (index < 380) return "interested";
  if (index < 440) return "archived";
  return "published";
}

function ideaTitle(topic, index) {
  const area = pick(AREAS, index, 5);
  const templates = {
    Education: `After-school study circle in ${area}`,
    Environment: `Neighborhood cleanup route for ${area}`,
    "Youth development": `Youth skills club in ${area}`,
    "Public spaces": `Safer public space near ${area}`,
    "Local economy": `Local sellers map for ${area}`,
    Volunteering: `Volunteer rota for families in ${area}`,
    Culture: `Culture and memory evening in ${area}`,
    Tourism: `Community tourism walk through ${area}`,
  };
  return templates[topic] ?? `${topic} idea for ${area}`;
}

function ideaDescription(topic, index, author) {
  return `${author.name} proposes a ${topic.toLowerCase()} project with clear roles, small volunteer teams, and visible outcomes for residents. The idea is designed to be practical, low cost, and easy to discuss before launch.`;
}

async function seedIdeas(users, categoryRows) {
  console.log(`\n=== Step 5: ${CONFIG.totalIdeas} ideas ===`);
  const categoryIds = categoryRows.map((row) => row.id);
  const ideas = [];
  for (let i = 0; i < CONFIG.totalIdeas; i++) {
    const topic = pick(IDEA_TOPICS, i);
    const author = users[(i * 13 + 9) % users.length];
    ideas.push({
      id: stableUuid(`idea:${i}`),
      author_id: author.userId,
      title: ideaTitle(topic, i),
      content_language: author.language.code,
      description: ideaDescription(topic, i, author),
      category_id: categoryIds.length ? categoryIds[(i + 1) % categoryIds.length] : null,
      status: ideaStatus(i),
      votes_count: 0,
      shares_count: 1 + ((i * 7) % 42),
      supporters_count: 0,
      participants_count: 0,
      created_at: daysAgo(i, 90, 31),
      updated_at: daysAgo(i, 45, 37),
    });
  }
  await batchInsert(
    "ideas",
    ["id", "author_id", "title", "content_language", "description", "category_id", "status", "votes_count", "shares_count", "supporters_count", "participants_count", "created_at", "updated_at"],
    ideas,
    "ideas",
    { conflictColumns: ["id"] },
  );
  return ideas;
}

function fadlaStatus(index) {
  if (index < CONFIG.completedFadla) return "completed";
  if (index < CONFIG.completedFadla + CONFIG.activeFadlaRequests) return "requested";
  return "published";
}

function fadlaTitle(category, index) {
  const item = pick(FADLA_CATEGORY_LABELS[category], index, 2);
  return `${titleCase(item)} available in ${pick(AREAS, index, 6)}`;
}

function fadlaDescription(category, index, owner) {
  return `${owner.name} is sharing this ${category.replace("_", " ")} item for a neighbor who can use it. Pickup is simple and the item is described honestly for a smooth Graatek exchange.`;
}

async function seedFadla(users) {
  console.log(`\n=== Step 6: ${CONFIG.totalFadla} Graatek/Fadla items ===`);
  const shares = [];
  for (let i = 0; i < CONFIG.totalFadla; i++) {
    const category = pick(FADLA_CATEGORIES, i);
    const owner = users[(i * 17 + 4) % users.length];
    const status = fadlaStatus(i);
    const completedAt = status === "completed" ? daysAgo(i, 25, 41) : null;
    shares.push({
      id: stableUuid(`fadla:${i}`),
      owner_id: owner.userId,
      title: fadlaTitle(category, i),
      description: fadlaDescription(category, i, owner),
      content_language: owner.language.code,
      category,
      condition: pick(FADLA_CONDITIONS, i),
      location: pick(AREAS, i, 8),
      quantity: 1 + (i % 4),
      urgency_level: pick(URGENCY_LEVELS, i),
      status,
      images: JSON.stringify([]),
      shares_count: i % 19,
      completed_at: completedAt,
      archived_at: null,
      accepted_request_id: status === "completed" ? stableUuid(`fadla-request:${i}:accepted`) : null,
      receiver_confirmed_at: completedAt,
      sender_confirmed_at: completedAt,
      created_at: daysAgo(i, 80, 43),
      updated_at: daysAgo(i, 35, 47),
    });
  }
  const available = await getPublicColumns("community_shares");
  const columns = columnsPresent(
    ["id", "owner_id", "title", "description", "content_language", "category", "condition", "location", "quantity", "urgency_level", "status", "images", "shares_count", "completed_at", "archived_at", "accepted_request_id", "receiver_confirmed_at", "sender_confirmed_at", "created_at", "updated_at"],
    available,
  );
  await batchInsert("community_shares", columns, shares, "Graatek items", { conflictColumns: ["id"] });
  return shares;
}

function otherUser(users, baseIndex, disallowId) {
  for (let offset = 1; offset < users.length; offset++) {
    const user = users[(baseIndex + offset) % users.length];
    if (user.userId !== disallowId) return user;
  }
  throw new Error("Could not find alternate user");
}

async function seedPostInteractions(users, posts) {
  console.log("\n=== Step 7: Post reactions, comments, shares, and saves ===");
  const comments = [];
  const reactions = [];
  const saves = [];
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const commentCount = 3 + (i % 5);
    const reactionCount = 6 + (i % 11);
    const saveCount = 1 + (i % 5);
    for (let c = 0; c < commentCount; c++) {
      const author = otherUser(users, i * 19 + c * 7, post.author_id);
      comments.push({
        id: stableUuid(`post-comment:${i}:${c}`),
        post_id: post.id,
        author_id: author.userId,
        content: `I noticed this too in ${pick(AREAS, i, c)}. ${titleCase(author.profession)} neighbors can help with a practical next step.`,
        content_language: author.language.code,
        status: "published",
        created_at: daysAgo(i + c, 40, 5 + c),
        updated_at: daysAgo(i + c, 40, 6 + c),
      });
    }
    for (let r = 0; r < reactionCount; r++) {
      const user = otherUser(users, i * 23 + r * 11, post.author_id);
      reactions.push({
        id: stableUuid(`post-reaction:${i}:${user.userId}`),
        post_id: post.id,
        user_id: user.userId,
        reaction_type: pick(REACTION_TYPES, i, r),
        created_at: daysAgo(i + r, 30, 3 + r),
        updated_at: daysAgo(i + r, 30, 4 + r),
      });
    }
    for (let s = 0; s < saveCount; s++) {
      const user = otherUser(users, i * 29 + s * 13, post.author_id);
      saves.push({
        id: stableUuid(`post-save:${i}:${user.userId}`),
        post_id: post.id,
        user_id: user.userId,
        created_at: daysAgo(i + s, 35, 8 + s),
      });
    }
  }
  await batchInsert("comments", ["id", "post_id", "author_id", "content", "content_language", "status", "created_at", "updated_at"], comments, "post comments", { conflictColumns: ["id"] });
  await batchInsert("post_reactions", ["id", "post_id", "user_id", "reaction_type", "created_at", "updated_at"], reactions, "post reactions", { conflictColumns: ["post_id", "user_id"] });
  await batchInsert("saved_posts", ["id", "post_id", "user_id", "created_at"], saves, "saved posts", { conflictColumns: ["post_id", "user_id"], update: false });
  await query(`
    update public.posts p
    set
      likes_count = (select count(*)::int from public.post_reactions r where r.post_id = p.id),
      comments_count = (select count(*)::int from public.comments c where c.post_id = p.id and c.status = 'published'),
      saves_count = (select count(*)::int from public.saved_posts s where s.post_id = p.id)
    where p.id = any($1::uuid[])
  `, [posts.map((post) => post.id)]);
  return { comments, reactions, saves };
}

async function seedMemoryInteractions(users, memories) {
  console.log("\n=== Step 8: Memory comments, reactions, and saves ===");
  const comments = [];
  const reactions = [];
  const saves = [];
  for (let i = 0; i < memories.length; i++) {
    const memory = memories[i];
    const commentCount = 2 + (i % 5);
    const reactionCount = 5 + (i % 9);
    const saveCount = 3 + (i % 6);
    for (let c = 0; c < commentCount; c++) {
      const author = otherUser(users, i * 31 + c * 7, memory.contributor_id);
      comments.push({
        id: stableUuid(`memory-comment:${i}:${c}`),
        memory_id: memory.id,
        author_id: author.userId,
        content: `This memory reminds my family of ${pick(AREAS, i, c)} and the way neighbors supported each other.`,
        content_language: author.language.code,
        created_at: daysAgo(i + c, 120, 15 + c),
        updated_at: daysAgo(i + c, 100, 17 + c),
      });
    }
    for (let r = 0; r < reactionCount; r++) {
      const user = otherUser(users, i * 37 + r * 5, memory.contributor_id);
      reactions.push({
        id: stableUuid(`memory-reaction:${i}:${user.userId}`),
        memory_id: memory.id,
        user_id: user.userId,
        reaction_type: pick(REACTION_TYPES, i, r),
        created_at: daysAgo(i + r, 90, 9 + r),
        updated_at: daysAgo(i + r, 80, 11 + r),
      });
    }
    for (let s = 0; s < saveCount; s++) {
      const user = otherUser(users, i * 41 + s * 13, memory.contributor_id);
      saves.push({
        id: stableUuid(`memory-save:${i}:${user.userId}`),
        memory_id: memory.id,
        user_id: user.userId,
        created_at: daysAgo(i + s, 150, 13 + s),
      });
    }
  }
  await batchInsert("memory_comments", ["id", "memory_id", "author_id", "content", "content_language", "created_at", "updated_at"], comments, "memory comments", { conflictColumns: ["id"] });
  await batchInsert("memory_reactions", ["id", "memory_id", "user_id", "reaction_type", "created_at", "updated_at"], reactions, "memory reactions", { conflictColumns: ["memory_id", "user_id"] });
  await batchInsert("saved_memories", ["id", "memory_id", "user_id", "created_at"], saves, "saved memories", { conflictColumns: ["memory_id", "user_id"], update: false });
  await query(`
    update public.memories m
    set
      reactions_count = (select count(*)::int from public.memory_reactions r where r.memory_id = m.id),
      comments_count = (select count(*)::int from public.memory_comments c where c.memory_id = m.id),
      saves_count = (select count(*)::int from public.saved_memories s where s.memory_id = m.id)
    where m.id = any($1::uuid[])
  `, [memories.map((memory) => memory.id)]);
  return { comments, reactions, saves };
}

async function seedIdeaInteractions(users, ideas) {
  console.log("\n=== Step 9: Idea supporters, participants, comments, and discussions ===");
  const votes = [];
  const supporters = [];
  const participants = [];
  const comments = [];
  const messages = [];
  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i];
    const isTrending = i < 60;
    const voteCount = isTrending ? 45 + (i % 36) : 7 + (i % 21);
    const supportCount = isTrending ? 28 + (i % 23) : 4 + (i % 14);
    const participantCount = idea.status === "archived" ? 1 + (i % 2) : 2 + (i % 5);
    const commentCount = 2 + (i % 4);
    for (let v = 0; v < voteCount; v++) {
      const user = otherUser(users, i * 43 + v * 7, idea.author_id);
      votes.push({
        id: stableUuid(`idea-vote:${i}:${user.userId}`),
        idea_id: idea.id,
        user_id: user.userId,
        created_at: daysAgo(i + v, 70, 7 + v),
      });
    }
    for (let s = 0; s < supportCount; s++) {
      const user = otherUser(users, i * 47 + s * 5, idea.author_id);
      supporters.push({
        id: stableUuid(`idea-support:${i}:${user.userId}`),
        idea_id: idea.id,
        user_id: user.userId,
        created_at: daysAgo(i + s, 60, 5 + s),
      });
    }
    const participantUsers = [];
    for (let p = 0; p < participantCount; p++) {
      const user = otherUser(users, i * 53 + p * 11, idea.author_id);
      participantUsers.push(user);
      participants.push({
        id: stableUuid(`idea-participant:${i}:${user.userId}`),
        idea_id: idea.id,
        user_id: user.userId,
        status: idea.status === "archived" && p === 0 ? "declined" : "accepted",
        message: `I can help with ${pick(["coordination", "materials", "outreach", "translation", "transport"], i, p)}.`,
        created_at: daysAgo(i + p, 45, 3 + p),
      });
    }
    for (let c = 0; c < commentCount; c++) {
      const author = otherUser(users, i * 59 + c * 13, idea.author_id);
      comments.push({
        id: stableUuid(`idea-comment:${i}:${c}`),
        idea_id: idea.id,
        author_id: author.userId,
        content: `This would work better if ${pick(["schools", "families", "shop owners", "youth groups", "volunteers"], i, c)} are included early.`,
        content_language: author.language.code,
        created_at: daysAgo(i + c, 55, 11 + c),
        updated_at: daysAgo(i + c, 50, 13 + c),
      });
    }
    const discussionCount = idea.status === "published" ? 1 : 3 + (i % 5);
    const discussants = [users.find((user) => user.userId === idea.author_id), ...participantUsers].filter(Boolean);
    for (let m = 0; m < discussionCount; m++) {
      const sender = discussants[m % discussants.length];
      messages.push({
        id: stableUuid(`idea-message:${i}:${m}`),
        idea_id: idea.id,
        sender_id: sender.userId,
        message: `Next step ${m + 1}: confirm ${pick(["place", "time", "materials", "volunteers", "permissions"], i, m)} and share an update.`,
        created_at: daysAgo(i + m, 35, 19 + m),
      });
    }
  }
  await batchInsert("idea_votes", ["id", "idea_id", "user_id", "created_at"], votes, "idea votes", { conflictColumns: ["idea_id", "user_id"], update: false });
  await batchInsert("idea_supporters", ["id", "idea_id", "user_id", "created_at"], supporters, "idea supporters", { conflictColumns: ["idea_id", "user_id"], update: false });
  await batchInsert("idea_participants", ["id", "idea_id", "user_id", "status", "message", "created_at"], participants, "idea participants", { conflictColumns: ["idea_id", "user_id"] });
  await batchInsert("idea_comments", ["id", "idea_id", "author_id", "content", "content_language", "created_at", "updated_at"], comments, "idea comments", { conflictColumns: ["id"] });
  await batchInsert("idea_messages", ["id", "idea_id", "sender_id", "message", "created_at"], messages, "idea messages", { conflictColumns: ["id"] });
  await query(`
    update public.ideas i
    set
      votes_count = (select count(*)::int from public.idea_votes v where v.idea_id = i.id),
      supporters_count = (select count(*)::int from public.idea_supporters s where s.idea_id = i.id),
      participants_count = (select count(*)::int from public.idea_participants p where p.idea_id = i.id and p.status = 'accepted')
    where i.id = any($1::uuid[])
  `, [ideas.map((idea) => idea.id)]);
  return { votes, supporters, participants, comments, messages };
}

async function seedFadlaWorkflows(users, shares) {
  console.log("\n=== Step 10: Graatek requests, acceptances, discussions, completions ===");
  const requests = [];
  const messages = [];
  for (let i = 0; i < shares.length; i++) {
    const share = shares[i];
    if (share.status === "published") continue;
    const requester = otherUser(users, i * 61 + 7, share.owner_id);
    const requestId = share.status === "completed" ? stableUuid(`fadla-request:${i}:accepted`) : stableUuid(`fadla-request:${i}:pending`);
    requests.push({
      id: requestId,
      share_id: share.id,
      requester_id: requester.userId,
      message: `I can collect this for my family in ${pick(AREAS, i, 2)}. Thank you for sharing.`,
      status: share.status === "completed" ? "accepted" : "pending",
      collected_at: share.status === "completed" ? share.completed_at : null,
      handed_over_at: share.status === "completed" ? share.completed_at : null,
      created_at: daysAgo(i, 50, 17),
      updated_at: daysAgo(i, 30, 23),
    });
    const discussionCount = share.status === "completed" ? 4 : 2;
    for (let m = 0; m < discussionCount; m++) {
      const senderId = m % 2 === 0 ? share.owner_id : requester.userId;
      messages.push({
        id: stableUuid(`fadla-message:${i}:${m}`),
        share_id: share.id,
        request_id: requestId,
        sender_id: senderId,
        message: pick([
          "Is tomorrow afternoon good for pickup?",
          "Yes, I will keep it ready near the main road.",
          "Thank you, I will send a message when I arrive.",
          "Collected successfully. May it be useful.",
          "Can you confirm the size before I come?",
        ], i, m),
        created_at: daysAgo(i + m, 25, 29 + m),
      });
    }
    if (i < CONFIG.completedFadla && i % 3 === 0) {
      const declined = otherUser(users, i * 67 + 13, share.owner_id);
      requests.push({
        id: stableUuid(`fadla-request:${i}:declined`),
        share_id: share.id,
        requester_id: declined.userId,
        message: "If it is still available later, I am interested.",
        status: "declined",
        collected_at: null,
        handed_over_at: null,
        created_at: daysAgo(i, 55, 31),
        updated_at: daysAgo(i, 31, 37),
      });
    }
  }
  const requestColumns = columnsPresent(
    ["id", "share_id", "requester_id", "message", "status", "collected_at", "handed_over_at", "created_at", "updated_at"],
    await getPublicColumns("community_share_requests"),
  );
  await batchInsert("community_share_requests", requestColumns, requests, "Graatek requests", { update: false });
  await batchInsert("fadla_request_messages", ["id", "share_id", "request_id", "sender_id", "message", "created_at"], messages, "Graatek discussion messages", { conflictColumns: ["id"] });
  return { requests, messages };
}

async function seedSocialGraph(users) {
  console.log("\n=== Step 11: Social graph follows and friendships ===");
  const rows = [];
  const offsets = [1, 2, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377];
  for (let i = 0; i < users.length; i++) {
    for (const offset of offsets) {
      const target = users[(i + offset) % users.length];
      rows.push({
        id: stableUuid(`follow:${users[i].userId}:${target.userId}`),
        follower_id: users[i].userId,
        following_id: target.userId,
        created_at: daysAgo(i + offset, 120, offset % 59),
      });
    }
    if (i % 5 === 0) {
      const friend = users[(i + 250) % users.length];
      rows.push({
        id: stableUuid(`follow:${users[i].userId}:${friend.userId}`),
        follower_id: users[i].userId,
        following_id: friend.userId,
        created_at: daysAgo(i, 110, 17),
      });
      rows.push({
        id: stableUuid(`follow:${friend.userId}:${users[i].userId}`),
        follower_id: friend.userId,
        following_id: users[i].userId,
        created_at: daysAgo(i, 109, 19),
      });
    }
  }
  await batchInsert("user_follows", ["id", "follower_id", "following_id", "created_at"], rows, "follows/friendships", {
    conflictColumns: ["follower_id", "following_id"],
    update: false,
  });
  return rows;
}

function entityForNotification(type, index, pools) {
  if (type.startsWith("fadla")) return { entity_type: "community_share", entity_id: pools.shares[index % pools.shares.length].id };
  if (type.startsWith("idea")) return { entity_type: "idea", entity_id: pools.ideas[index % pools.ideas.length].id };
  if (type.startsWith("memory")) return { entity_type: "memory", entity_id: pools.memories[index % pools.memories.length].id };
  if (type === "follow") return { entity_type: "profile", entity_id: pools.users[(index * 7) % pools.users.length].userId };
  return { entity_type: "post", entity_id: pools.posts[index % pools.posts.length].id };
}

async function seedNotifications(users, posts, memories, ideas, shares) {
  console.log(`\n=== Step 12: ${CONFIG.totalNotifications} notifications ===`);
  const types = [
    "comment",
    "reaction",
    "follow",
    "fadla_request",
    "fadla_request_accepted",
    "fadla_completed",
    "idea_support",
    "idea_comment",
    "idea_participate_request",
    "idea_status_change",
    "memory_comment",
    "memory_reaction",
  ];
  const pools = { users, posts, memories, ideas, shares };
  const rows = [];
  for (let i = 0; i < CONFIG.totalNotifications; i++) {
    const type = pick(types, i);
    const user = users[i % users.length];
    const actor = otherUser(users, i * 71 + 11, user.userId);
    const entity = entityForNotification(type, i, pools);
    rows.push({
      id: stableUuid(`notification:${i}`),
      user_id: user.userId,
      actor_id: actor.userId,
      type,
      entity_type: entity.entity_type,
      entity_id: entity.entity_id,
      title: titleCase(type),
      message: `${actor.name} created a ${type.replace(/_/g, " ")} update in I Love NDB.`,
      read: i >= 1500 || i % 4 !== 0,
      metadata: JSON.stringify({
        seed: CONFIG.seedNamespace,
        actorName: actor.name,
        actorArea: actor.area,
        notificationNumber: i + 1,
      }),
      created_at: daysAgo(i, 30, 2 + (i % 47)),
    });
  }
  await batchInsert(
    "notifications",
    ["id", "user_id", "actor_id", "type", "entity_type", "entity_id", "title", "message", "read", "metadata", "created_at"],
    rows,
    "notifications",
    { conflictColumns: ["id"] },
  );
  return rows;
}

async function seedRecommendationEvents(users, posts, memories, ideas, shares, interactions, socialRows) {
  console.log("\n=== Step 13: Recommendation event history ===");
  const events = [];
  for (let u = 0; u < users.length; u++) {
    const user = users[u];
    for (let v = 0; v < 40; v++) {
      const post = posts[(u * 17 + v * 7) % posts.length];
      events.push({
        id: stableUuid(`event:view:${user.userId}:${post.id}:${v}`),
        user_id: user.userId,
        event_type: "post_view",
        entity_type: "post",
        entity_id: post.id,
        weight: "0.200",
        source: "seed",
        metadata: JSON.stringify({ dwellSeconds: 5 + ((u + v) % 80), topic: pick(POST_TOPICS, u, v) }),
        created_at: daysAgo(u + v, 45, 3 + v),
      });
    }
  }

  const addInteractionEvents = (rows, eventType, entityType, idColumn, userColumn, weight) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      events.push({
        id: stableUuid(`event:${eventType}:${row[userColumn]}:${row[idColumn]}:${i}`),
        user_id: row[userColumn],
        event_type: eventType,
        entity_type: entityType,
        entity_id: row[idColumn],
        weight,
        source: "seed",
        metadata: JSON.stringify({ sourceTable: eventType }),
        created_at: row.created_at ?? daysAgo(i, 60),
      });
    }
  };

  addInteractionEvents(interactions.post.reactions, "post_like", "post", "post_id", "user_id", "1.000");
  addInteractionEvents(interactions.post.comments, "post_comment", "post", "post_id", "author_id", "2.000");
  addInteractionEvents(interactions.memory.saves, "memory_save", "memory", "memory_id", "user_id", "1.500");
  addInteractionEvents(interactions.memory.reactions, "memory_reaction", "memory", "memory_id", "user_id", "1.000");
  addInteractionEvents(interactions.idea.supporters, "idea_support", "idea", "idea_id", "user_id", "1.750");
  addInteractionEvents(interactions.idea.participants, "idea_join", "idea", "idea_id", "user_id", "2.500");
  addInteractionEvents(interactions.fadla.requests, "fadla_request", "community_share", "share_id", "requester_id", "2.250");

  for (let i = 0; i < Math.min(socialRows.length, 4000); i++) {
    const follow = socialRows[i];
    events.push({
      id: stableUuid(`event:follow:${follow.follower_id}:${follow.following_id}`),
      user_id: follow.follower_id,
      event_type: "follow",
      entity_type: "profile",
      entity_id: follow.following_id,
      weight: "0.900",
      source: "seed",
      metadata: JSON.stringify({ relationship: "follow" }),
      created_at: follow.created_at,
    });
  }

  await batchInsert(
    "recommendation_events",
    ["id", "user_id", "event_type", "entity_type", "entity_id", "weight", "source", "metadata", "created_at"],
    events,
    "recommendation events",
    { conflictColumns: ["id"] },
  );
  return events;
}

async function collectSummary(users, posts, memories, ideas, shares, interactions, notifications, recommendationEvents, socialRows) {
  const scalar = async (sql, params = []) => {
    const { rows } = await query(sql, params);
    return Number(rows[0]?.value ?? 0);
  };
  const userIds = users.map((user) => user.userId);
  const postIds = posts.map((post) => post.id);
  const memoryIds = memories.map((memory) => memory.id);
  const ideaIds = ideas.map((idea) => idea.id);
  const shareIds = shares.map((share) => share.id);
  const notificationIds = notifications.map((notification) => notification.id);

  const [
    usersCreated,
    postsCreated,
    memoriesCreated,
    ideasCreated,
    sharesCreated,
    completedGraatek,
    activeGraatek,
    availableGraatek,
    notificationsCreated,
    isolatedUsers,
    mutualFollows,
    databaseSize,
  ] = await Promise.all([
    scalar(`select count(*) as value from public.profiles where id = any($1::uuid[])`, [userIds]),
    scalar(`select count(*) as value from public.posts where id = any($1::uuid[])`, [postIds]),
    scalar(`select count(*) as value from public.memories where id = any($1::uuid[])`, [memoryIds]),
    scalar(`select count(*) as value from public.ideas where id = any($1::uuid[])`, [ideaIds]),
    scalar(`select count(*) as value from public.community_shares where id = any($1::uuid[])`, [shareIds]),
    scalar(`select count(*) as value from public.community_shares where id = any($1::uuid[]) and status = 'completed'`, [shareIds]),
    scalar(`select count(*) as value from public.community_shares where id = any($1::uuid[]) and status = 'requested'`, [shareIds]),
    scalar(`select count(*) as value from public.community_shares where id = any($1::uuid[]) and status = 'published'`, [shareIds]),
    scalar(`select count(*) as value from public.notifications where id = any($1::uuid[])`, [notificationIds]),
    scalar(`
      select count(*) as value
      from public.profiles p
      where p.id = any($1::uuid[])
        and not exists (select 1 from public.user_follows uf where uf.follower_id = p.id or uf.following_id = p.id)
    `, [userIds]),
    scalar(`
      select count(*) as value
      from public.user_follows a
      join public.user_follows b on b.follower_id = a.following_id and b.following_id = a.follower_id
      where a.follower_id = any($1::uuid[])
    `, [userIds]),
    query(`select pg_database_size(current_database()) as value`).then((result) => Number(result.rows[0]?.value ?? 0)),
  ]);

  const totalInteractions =
    interactions.post.comments.length +
    interactions.post.reactions.length +
    interactions.post.saves.length +
    interactions.memory.comments.length +
    interactions.memory.reactions.length +
    interactions.memory.saves.length +
    interactions.idea.votes.length +
    interactions.idea.supporters.length +
    interactions.idea.participants.length +
    interactions.idea.comments.length +
    interactions.idea.messages.length +
    interactions.fadla.requests.length +
    interactions.fadla.messages.length +
    socialRows.length +
    recommendationEvents.length;

  const readiness = {
    users_5000: completedGraatek >= 200 && activeGraatek >= 150 && notificationsCreated >= 5000 && isolatedUsers === 0
      ? "Ready for controlled 5,000-user beta with continued query monitoring."
      : "Needs data or query fixes before a 5,000-user beta.",
    users_50000: "Directionally ready in data shape, but 50,000 users still needs production load testing, connection pooling review, and pg_stat_statements monitoring.",
    recommendation_engine: recommendationEvents.length >= 30000
      ? "Ready for first-pass personalized feeds, trending scores, and TikTok-style ranking experiments."
      : "Needs more event history before recommendation experiments.",
  };

  const summary = {
    generatedAt: new Date().toISOString(),
    config: CONFIG,
    sampleCredentials: {
      email: toEmail(genPhone(1)),
      password: CONFIG.testPassword,
      adminEmail: toEmail(genPhone(0)),
    },
    created: {
      users: usersCreated,
      graatek: sharesCreated,
      memories: memoriesCreated,
      posts: postsCreated,
      ideas: ideasCreated,
      interactions: totalInteractions,
      notifications: notificationsCreated,
      recommendationEvents: recommendationEvents.length,
    },
    graatekWorkflow: {
      completed: completedGraatek,
      activeRequests: activeGraatek,
      availableItems: availableGraatek,
      requestRows: interactions.fadla.requests.length,
      discussionMessages: interactions.fadla.messages.length,
    },
    socialGraph: {
      follows: socialRows.length,
      mutualFollowRows: mutualFollows,
      isolatedUsers,
    },
    ideaLifecycle: {
      acceptedMappedToInProgressOrCompleted: ideas.filter((idea) => ["in_progress", "completed"].includes(idea.status)).length,
      rejectedMappedToArchived: ideas.filter((idea) => idea.status === "archived").length,
      trendingIdeas: 60,
    },
    database: {
      sizeBytes: databaseSize,
      sizeMB: Number((databaseSize / 1024 / 1024).toFixed(2)),
    },
    readiness,
  };

  fs.writeFileSync(path.join(ROOT, "seed-summary.json"), JSON.stringify(summary, null, 2));
  return summary;
}

function assertSummary(summary) {
  const failures = [];
  if (summary.created.users < CONFIG.totalUsers) failures.push(`users ${summary.created.users}/${CONFIG.totalUsers}`);
  if (summary.created.graatek < CONFIG.totalFadla) failures.push(`Graatek ${summary.created.graatek}/${CONFIG.totalFadla}`);
  if (summary.created.memories < CONFIG.totalMemories) failures.push(`memories ${summary.created.memories}/${CONFIG.totalMemories}`);
  if (summary.created.posts < CONFIG.totalPosts) failures.push(`posts ${summary.created.posts}/${CONFIG.totalPosts}`);
  if (summary.created.ideas < CONFIG.totalIdeas) failures.push(`ideas ${summary.created.ideas}/${CONFIG.totalIdeas}`);
  if (summary.created.notifications < CONFIG.totalNotifications) failures.push(`notifications ${summary.created.notifications}/${CONFIG.totalNotifications}`);
  if (summary.graatekWorkflow.completed < CONFIG.completedFadla) failures.push(`completed Graatek ${summary.graatekWorkflow.completed}/${CONFIG.completedFadla}`);
  if (summary.graatekWorkflow.activeRequests < CONFIG.activeFadlaRequests) failures.push(`active Graatek ${summary.graatekWorkflow.activeRequests}/${CONFIG.activeFadlaRequests}`);
  if (summary.graatekWorkflow.availableItems < CONFIG.availableFadla) failures.push(`available Graatek ${summary.graatekWorkflow.availableItems}/${CONFIG.availableFadla}`);
  if (summary.socialGraph.isolatedUsers !== 0) failures.push(`${summary.socialGraph.isolatedUsers} isolated users`);
  if (summary.created.recommendationEvents < 30000) failures.push(`recommendation events ${summary.created.recommendationEvents}/30000`);
  if (failures.length > 0) throw new Error(`Seed validation failed: ${failures.join("; ")}`);
}

async function main() {
  const startedAt = Date.now();
  console.log("I Love NDB living-city seed");
  console.log(`Targets: ${CONFIG.totalUsers} users, ${CONFIG.totalPosts} posts, ${CONFIG.totalMemories} memories, ${CONFIG.totalIdeas} ideas, ${CONFIG.totalFadla} Graatek items, ${CONFIG.totalNotifications} notifications`);

  try {
    await ensureSeedInfrastructure();
    const categories = await ensureCategories();
    const users = await createAuthUsers();
    await seedProfiles(users);
    const posts = await seedPosts(users, categories);
    const memories = await seedMemories(users);
    const ideas = await seedIdeas(users, categories);
    const shares = await seedFadla(users);

    const post = await seedPostInteractions(users, posts);
    const memory = await seedMemoryInteractions(users, memories);
    const idea = await seedIdeaInteractions(users, ideas);
    const fadla = await seedFadlaWorkflows(users, shares);
    const socialRows = await seedSocialGraph(users);
    const notifications = await seedNotifications(users, posts, memories, ideas, shares);
    const recommendationEvents = await seedRecommendationEvents(users, posts, memories, ideas, shares, { post, memory, idea, fadla }, socialRows);

    const summary = await collectSummary(users, posts, memories, ideas, shares, { post, memory, idea, fadla }, notifications, recommendationEvents, socialRows);
    assertSummary(summary);

    const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log("\n=== Final seed report ===");
    console.log(`Users created:          ${summary.created.users}`);
    console.log(`Graatek created:        ${summary.created.graatek} (${summary.graatekWorkflow.completed} completed, ${summary.graatekWorkflow.activeRequests} active, ${summary.graatekWorkflow.availableItems} available)`);
    console.log(`Memories created:       ${summary.created.memories}`);
    console.log(`Posts created:          ${summary.created.posts}`);
    console.log(`Ideas created:          ${summary.created.ideas}`);
    console.log(`Interactions created:   ${summary.created.interactions}`);
    console.log(`Notifications created:  ${summary.created.notifications}`);
    console.log(`Recommendation events:  ${summary.created.recommendationEvents}`);
    console.log(`Database size:          ${summary.database.sizeMB} MB`);
    console.log(`5,000-user readiness:   ${summary.readiness.users_5000}`);
    console.log(`50,000-user readiness:  ${summary.readiness.users_50000}`);
    console.log(`Recommendation engine:  ${summary.readiness.recommendation_engine}`);
    console.log(`Summary saved to:       ${path.join(ROOT, "seed-summary.json")}`);
    console.log(`Completed in ${elapsedSeconds}s`);
    console.log(`Sample login:           ${summary.sampleCredentials.email} / ${summary.sampleCredentials.password}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("\nSeed failed:", error.message);
  console.error(error.stack);
  process.exit(1);
});
