# Route Inventory

Classification codes (initial audit of the Bolt export):

1. Complete and verified
2. UI exists but functionality is missing
3. Partially implemented
4. Missing and must be created
5. Requires backend integration

"Auth" column: **public**, **guest** (signed-out only), **owner**, **team** (`team_member` or `admin`), **admin**, or a named permission. Every protected API endpoint enforces the same rule on the server; frontend guards are UX only.

The "Current status" column is updated at the end of the work — see the bottom of this file.

## Public website

| Route | Initial | Problems found | Backend needed | Auth |
|---|---|---|---|---|
| `/` | 3, 5 | Search form inert; stats misleading; placeholder contact info | `GET /properties`, `/localities`, `/settings/public`, `POST /enquiries` | public |
| `/buy` | 3, 5 | Locality filter broken; errors hidden; load-more not shareable | `GET /properties?purpose=sale` | public |
| `/rent` | 3, 5 | Same as `/buy` | `GET /properties?purpose=rent` | public |
| `/property/[slug]` | 3, 5 | Gallery capped at 3; no site-visit form; owner join; TS errors | `GET /properties/{slug}`, `POST /enquiries`, `POST /site-visit-requests` | public |
| `/sell-property` | 4 | Linked from nav/home/footer → 404 | `POST /enquiries` (interest `sell`) | public |
| `/list-property` | 4 | Linked → 404 | — (routes to register / dashboard) | public |
| `/areas/[slug]` | 4 | Linked from homepage locality cards → 404 | `GET /localities/{slug}`, `GET /properties?locality=` | public |
| `/about` | 4 | 404 | `GET /settings/public` | public |
| `/contact` | 4 | 404 | `POST /enquiries`, `GET /settings/public` | public |
| `/privacy-policy` | 4 | 404 | — | public |
| `/terms` | 4 | 404 | — | public |
| `/sitemap.xml`, `/robots.txt` | 4 | Missing | `GET /sitemap` | public |

## Authentication

| Route | Initial | Backend | Auth |
|---|---|---|---|
| `/login` | 4 | `POST /auth/login` | guest |
| `/register` | 4 | `POST /auth/register` (always creates `owner`) | guest |
| `/forgot-password` | 4 | `POST /auth/forgot-password` | guest |
| `/reset-password` | 4 | `POST /auth/reset-password` | guest |
| `/verify-email` | 4 | `GET /auth/verify-email/{id}/{hash}`, resend | signed-in |

## Owner portal

| Route | Initial | Backend | Auth |
|---|---|---|---|
| `/dashboard` | 4 | `GET /owner/dashboard` | owner |
| `/dashboard/properties` | 4 | `GET /owner/properties` | owner |
| `/dashboard/properties/new` | 4 | `POST /owner/properties`, images, submit | owner |
| `/dashboard/properties/[id]` | 4 | `GET /owner/properties/{id}` (own only) | owner + ownership |
| `/dashboard/properties/[id]/edit` | 4 | `PUT /owner/properties/{id}`, image endpoints | owner + ownership |
| `/dashboard/profile` | 4 | `PUT /auth/profile`, `PUT /auth/password` | any signed-in |

## Team workspace

| Route | Initial | Backend | Auth |
|---|---|---|---|
| `/team` | 4 | `GET /team/dashboard` | team |
| `/team/leads` | 4 | `GET /team/leads` (scope: own + unassigned, or all with `leads.view_all`) | team |
| `/team/leads/[id]` | 4 | lead detail, assign, status, activities, follow-ups, visits, owner notes, deal | team + lead scope |
| `/team/follow-ups` | 4 | `GET /team/follow-ups` | team |
| `/team/site-visits` | 4 | `GET/POST/PATCH /team/site-visits` | team |
| `/team/properties` | 4 | `GET /team/properties` | team |
| `/team/properties/[id]` | 4 | private owner contact + coordination notes | team |
| `/team/deals` | 4 | `GET/POST /team/deals` | team (own deals; all with `finance.manage`) |
| `/team/deals/[id]` | 4 | deal, brokerage agreements, payments, documents | team + deal scope; payments need `finance.manage` |
| `/team/brokerage` | 4 | `GET /team/brokerage/summary` | team (own scope) |
| `/team/customers` | 4 | `GET /team/customers` | team |
| `/team/profile` | 4 | profile endpoints | team |

## Admin portal

