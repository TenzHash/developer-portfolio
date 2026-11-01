// Supabase Edge Function: analyze-site
// Fetches a live website server-side and returns: page title, meta description, headline,
// first paragraph and a detected tech stack (HTML/JS/CSS signatures).
// Admin-only: caller must be signed in as ADMIN_EMAIL (or use the service-role key).
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

// Block local/private targets so this can't be used to probe internal networks.
const PRIVATE_HOST =
  /^(localhost$|.*\.local$|.*\.internal$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/i;

async function getText(url: string, max = 1_500_000, timeoutMs = 10_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PortfolioAnalyzer/1.0)",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
    });
    if (!res.ok) return { ok: false, text: "", finalUrl: url };
    const finalHost = new URL(res.url).hostname;
    if (PRIVATE_HOST.test(finalHost)) return { ok: false, text: "", finalUrl: url };

    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (received >= max) {
          await reader.cancel();
          break;
        }
      }
    }
    const buf = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) {
      buf.set(c, offset);
      offset += c.length;
    }
    return { ok: true, text: new TextDecoder().decode(buf), finalUrl: res.url };
  } catch {
    return { ok: false, text: "", finalUrl: url };
  } finally {
    clearTimeout(timer);
  }
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const stripTags = (s: string) => decode(s.replace(/<[^>]+>/g, " "));

// [label, test]
const SIGNATURES: [string, RegExp][] = [
  ["Next.js", /_next\/static|__NEXT_DATA__/],
  ["Nuxt", /_nuxt\/|__NUXT__/],
  ["Gatsby", /___gatsby|gatsby-/],
  ["Astro", /astro-island|data-astro-cid|content=["']Astro/i],
  ["React", /react-dom|data-reactroot|__REACT_DEVTOOLS_GLOBAL_HOOK__|react\.(?:transitional\.)?element/],
  ["Vue", /__VUE__|data-v-[0-9a-f]{6,8}|vue(?:\.runtime)?(?:\.global)?(?:\.prod)?(?:\.min)?\.js|vue@\d/],
  ["Svelte", /__svelte|class="svelte-|svelte-[a-z0-9]{5,}/],
  ["Angular", /ng-version=|<app-root|ng-star-inserted/],
  ["Alpine.js", /alpinejs|x-data=/],
  ["HTMX", /htmx(?:\.min)?\.js|hx-(?:get|post)=/],
  ["jQuery", /jquery[.-]?[\d.]*(?:\.min)?\.js|code\.jquery\.com/i],
  ["Bootstrap", /bootstrap(?:\.min)?\.(?:css|js)|bootstrap@\d|Bootstrap v\d|class="[^"]*\b(?:container-fluid|navbar-expand|btn-primary)\b/],
  ["Tailwind CSS", /cdn\.tailwindcss\.com|tailwindcss v\d|class="[^"]*\b(?:flex|grid)\b[^"]*\b(?:px|py|gap|space-[xy])-\d/],
  ["Material UI", /\bMui[A-Z][A-Za-z]+-root|@mui\//],
  ["Framer Motion", /framer-motion/],
  ["Supabase", /supabase\.co|supabase-js|@supabase\//],
  ["Firebase", /firebase(?:app)?\.com|firebaseio|gstatic\.com\/firebasejs/],
  ["GSAP", /gsap(?:\.min)?\.js|ScrollTrigger|gsap@\d/],
  ["Three.js", /three(?:\.min|\.module)?\.js|THREE\.WebGLRenderer/],
  ["AOS", /aos(?:\.min)?\.(?:css|js)|data-aos=/],
  ["Swiper", /swiper(?:-bundle)?(?:\.min)?\.(?:js|css)|class="swiper/],
  ["Chart.js", /chart\.js|chart\.umd|new Chart\(/],
  ["Leaflet", /leaflet(?:\.min)?\.(?:js|css)|leaflet@\d/],
  ["Stripe", /js\.stripe\.com/],
  ["Google Maps", /maps\.googleapis\.com|maps\.google\.com\/maps/],
  ["WordPress", /wp-content|wp-includes|content=["']WordPress/i],
  ["Shopify", /cdn\.shopify\.com|Shopify\.theme/],
  ["Wix", /wixstatic\.com/],
  ["Squarespace", /squarespace\.com|static1\.squarespace/],
  ["Webflow", /webflow\.com|data-wf-page/],
  ["Framer", /framerusercontent\.com|data-framer-/],
  ["Vite", /\/assets\/index-[A-Za-z0-9_-]{6,}\.(?:js|css)/],
  ["Font Awesome", /font-?awesome|fa-(?:solid|brands|regular)|use\.fontawesome\.com/i],
  ["Google Fonts", /fonts\.googleapis\.com/],
];

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

  // ---- Validate URL ----
  let target: URL;
  try {
    const body = await req.json();
    target = new URL(String(body.url ?? ""));
    if (!["http:", "https:"].includes(target.protocol)) throw new Error("protocol");
    if (PRIVATE_HOST.test(target.hostname)) throw new Error("private");
  } catch {
    return json({ error: "Please provide a valid public http(s) URL." }, 400);
  }

  const page = await getText(target.toString());
  if (!page.ok) return json({ error: "Could not load that page." }, 502);
  const html = page.text;
  const base = new URL(page.finalUrl);

  // ---- Read a few same-origin scripts / stylesheets (SPA bundles hide the framework) ----
  const assetUrls = new Set<string>();
  const assetRegex =
    /<script[^>]+src=["']([^"']+)["']|<link[^>]+rel=["'](?:stylesheet|modulepreload)["'][^>]*href=["']([^"']+)["']|<link[^>]+href=["']([^"']+)["'][^>]*rel=["'](?:stylesheet|modulepreload)["']/gi;
  for (const m of html.matchAll(assetRegex)) {
    const raw = m[1] || m[2] || m[3];
    if (!raw) continue;
    try {
      const u = new URL(raw, base);
      if (u.hostname === base.hostname) assetUrls.add(u.toString());
    } catch { /* ignore */ }
    if (assetUrls.size >= 5) break;
  }
  const assets = await Promise.all(
    [...assetUrls].map((u) => getText(u, 600_000, 8_000).then((r) => r.text)),
  );
  const haystack = html + "\n" + assets.join("\n");

  // ---- Tech detection ----
  const tech: string[] = [];
  for (const [label, re] of SIGNATURES) if (re.test(haystack)) tech.push(label);
  if (tech.includes("Next.js") || tech.includes("Gatsby")) {
    if (!tech.includes("React")) tech.unshift("React");
  }
  if (/<style|rel=["']stylesheet/i.test(html)) tech.push("CSS");
  if (/<script/i.test(html)) tech.push("JavaScript");
  tech.unshift("HTML");

  // ---- Text content ----
  const metas: Record<string, string> = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const key = (tag.match(/(?:name|property)=["']([^"']+)["']/i) || [])[1];
    const val = (tag.match(/content=["']([^"']*)["']/i) || [])[1];
    if (key && val !== undefined) metas[key.toLowerCase()] = decode(val);
  }
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const headline = stripTags((body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || "");
  let paragraph = "";
  for (const m of body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = stripTags(m[1]);
    if (t.length >= 60) {
      paragraph = t;
      break;
    }
  }

  return json({
    title: metas["og:title"] || title,
    description: metas["og:description"] || metas["description"] || "",
    headline,
    paragraph,
    tech: [...new Set(tech)],
    finalUrl: page.finalUrl,
  });
});
