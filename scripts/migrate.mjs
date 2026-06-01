import pg from "pg";
import {readFileSync} from "fs";
import {resolve, dirname} from "path";
import {fileURLToPath} from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const {Client} = pg;

async function main() {
  const client = new Client({
    host: "aws-0-eu-west-1.pooler.supabase.com",
    port: 5432,
    database: "postgres",
    user: "postgres.oanwmlouezwtcirrhbyl",
    password: "38sgfZW!-e88/Tm",
    ssl: {rejectUnauthorized: false},
  });

  await client.connect();
  console.log("Connected to Supabase PostgreSQL.");

  const migrationPath = resolve(__dirname, "../supabase/migrations/20260601090000_initial_schema.sql");
  const seedPath = resolve(__dirname, "../supabase/seed.sql");

  const migrationSQL = readFileSync(migrationPath, "utf-8");
  const seedSQL = readFileSync(seedPath, "utf-8");

  console.log("Running migration...");
  await client.query(migrationSQL);
  console.log("Migration complete.");

  console.log("Running seed...");
  await client.query(seedSQL);
  console.log("Seed complete.");

  await client.end();
  console.log("Done. Database is ready.");
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
