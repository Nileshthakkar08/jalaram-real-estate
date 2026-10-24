# Implementation Plan

## Repository layout

```
jalaram-real-estate/
├── project/   Next.js 13.5 frontend (original Bolt export, preserved and extended)
├── api/       Laravel 13 REST API (new)
└── docs/      Project documentation
```

The frontend stays in `project/` instead of moving to `apps/web` — see `PROJECT_AUDIT.md` §3.

## Phases

| # | Phase | Scope |
|---|---|---|
| 1 | Audit | Inspect repo; write audit, route inventory, plan, DB design, API spec, deployment notes. |
| 2 | Foundation | Laravel + Sanctum, MySQL schema, models, enums, policies, audit logging, auth endpoints, Next.js API client + same-origin proxy, auth context rewrite, patch Next.js to 13.5.11, remove Supabase. |
| 3 | Public site | Wire search to API; fix filters/pagination; property detail with full gallery, enquiry and site-visit forms; create `/sell-property`, `/list-property`, `/areas/[slug]`, `/about`, `/contact`, `/privacy-policy`, `/terms`, sitemap, robots, 404; settings-driven contact details; honest copy. |
| 4 | Owner portal | Dashboard, listing CRUD form, image upload/order/delete, submit for approval, status + rejection reason, availability, profile. |
| 5 | Team leads | Inbox with scope rules, lead detail timeline, assignment, status transitions, call logs, follow-ups, site visits, owner coordination notes, customers. |
| 6 | Deals & brokerage | Rules engine, deals, per-party agreements with override reasons, invoice references, ledger (payments/refunds/waivers/voids), outstanding balances, documents, finance reports. |
| 7 | Admin | Moderation, users/roles/permissions, localities, amenities, settings, audit logs, reports, brokerage rules. |
| 8 | Testing & security | PHPUnit feature tests per area + full end-to-end workflow test; frontend unit tests (Vitest); typecheck, lint, production build; HTTP smoke test through the Next.js proxy. |
| 9 | Deployment | `DEPLOYMENT.md`, env examples, Nginx config, scheduler, backups. |

## Key design decisions

1. **Same-origin cookie auth** (Sanctum SPA) — avoids tokens in `localStorage` and CORS complexity.
2. **State machines in services** (`PropertyWorkflow`, `LeadWorkflow`, `DealWorkflow`) — controllers never set status directly; invalid transitions return `409`.
3. **Brokerage is never derived from property price at report time.** Rules produce *estimates*; humans record *agreements* per party; the *ledger* records money. Reports read each layer separately.
4. **Integer-paise money maths** (`App\Support\Money`) — no floats, no `bcmath` dependency.
5. **Audit log** written by an `AuditLogger` service inside the same DB transaction as the change.
6. **Images** re-encoded with GD to strip EXIF/GPS (owners' home locations) and neutralise polyglot files; stored on a configurable disk (`public` locally, any S3-compatible bucket in production).
7. **Contact details** come from admin settings; nothing invented is shown publicly.
8. **No live payment gateway** — payments are recorded manually by finance-authorised staff.

## Out of scope / deferred (documented, not silently skipped)

- Cloudinary SDK (S3-compatible storage is implemented; Cloudinary can be added later behind the same disk abstraction).
- PDF invoice generation (invoice numbers/dates/amounts are recorded; documents can be uploaded).
- SMS/WhatsApp Business API sending (WhatsApp click-to-chat links are configurable).
- GST/TDS calculations — require professional review before configuring.

## Status (23 Oct 2026)

Phases 1–9 are implemented. See `ROUTE_INVENTORY.md` for exactly what was verified and what wasn't. Known gaps and next steps:

- Add Playwright UI tests for the main dashboard flows.
- Configure SMTP. Until then, password-reset and verification emails go to `api/storage/logs/laravel.log`.
- Enter real business details in `/admin/settings` and replace the example brokerage rules with the agreed policy.
- Professional review of the privacy policy, terms, and the tax treatment of brokerage.