| Route | Initial | Backend | Auth |
|---|---|---|---|
| `/admin` | 4 | `GET /admin/dashboard` | admin |
| `/admin/properties` | 4 | `GET /admin/properties` | admin or `properties.moderate` |
| `/admin/properties/[id]` | 4 | approve / reject / suspend / status / feature | admin or `properties.moderate` |
| `/admin/users` | 4 | `GET/POST/PUT /admin/users` | admin |
| `/admin/leads` | 4 | `GET /team/leads` (all), assign | admin |
| `/admin/site-visits` | 4 | `GET /team/site-visits` | admin |
| `/admin/deals` | 4 | `GET /team/deals` | admin |
| `/admin/localities` | 4 | CRUD `/admin/localities` | admin |
| `/admin/amenities` | 4 | CRUD `/admin/amenities` | admin |
| `/admin/reports` | 4 | `GET /admin/reports/finance` | admin |
| `/admin/settings` | 4 | `GET/PUT /admin/settings` | admin |
| `/admin/audit-logs` | 4 | `GET /admin/audit-logs` | admin |
| `/admin/brokerage-rules` | 4 | CRUD `/admin/brokerage-rules` | admin |

## Broken links / interactions found in existing components

| Location | Issue | Resolution |
|---|---|---|
| Navbar dropdown | `/owner/dashboard`, `/admin/dashboard`, `/owner/profile` do not exist | Role-aware links to `/dashboard`, `/team`, `/admin` |
| `AuthGuard` | Same dead redirect targets | Role-aware redirect |
| Homepage hero search | Inputs ignored | Real GET form → `/buy` or `/rent` with query params |
| Property card heart | No-op | Removed (favourites not in scope; customers have no accounts) |
| Property card share | No-op | Web Share API with copy-link fallback |
| Enquiry form | Direct Supabase insert, duplicate IDs | Posts to `POST /enquiries`; unique IDs per instance; split consents |
| Contact details | Placeholder phone/address/email/social | Admin settings; hidden when empty |

## Current status (after implementation, 23 Oct 2026)

All routes listed above now exist and are connected to the Laravel API. "Verified" below means what was actually checked:

| Check | Result |
|---|---|
| Next.js production build (`next build`) | ✅ 44 app routes compiled, types valid |
| TypeScript (`tsc --noEmit`, strict) | ✅ no errors |
| ESLint (`next lint`) | ✅ no warnings or errors |
| Every route requested over HTTP against the dev server | ✅ 200 for all pages; 404 for unknown property/area/page |
| Public HTML checked for private data (owner contact, private address) | ✅ none present |
| Browser-style flow through the Next.js proxy (cookies + CSRF): owner login → create → upload photo → submit → admin approve → public listing → anonymous enquiry → team claims and logs call → permission denials → logout | ✅ 21/21 steps |
| Backend feature tests incl. full 15-step acceptance workflow | ✅ 51 tests, 476 assertions |
| Frontend unit tests (Vitest) | ✅ 9 tests |

**Not yet verified:**
- Interactive clicking through every dashboard screen in a real browser. Pages were checked to load and their APIs are tested, but no automated UI tests (Playwright) are in place.
- The production build has not been served and smoke-tested with `next start`; the HTTP checks above ran against `next dev`.
- Email delivery (dev uses `MAIL_MAILER=log`), S3 storage and the production Nginx config.

| Area | Routes | Status |
|---|---|---|
| Public | `/`, `/buy`, `/rent`, `/property/[slug]`, `/areas/[slug]`, `/sell-property`, `/list-property`, `/about`, `/contact`, `/privacy-policy`, `/terms`, 404, `/sitemap.xml`, `/robots.txt` | Implemented |
| Auth | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` | Implemented |
| Owner | `/dashboard`, `/dashboard/properties`, `/new`, `/[id]`, `/[id]/edit`, `/dashboard/profile` | Implemented |
| Team | `/team`, `/team/leads`, `/team/leads/[id]`, `/team/follow-ups`, `/team/site-visits`, `/team/properties`, `/team/properties/[id]`, `/team/deals`, `/team/deals/[id]`, `/team/brokerage`, `/team/customers`, `/team/profile` | Implemented |
| Admin | `/admin`, `/admin/properties`, `/admin/properties/[id]`, `/admin/users`, `/admin/leads`, `/admin/site-visits`, `/admin/deals`, `/admin/localities`, `/admin/amenities`, `/admin/reports`, `/admin/settings`, `/admin/audit-logs`, `/admin/brokerage-rules` | Implemented |

Admin leads, site-visit and deal lists reuse the team components. Opening a record goes to the team detail page, which admins can use. Team members with `properties.moderate` can open `/admin/properties` only.
