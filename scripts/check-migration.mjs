import {createClient} from "@supabase/supabase-js";

const SUPABASE_URL = "https://oanwmlouezwtcirrhbyl.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hbndtbG91ZXp3dGNpcnJoYnlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNzAyMjQsImV4cCI6MjA5NTg0NjIyNH0.VYKOvgUg-nDlDontyqx6nRiFBVzW9qRgZ422jzTXZ48";

const supabase = createClient(SUPABASE_URL, anonKey);

async function check() {
  const {data, error} = await supabase
    .from("community_share_requests")
    .select("id, share_id, requester_id, status")
    .limit(5);
  if (error) console.error("Error:", error.message);
  else console.log("Requests accessible:", data?.length ?? 0);
}

check();
