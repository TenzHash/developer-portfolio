# Terrenze Josh Binamira — Portfolio (Explore. Organize. Elevate.)

Static site (HTML/CSS/JS) + Supabase backend.

## Brand tokens (in `styles.css` `:root`)
| Token | Hex | Role |
|---|---|---|
| `--navy` | #0A1F44 | Page background (~45%) |
| `--electric` | #0066FF | Buttons, cards, glows (~25%) |
| `--cyan` | #00E5FF | Accents, highlights (~15%) |
| `--white` | #F5F7FA | Text + social feed band (~15%) |

Fonts: Montserrat SemiBold (headings), Inter Regular (body), Inter Italic (accents/tagline).

## 1. New Supabase database
1. supabase.com → **New project**.
2. **SQL Editor** → paste `supabase/schema.sql` → **Run**.
3. **Authentication → Users → Add user** (your admin email + password). Then **Authentication → Sign In / Providers** → turn **off** "Allow new users to sign up".
4. **Project Settings → API** → copy Project URL + anon key into `supabaseClient.js`.
5. Open `/admin/index.html`, sign in, add your projects.

## 2. Facebook + Instagram feed
**Requirements:** a Facebook *Page* you admin, and an Instagram *Business or Creator* account linked to that Page (personal profiles can't be read through Meta's API).

1. https://developers.facebook.com → **Create App** (type: Business). Add products: *Facebook Login for Business* (or Login) and *Instagram Graph API*.
2. Open **Graph API Explorer**, pick your app, and generate a **User token** with permissions: `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `business_management`.
3. Exchange it for a long-lived token (App Dashboard → Tools → Access Token Debugger → *Extend*), then call `GET /me/accounts` — the Page entry's `access_token` is a **never-expiring Page token**; its `id` is `META_PAGE_ID`.
4. Call `GET /{page-id}?fields=instagram_business_account` — that id is `META_IG_USER_ID`.
5. Install the Supabase CLI, then:
```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set META_PAGE_TOKEN=... META_PAGE_ID=... META_IG_USER_ID=... ADMIN_EMAIL=you@domain.com
supabase functions deploy sync-social
```
6. In `/admin`, click **Sync now**. For automatic syncing, uncomment the `cron.schedule` block at the bottom of `schema.sql`.

Apps in Meta "Development mode" work for your own accounts with no app review.

## Deploy
Any static host works (Vercel, Netlify, Cloudflare Pages, GitHub Pages).
