// Supabase Edge Function: sync-social
// Pulls recent posts from a Facebook Page and an Instagram Business/Creator account
// via the Meta Graph API and upserts them into public.social_posts.
// Meta tokens stay server-side as function secrets and are never exposed to the browser.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GRAPH = "https://graph.facebook.com/v21.0";

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // ---- Authorization: service-role key (cron) OR the signed-in admin ----
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (token !== serviceKey) {
    const { data, error } = await admin.auth.getUser(token);
    const adminEmail = Deno.env.get("ADMIN_EMAIL");
    if (error || !data.user || !adminEmail || data.user.email !== adminEmail) {
      return json({ error: "Unauthorized" }, 401);
    }
  }

  const pageToken = Deno.env.get("META_PAGE_TOKEN");
  const pageId = Deno.env.get("META_PAGE_ID");
  const igUserId = Deno.env.get("META_IG_USER_ID");
  if (!pageToken) return json({ error: "META_PAGE_TOKEN secret is missing" }, 500);

  // Copy an image into Supabase Storage (Meta CDN links expire).
  async function mirror(url: string | undefined, key: string): Promise<string | null> {
    if (!url) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const type = res.headers.get("content-type") ?? "image/jpeg";
      const { error } = await admin.storage
        .from("social-media")
        .upload(key, buf, { contentType: type, upsert: true });
      if (error) return null;
      return admin.storage.from("social-media").getPublicUrl(key).data.publicUrl;
    } catch {
      return null;
    }
  }

  const rows: Record<string, unknown>[] = [];
  const counts = { facebook: 0, instagram: 0 };
  const errors: string[] = [];

  // ---- Facebook Page posts ----
  if (pageId) {
    const url = `${GRAPH}/${pageId}/posts?fields=id,message,full_picture,permalink_url,created_time&limit=12&access_token=${pageToken}`;
    const res = await fetch(url);
    const body = await res.json();
    if (body.error) errors.push("Facebook: " + body.error.message);
    for (const p of body.data ?? []) {
      const media = await mirror(p.full_picture, `fb-${p.id}.jpg`);
      rows.push({
        platform: "facebook",
        external_id: p.id,
        caption: p.message ?? "",
        media_url: media,
        media_type: p.full_picture ? "IMAGE" : "TEXT",
        permalink: p.permalink_url,
        posted_at: p.created_time,
        synced_at: new Date().toISOString(),
      });
      counts.facebook++;
    }
  }

  // ---- Instagram media ----
  if (igUserId) {
    const url = `${GRAPH}/${igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=12&access_token=${pageToken}`;
    const res = await fetch(url);
    const body = await res.json();
    if (body.error) errors.push("Instagram: " + body.error.message);
    for (const m of body.data ?? []) {
      const src = m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url;
      const media = await mirror(src, `ig-${m.id}.jpg`);
      rows.push({
        platform: "instagram",
        external_id: m.id,
        caption: m.caption ?? "",
        media_url: media,
        media_type: m.media_type,
        permalink: m.permalink,
        posted_at: m.timestamp,
        synced_at: new Date().toISOString(),
      });
      counts.instagram++;
    }
  }

  if (rows.length) {
    // Upsert updates caption/media but leaves is_hidden untouched.
    const { error } = await admin
      .from("social_posts")
      .upsert(rows, { onConflict: "platform,external_id" });
    if (error) return json({ error: error.message }, 500);
  }

  if (errors.length && !rows.length) return json({ error: errors.join(" | ") }, 502);
  return json({ ...counts, warnings: errors });
});
