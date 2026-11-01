// Supabase Edge Function: capture-screenshot
// Takes a screenshot of a live website (via Microlink's screenshot API), saves it to your
// Supabase Storage bucket "portfolio-media", and returns the permanent public URL.
// Admin-only: the caller must be signed in as ADMIN_EMAIL (or use the service-role key).
// Optional secret: MICROLINK_API_KEY (free tier works without it, with a small daily limit).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ---- Admin-only ----
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    const { data, error } = await admin.auth.getUser(token);
    const adminEmail = Deno.env.get("ADMIN_EMAIL");
    if (error || !data.user || !adminEmail || data.user.email !== adminEmail) {
      return json({ error: "Unauthorized" }, 401);
    }
  }

  // ---- Validate the target URL ----
  let target: URL;
  try {
    const body = await req.json();
    target = new URL(String(body.url ?? ""));
    if (!["http:", "https:"].includes(target.protocol)) throw new Error("bad protocol");
  } catch {
    return json({ error: "Please provide a valid http(s) URL." }, 400);
  }

  // ---- Ask Microlink to render the page ----
  const params = new URLSearchParams({
    url: target.toString(),
    screenshot: "true",
    meta: "false",
    "viewport.width": "1280",
    "viewport.height": "800",
    "screenshot.type": "jpeg",
    waitUntil: "networkidle2",
  });
  const headers: Record<string, string> = {};
  const apiKey = Deno.env.get("MICROLINK_API_KEY");
  if (apiKey) headers["x-api-key"] = apiKey;

  const apiRes = await fetch(`https://api.microlink.io/?${params}`, { headers });
  const payload = await apiRes.json().catch(() => null);
  if (!apiRes.ok || payload?.status !== "success" || !payload?.data?.screenshot?.url) {
    const msg = payload?.message || `Screenshot service error (${apiRes.status})`;
    return json({ error: msg }, 502);
  }

  // ---- Download the image (only from Microlink's own hosts) ----
  const shotUrl = new URL(payload.data.screenshot.url);
  if (!shotUrl.hostname.endsWith("microlink.io")) {
    return json({ error: "Unexpected screenshot host." }, 502);
  }
  const imgRes = await fetch(shotUrl.toString());
  if (!imgRes.ok) return json({ error: "Could not download the screenshot." }, 502);
  const buf = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
  const ext = contentType.includes("png") ? "png" : "jpg";

  // ---- Save permanently in your own storage ----
  const fileName = `screenshot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("portfolio-media")
    .upload(fileName, buf, { contentType, upsert: false });
  if (upErr) return json({ error: "Storage upload failed: " + upErr.message }, 500);

  const { data: pub } = admin.storage.from("portfolio-media").getPublicUrl(fileName);
  return json({ url: pub.publicUrl });
});
