# API Specification

Base URL: `/api/v1` (Laravel, `api/routes/api.php`). JSON only.

## Conventions

- **Auth:** Laravel Sanctum SPA cookie sessions. Call `GET /sanctum/csrf-cookie` once, then send `X-XSRF-TOKEN` (from the `XSRF-TOKEN` cookie) with every state-changing request and `credentials: 'include'`. The browser only ever talks to the web origin; `/api` and `/sanctum` are proxied to Laravel (Next.js rewrites in development, Nginx in production).
- **Success:** `{ "data": … }`; paginated lists add `meta` (`current_page`, `last_page`, `per_page`, `total`) and `links`.
- **Errors:** `{ "message": "…", "errors": { "field": ["…"] } }` with `422` (validation), `401` (unauthenticated), `403` (forbidden), `404`, `409` (invalid state transition), `429` (rate limited). Stack traces are never returned when `APP_DEBUG=false`.
- **Money:** strings with 2 decimals (e.g. `"10000.00"`), INR.
- **Pagination:** `?page=` and `?per_page=` (max 50).

## Public

| Method | Path | Notes |
|---|---|---|
| GET | `/settings/public` | Business contact settings (empty values omitted). |
| GET | `/localities` | Active localities with published-listing counts. |
| GET | `/localities/{slug}` | |
| GET | `/amenities` | Active amenities. |
| GET | `/properties` | Filters: `purpose` (sale/rent), `locality` (slug), `type`, `bhk` (1–4, `5` = 5+), `min_price`, `max_price`, `furnishing`, `q`, `featured`, `sort` (`newest`, `price_asc`, `price_desc`, `area_desc`), `page`, `per_page`. Only publicly eligible listings. |
| GET | `/properties/{slug}` | Public detail + `similar`. **Never** includes owner, private address, owner contact or internal notes. |
| GET | `/sitemap` | Slugs + `updated_at` for properties and localities. |
| POST | `/enquiries` | Throttled (5/min/IP + 20/day/IP). Body: `name`, `phone`, `email?`, `message?`, `interest` (buy/rent/sell/general), `property_id?`, `budget_min?`, `budget_max?`, `preferred_locality_id?`, `preferred_bhk?`, `source_page?`, `utm_*?`, `consent_contact` (must be true), `consent_marketing?`, `website` (honeypot — must be empty). Duplicate (same phone + property within 24h) is merged into the existing open lead and returns `200` with `duplicate: true`. Returns `{ data: { reference } }`. |
| POST | `/site-visit-requests` | Same throttle. Body as enquiry + `property_id` (required, must be public), `preferred_date` (today…+60 days), `preferred_slot` (`morning`,`afternoon`,`evening`). Creates/merges a lead and a `requested` site visit. |

## Authentication (`/auth`)

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | `name`, `email`, `phone`, `password`, `password_confirmation`. Always role `owner`. Throttled. Sends verification email. |
| POST | `/auth/login` | `email`, `password`, `remember?`. Throttled 5/min per email+IP. Inactive users rejected. |
| POST | `/auth/logout` | |
| GET | `/auth/user` | Current user with role and effective permissions. |
| PUT | `/auth/profile` | `name`, `phone`, `email` (re-verification on change). |
| PUT | `/auth/password` | `current_password`, `password`, `password_confirmation`. |
| POST | `/auth/forgot-password` | Always returns 200 (no account enumeration). |
| POST | `/auth/reset-password` | `token`, `email`, `password`, `password_confirmation`. |
| POST | `/auth/email/verification-notification` | Resend. |
| GET | `/auth/verify-email/{id}/{hash}` | Signed URL. |

## Owner (`/owner`, role `owner`; ownership enforced by `PropertyPolicy`)

| Method | Path | Notes |
|---|---|---|
| GET | `/owner/dashboard` | Counts by status. **No lead or financial data.** |
| GET | `/owner/properties` | Own listings, filter `status`. |
| POST | `/owner/properties` | Creates `draft`. |
| GET | `/owner/properties/{id}` | Own only (404/403 otherwise). |
| PUT | `/owner/properties/{id}` | Editing a `published`/`unavailable` listing returns it to `pending` for re-review. Not allowed for `closed`/`suspended`. |
| DELETE | `/owner/properties/{id}` | Only `draft`/`rejected`. Soft delete. |
| POST | `/owner/properties/{id}/submit` | `draft`/`rejected` → `pending`. Requires ≥1 image and complete required fields. |
| POST | `/owner/properties/{id}/availability` | `{ available: bool }` toggles `published` ↔ `unavailable`. |
| POST | `/owner/properties/{id}/close` | Owner withdraws listing → `closed`. |
| POST | `/owner/properties/{id}/images` | multipart `images[]` — JPEG/PNG/WebP, ≤5 MB each, ≤10 total. Content-sniffed, re-encoded (EXIF/GPS stripped), random filenames. All-or-nothing. |
| PUT | `/owner/properties/{id}/images/order` | `{ image_ids: [..] }` |
| DELETE | `/owner/properties/{id}/images/{imageId}` | |

## Team (`/team`, roles `team_member` or `admin`)

Lead scope: team members see leads assigned to them plus unassigned leads; `leads.view_all` or admin sees all.

