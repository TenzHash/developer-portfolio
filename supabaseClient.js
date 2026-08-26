// Replace these with your actual Project Settings -> API credentials in Supabase
const SUPABASE_URL = "https://mmqnyoiaiwcrnvtcbnxe.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcW55b2lhaXdjcm52dGNibnhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NTEzMjAsImV4cCI6MjEwMzIyNzMyMH0.mAJMAnrrGn5IRc7Q8N_XhBFRKtX24II9tG9pDwBIvFs";

// Assign directly to a unique window property
window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);
