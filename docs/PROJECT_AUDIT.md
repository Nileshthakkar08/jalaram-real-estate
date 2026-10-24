# Project Audit — Jalaram Real Estate

Audit date: 2026-10-23. Audited the Bolt.new export in `project/` before making any changes.

## 1. What was delivered by Bolt

| Area | Finding |
|---|---|
| Framework | Next.js **13.5.1** App Router, React 18.2, TypeScript 5.2 (strict), Tailwind 3.3, shadcn/ui (Radix), lucide-react icons. Bolt template `nextjs-shadcn`. |
| Fonts / tokens | Playfair Display (serif headings) + Inter (body) via `next/font`. HSL tokens in `app/globals.css`: primary forest green `#173C32` (`142 38% 16%`), accent gold `#B49756` (`42 36% 53%`), warm-neutral background. Utilities `container-mw`, `container-px`. |
| Data layer | `@supabase/supabase-js` called **directly from the browser and from server components** with the public anon key (`lib/supabase-client.ts`). Schema in `supabase/migrations/*.sql` (Postgres + Row Level Security). |
| Auth | Supabase Auth via `lib/auth-context.tsx`; client-side `AuthGuard`. Roles `owner`, `broker`, `admin`. |
| Deployment | `netlify.toml` with `@netlify/plugin-nextjs`. `next.config.js` disables ESLint during builds and image optimisation. |
| Tests | None. No CI. |
| Source size | ~2,400 lines of app code (excluding generated shadcn/ui components). |

### Routes that exist

`/`, `/buy`, `/rent`, `/property/[slug]` — nothing else. See `ROUTE_INVENTORY.md`.

### Reusable components that exist (preserved)

`components/site/`: `navbar`, `footer`, `public-layout`, `floating-actions`, `property-card`, `listing-browser`, `enquiry-form`, `auth-guard`. Full shadcn/ui kit in `components/ui/`.

## 2. Defects and gaps found

### Critical (security / business integrity)

1. **Privilege escalation.** RLS policy `profiles_update_own` allows a signed-in user to update *any column* of their own profile, including `role`. Any owner could run `supabase.from('profiles').update({ role: 'admin' })` from the browser console and become an admin.
2. **Moderation bypass.** `properties_owner_insert` / `properties_owner_update` let owners set `listing_status = 'published'` themselves, skipping Jalaram review.
3. **Unvalidated public lead insert.** `leads_public_insert ... WITH CHECK (true)` lets anonymous callers set `status`, `assigned_broker_id`, etc. No server-side validation, rate limiting, duplicate prevention or spam protection.
4. **Owner data on public page.** `property/[slug]` selects `owner:profiles(*)`. RLS currently blocks it for anonymous users, but the intent exposes owner data and would leak if a policy were loosened.
5. **Financial model cannot represent the business.** `deals` has a single `brokerage_amount`, a single payer and a 3-value `brokerage_payment_status`. No payment records, partial payments, outstanding balance, refunds/waivers, multiple responsible parties, rules, or audit of fee changes.
6. **Next.js 13.5.1** is affected by published advisories (e.g. CVE-2025-29927 middleware authorisation bypass, fixed in 13.5.9). Patch-level upgrade within 13.5.x required.

### Broken or placeholder functionality

7. **20+ dead links.** Nav, footer and CTAs point to `/sell-property`, `/list-property`, `/about`, `/contact`, `/privacy-policy`, `/terms`, `/areas/[slug]`, `/login`, `/register`, `/owner/dashboard`, `/owner/profile`, `/admin/dashboard` — all 404.
8. **Homepage search does nothing.** The four `<select>`s are not in a form; "Search Properties" is a plain link to `/buy` that discards every selection.
9. **Locality filter bug.** `listing-browser.tsx` filters with `.eq('locality.slug', …)` on an embedded relation without `!inner`, which does not filter parent rows — the locality filter returns all properties.
10. **Errors shown as "No properties found".** Query errors are logged to the console only.
11. **Price inputs** push a router navigation on every keystroke; rent and sale share the same budget semantics.
12. **Heart / Share buttons** on property cards are no-ops (`e.preventDefault()` only).
13. **Property gallery** shows at most 3 images; the rest are unreachable.
14. **No site-visit request** form despite the business workflow requiring it.
15. **Enquiry form** uses fixed element IDs (`name`, `phone`, …) so two forms on one page produce duplicate IDs and broken label associations; one checkbox mixes mandatory contact consent with optional marketing consent.
16. `AuthGuard` and the navbar redirect to `/owner/dashboard` and `/admin/dashboard`, which do not exist.
17. Amenities are stored as a free-text array on `properties` — unrelated to the `amenities` table.
18. Structured data uses a relative URL and the `Product` type for every listing.
19. No sitemap, robots, canonical base URL (`metadataBase`), 404 page or locality landing pages.
20. **TypeScript errors** in `app/property/[slug]/page.tsx` (implicit `any`) — `npm run typecheck` fails on the original export.

### Content that must not be published as-is

21. `lib/business.ts` hardcodes a phone number (`+91 98250 12345`), email, a Bodakdev street address and Instagram/Facebook handles. There is no evidence these are real; they are treated as placeholders and replaced by admin-managed settings that render only when filled in.
22. Marketing claims without a basis: "Verified Listings", "Browse verified listings", "Reach thousands of serious buyers", "100% Reviewed Before Publishing", "24/7 Property Visibility", and an "Active Listings" stat computed from the number of cards on the page. Reworded to describe the actual process (Jalaram reviews listings before publishing; review is not legal title verification).
23. Footer/property disclaimers mention "sample listings for demonstration" — appropriate only for a demo; replaced with an accurate disclaimer.

## 3. Architecture decision

**Keep the Next.js frontend; replace Supabase with a Laravel REST API on MySQL.**

- The frontend already uses the preferred stack (Next.js App Router, TypeScript, Tailwind), so it is preserved and extended, not rewritten. It stays at `project/` (the Bolt export folder) rather than being moved to `apps/web`, to avoid breaking the editor workspace and Netlify/Bolt configuration; the API is added alongside at `api/`.
- The brokerage workflows (status transitions, multi-party brokerage agreements, partial payments, audit trails, moderation) need trustworthy server-side logic and transactions. Enforcing these from browser-side Supabase calls would require rebuilding them as Postgres functions; the brief specifies Laravel + MySQL, so the data layer moves there.
- Authentication: **Laravel Sanctum SPA (cookie) authentication** with CSRF protection. The browser talks to the same origin; Next.js rewrites `/api/*` and `/sanctum/*` to Laravel in development, and Nginx routes them in production. No tokens are stored in `localStorage`.
- Public pages (home, search, property, area) are server-rendered from the public API so they are indexable.
- The original Supabase SQL is kept under `docs/legacy-supabase/` for reference only; the frontend no longer depends on Supabase.

## 4. Environment observed

- PHP 8.3 (no `pdo_sqlite`, no `bcmath`), Composer 2.9, Node 22, npm 10, GD with JPEG/PNG/WebP.
- System MySQL 8.0 is running but its credentials are not available to this session, so development and tests use an isolated **MySQL 8.0 Docker container** (`jalaram-mysql`, `127.0.0.1:3307`). Production uses whatever MySQL server is configured in `api/.env`.
- Money arithmetic is done in integer paise in PHP (no float maths), since `bcmath` is not installed.