| Method | Path | Notes |
|---|---|---|
| GET | `/team/dashboard` | All metrics in the brief, `?from=&to=` date filter. Financial figures scoped to own deals unless `finance.manage`/admin. |
| GET | `/team/members` | Active team members (for assignment dropdowns). |
| GET | `/team/leads` | Filters: `status`, `interest`, `assigned` (`me`,`unassigned`,id), `source`, `q`, `from`, `to`, `follow_up` (`today`,`overdue`), `sort`. |
| POST | `/team/leads` | Manual lead (phone / walk-in / referral). |
| GET | `/team/leads/{id}` | Lead + activities + follow-ups + visits + deals + property owner contact + owner notes. |
| PUT | `/team/leads/{id}` | Update requirements, budget, contact details. |
| POST | `/team/leads/{id}/assign` | `{ user_id }`. Self-claim of unassigned lead allowed; assigning others needs `leads.assign`. |
| POST | `/team/leads/{id}/status` | `{ status, reason? }`. Transition map enforced (409 otherwise). `won` only via deal closure. |
| POST | `/team/leads/{id}/activities` | `{ type, outcome?, body }`. Calls/WhatsApp increment `contact_attempts`; connected calls set `last_contacted_at` and move `new/assigned` → `contacted`. |
| POST | `/team/leads/{id}/follow-ups` | `{ due_at, channel, notes?, assigned_to? }` |
| GET | `/team/follow-ups` | `?when=today|overdue|upcoming|done`, `?mine=1` |
| PATCH | `/team/follow-ups/{id}` | `{ action: complete|cancel|reschedule, outcome?, due_at? }` |
| GET | `/team/site-visits` | `?status=&from=&to=&mine=` |
| POST | `/team/site-visits` | `{ lead_id, property_id, scheduled_at, assigned_to?, notes? }` |
| PATCH | `/team/site-visits/{id}` | `{ status?, scheduled_at?, owner_confirmed?, notes?, customer_feedback? }` |
| GET | `/team/properties` | All non-deleted listings with filters (internal view). |
| GET | `/team/properties/{id}` | Includes private address, owner contact, coordination notes, related leads/deals. |
| POST | `/team/properties/{id}/owner-notes` | `{ type, body, lead_id?, deal_id? }` |
| GET | `/team/customers` | Leads grouped by normalised phone. |
| GET | `/team/deals` | Scope: own deals; all with `finance.manage`/admin. |
| POST | `/team/deals` | `{ lead_id, property_id, final_price?, … }` → `negotiation`; lead → `negotiation`. |
| GET | `/team/deals/{id}` | Deal + agreements + ledger + documents + audit trail. |
| PUT | `/team/deals/{id}` | Terms; changing `final_price` recalculates the estimate and estimated agreements only. |
| POST | `/team/deals/{id}/status` | `{ status, reason? }`. `closed_won` requires final price + ≥1 agreed brokerage agreement; sets lead `won` and property `closed`. |
| POST | `/team/brokerage/estimate` | Preview calculation for a deal/property/price. |
| POST | `/team/deals/{id}/agreements` | `{ party, party_name?, agreed_amount?, override_reason?, due_date? }` |
| PATCH | `/team/agreements/{id}` | Change agreed amount (reason required), due date, invoice ref, cancel (reason). `finance.manage` for amount/cancel. |
| POST | `/team/agreements/{id}/payments` | `{ type: payment|refund|waiver, amount, payment_date, method?, reference_number?, receipt_number?, notes? }` — `finance.manage`. |
| POST | `/team/payments/{id}/void` | `{ reason }` — `finance.manage`. |
| POST | `/team/deals/{id}/documents` | multipart: `type`, `title`, `reference_number?`, `file?` (PDF/JPEG/PNG ≤10 MB, private disk). |
| GET | `/team/documents/{id}/download` | Authorised stream. |
| DELETE | `/team/documents/{id}` | |
| GET | `/team/brokerage/summary` | Finance report (scoped). |

## Admin (`/admin`, role `admin`; property moderation also open to `properties.moderate`)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/dashboard` | Platform-wide counts. |
| GET | `/admin/properties` | Filters `status`, `purpose`, `q`, `owner`. |
| GET | `/admin/properties/{id}` | Full record incl. private fields. |
| PUT | `/admin/properties/{id}` | Edit any field (audited). |
| POST | `/admin/properties/{id}/approve` | `pending` → `published`; sets `published_at`, `expires_at` (settings `listing_validity_days`). |
| POST | `/admin/properties/{id}/reject` | `{ reason }` required. |
| POST | `/admin/properties/{id}/status` | `{ status: suspended|published|unavailable|closed|expired, reason? }` — reason required for `suspended`. |
| POST | `/admin/properties/{id}/feature` | `{ featured: bool }` |
| GET/POST | `/admin/users` | List / create team members and admins. |
| PUT | `/admin/users/{id}` | Role, permissions, active flag, details. Admin cannot demote/deactivate self. |
| CRUD | `/admin/localities`, `/admin/amenities` | Delete blocked when in use (deactivate instead). |
| CRUD | `/admin/brokerage-rules` | Validation per method; every change audited. |
| GET/PUT | `/admin/settings` | |
| GET | `/admin/audit-logs` | Filters `action`, `entity`, `user_id`, `from`, `to`. |
| GET | `/admin/reports/finance` | Potential / agreed / invoiced / collected / outstanding / refunded / waived; by month, team member, locality, rent vs sale; `?from=&to=`. |

## Added during implementation

| Method | Path | Notes |
|---|---|---|
| GET | `/team/notifications` | Latest 20 in-app notifications (new enquiries, visit requests, assignments) + unread count. |
| POST | `/team/notifications/read` | Mark all read. |
| POST | `/team/deals/{id}/reapply-rule` | Re-run rule matching on an open deal (estimates only). |
| POST | `/admin/brokerage-rules/preview` | Calculate an estimate for arbitrary inputs with the currently matching rule. |
| POST/PUT/DELETE | `/admin/properties/{id}/images…` | Moderators can manage listing photos. |

Rate limits: enquiries 5/min and 30/day per IP; auth endpoints 10/min per IP; login 5 failed attempts per email+IP per minute; uploads 20/min; general API 240/min.
