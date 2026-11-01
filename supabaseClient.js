// 1) Create your NEW Supabase project, then go to Project Settings -> API
// 2) Paste the Project URL and the "anon / public" key below (the anon key is safe to expose in the browser)
const SUPABASE_URL = "https://owwbrunnpbbvtuaezmrs.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93d2JydW5ucGJidnR1YWV6bXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MzAyNDQsImV4cCI6MjEwOTAwNjI0NH0.Q4trPl8htZpLw4Z370_JqWJMDyAmdmHruRAL4tyVNNI";

window.SUPABASE_CONFIGURED = !SUPABASE_URL.includes("YOUR-PROJECT-REF");

window.supabaseClient = window.supabase.createClient(
  window.SUPABASE_CONFIGURED ? SUPABASE_URL : "https://placeholder.supabase.co",
  window.SUPABASE_CONFIGURED ? SUPABASE_ANON_KEY : "placeholder",
);
