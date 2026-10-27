# SEO Indexing Audit — jalaramrealestate.in

Date: 26 Oct 2026. Trigger: Search Console reports "Crawled – currently not indexed" for `/`, `/buy`, `/sell-property`, `/list-property`, `/about`, `/terms`, `/privacy-policy`, `/areas/prahlad-nagar`, `/areas/satellite`, `/areas/science-city`.

Method: fetched every page from the live site with a Googlebot user agent, measured the visible text and links present in the **server HTML** (what Google receives before running JavaScript), checked the sitemap, robots.txt and the API domain, then traced each finding to the code. Fixes were verified the same way against a production build served locally against the live public API.

## What was already correct

- Every public page returns **200** without login; dashboards are disallowed in robots.txt.
- **No unintended `noindex`** on public pages; no `X-Robots-Tag` headers on the website.
- **Canonical URLs** on public pages all use `https://jalaramrealestate.in` (no `www`).
- `http://` and `www.` both **301** to `https://jalaramrealestate.in/...`.
- **Titles and meta descriptions** are unique per page.
- **Property pages** are server-rendered (~460 words), with descriptive stable URLs (`/property/3-bhk-flat-for-rent-near-dps-school-shilaj-ahmedabad-1`), `RealEstateListing` structured data, and crawlable images (200, `image/jpeg`).

## Findings and fixes (most severe first)

| # | Severity | Finding (evidence) | Fix |
|---|---|---|---|
| 1 | **High** | **`/buy` and `/rent` sent no listings and no `<h1>` in their HTML.** Server HTML had 0 words in `<main>` and 0 property links. Cause: `ListingBrowser` fetched results only in the browser (`useEffect`), and `useSearchParams` in a statically rendered page made Next render just the Suspense spinner. | Pages now fetch the first page of results on the server (`app/buy/page.tsx`, `app/rent/page.tsx`) and pass it to `ListingBrowser` via a new `initial` prop. A shared `lib/listing-query.ts` builds the identical API query on server and client so the browser reuses the server result. Filters, sorting and pagination work as before. **After:** `<h1>` present, listings and `/property/...` links in the HTML. |
| 2 | **High** | **Area pages had no listings in their HTML** (0 property links even for Shilaj/Vastral, which have listings) — same cause as #1. | `app/areas/[slug]/page.tsx` server-renders the listings. |
| 3 | **High** | **105 of 107 area pages were empty template pages** (≈55 words, identical apart from the name) and all were in the sitemap. Thin, near-duplicate pages are a common reason for "crawled – currently not indexed". | Area pages with no live listings (or an empty sale/rent tab) are now `noindex, follow`, and the sitemap lists only areas with live listings. They become indexable automatically when a listing is published there. |
| 4 | **Medium** | **Area pages defaulted to the "For Sale" tab**, so `/areas/shilaj` (rentals only) opened on "No properties found". | Default tab is the purpose that has listings; tabs show counts; canonical is the plain area URL for the default tab. |
| 5 | **Medium** | **Two `<h1>` on area pages** (hero + listing heading). | Listing heading on area pages is now `<h2>` (`titleAs` prop). |
| 6 | **Medium** | **Root layout set `canonical: '/'`, inherited by every page that didn't override it** — `/login`, `/register` and the 404 page declared the homepage as canonical. | Canonical moved from `app/layout.tsx` to `app/page.tsx`. |
| 7 | **Medium** | **API domain served an indexable page titled "Jalaram Real Estate"** (Laravel welcome view) with robots.txt allowing everything; JSON responses were indexable. | `GET /` on the API 301-redirects to the website; all `/api/*` responses send `X-Robots-Tag: noindex, nofollow` (`NoIndexApiResponses` middleware). Property images (served by Nginx) remain indexable. |
| 8 | **Low** | **`/list-property` is a sign-in gateway** (31 words, content depends on login) and was in the sitemap. | `noindex, follow`; removed from sitemap. `/sell-property` covers the topic. |
| 9 | **Low** | Sitemap listed the homepage without the trailing slash while its canonical has one. | Sitemap uses `https://jalaramrealestate.in/`. |
| 10 | **Low** | `/about` used the homepage tagline as its `<h1>` (identical main heading on two pages). | `<h1>` is now "About Jalaram Real Estate"; the tagline moved to the small label above it. |
| 11 | **Low** | Property meta description repeated the area ("…Shilaj, Ahmedabad in Shilaj."). | Area appended only when not already in the title. |
| 12 | **Low** | `enchanting-hummingbird-eb64eb.netlify.app` serves a duplicate copy (canonical already pointed to the real domain). | 301 redirect in `netlify.toml`. |

Sitemap after the fix: 12 URLs — 8 core pages, 2 areas with listings, 2 property pages. No redirecting, private or `noindex` URLs.

## Not changed (needs facts or decisions from the business)

- **Area descriptions.** Seeded areas have no description. Useful, distinct text per area (what the area is like, landmarks, typical homes) must come from real knowledge — not generated filler. Add it in `/admin/localities` for areas where you have listings.
- **Business structured data** (`RealEstateAgent`: address, phone, areas served) — add once the public business details are confirmed in `/admin/settings`.
- **Default Open Graph image** for sharing links — needs a brand image.
- **Homepage "crawled – not indexed".** The homepage itself is technically sound (730+ words, server-rendered, correct canonical). For a domain a few days old with little inventory, this mostly reflects Google's assessment of value and site reputation; it typically resolves with more listings, a verified Google Business Profile and links from other sites. No code change can force it.

## Tests run

- Backend: `php artisan test` — 55 passed (new test for the API `noindex` header and root redirect).
- Frontend: `tsc --noEmit`, `next lint`, `vitest` — 12 passed (new tests for the shared listing query), production build succeeded.
- Before/after HTML audit against a local production build using the live public API (read-only).

## Manual verification in Search Console (after deploying)

1. **URL Inspection → Test live URL** for `/buy`, `/rent`, `/areas/shilaj`, `/areas/vastral` → *View tested page → HTML*: the listings and `/property/...` links should be present.
2. **Sitemaps:** resubmit `https://jalaramrealestate.in/sitemap.xml`; it should report 12 discovered URLs.
3. **Request indexing** once each for `/`, `/buy`, `/rent`, `/areas/shilaj`, `/areas/vastral` and both property pages.
4. **Pages report (1–3 weeks):** empty area pages will move to "Excluded by 'noindex' tag" — expected and intended. Pages under "Crawled – currently not indexed" should decrease as Google recrawls; there is no guaranteed timeline.
