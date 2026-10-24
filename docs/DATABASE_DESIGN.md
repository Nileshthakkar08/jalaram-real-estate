# Database Design (MySQL 8)

All tables use `BIGINT UNSIGNED` auto-increment primary keys, `utf8mb4_unicode_ci`, InnoDB with foreign keys. Money is `DECIMAL(14,2)` in INR; percentages are `DECIMAL(7,4)`. PHP code converts money to integer paise for arithmetic (no floating point). Migrations live in `api/database/migrations`.

## Entity overview

```
users ─┬─< properties >── localities
       │      ├─< property_images
       │      ├─<> amenities (amenity_property)
       │      └─< owner_coordination_notes
       ├─< leads (assigned_to) ──< lead_activities
       │      ├─< follow_ups
       │      └─< site_visits >── properties
       └─< deals (assigned_to) >── properties, leads, users(owner)
              ├─< brokerage_agreements ──< brokerage_payments
              └─< deal_documents
brokerage_rules (admin-managed, referenced by deals)
audit_logs (polymorphic: any auditable model)
settings (key/value), notifications (Laravel), sessions, password_reset_tokens
```

## Tables

### users
| Column | Type | Notes |
|---|---|---|
| name, email (unique), phone | string | |
| role | enum `owner`,`team_member`,`admin` | Registration always creates `owner`. Only admins change roles. |
| permissions | json null | Team-member grants: `leads.view_all`, `leads.assign`, `properties.moderate`, `finance.manage`. Admins implicitly have all. |
| is_active | bool | Inactive users cannot sign in; their listings drop out of public search. |
| email_verified_at, password (bcrypt), remember_token, last_login_at | | |
| timestamps, deleted_at | | Soft delete. |

### localities
`name` (unique), `slug` (unique), `city` (default Ahmedabad), `description`, `image_url`, `is_active`, `sort_order`, timestamps.

### amenities / amenity_property
`amenities`: `name` (unique), `slug` (unique), `is_active`, `sort_order`. Pivot `amenity_property(property_id, amenity_id)` composite PK, cascade on delete.

### properties
| Column | Notes |
|---|---|
| owner_id FK users | Owner who listed it. |
| reference_code unique | `JRE-000123`, generated after insert. |
| title, slug (unique), description | Slug = title + reference, regenerated only while draft. |
| listing_purpose enum `sale`,`rent` | |
| property_type enum `apartment`,`independent_house`,`villa`,`plot` | |
| locality_id FK | |
| public_address | Approximate area shown publicly (e.g. "Near Iscon Cross Roads"). |
| private_address, pincode | **Private** — exact address for team coordination. Never in public API. |
| price DECIMAL(14,2) | Asking sale price, or monthly rent. |
| security_deposit, maintenance_charges | Rent-related, nullable. |
| price_negotiable bool | |
| area_sqft, bedrooms, bathrooms, balconies, floor_number, total_floors | |
| furnishing enum, facing, property_age_years, available_from | |
| owner_contact_name, owner_contact_phone, owner_contact_email | **Private** coordination contact (defaults to owner's account details). |
| status enum | `draft`,`pending`,`published`,`rejected`,`unavailable`,`expired`,`closed`,`suspended` |
| rejection_reason | Shown to owner. |
| moderation_note | Internal only. |
| is_featured | Admin-controlled. |
| submitted_at, published_at, expires_at, reviewed_at, reviewed_by FK | |
| timestamps, deleted_at | Soft delete. |

Indexes: `(status, listing_purpose, locality_id)`, `price`, `bedrooms`, `owner_id`, `expires_at`.

**Public eligibility** (single query scope `Property::publiclyVisible()`): `status = published` AND (`expires_at` IS NULL OR > now) AND not soft-deleted AND owner `is_active`.

### property_images
`property_id` (cascade), `disk`, `path`, `mime_type`, `size_bytes`, `width`, `height`, `sort_order`, `alt_text`. Cover = lowest `sort_order`. Max 10 per property enforced in a locked transaction.

### leads
| Column | Notes |
|---|---|
| reference_code | `LD-000123` |
| name, phone, phone_normalized (indexed), email | `phone_normalized` = last 10 digits, used for duplicate detection and customer grouping. |
| property_id FK null | Enquired property. |
| interest enum | `buy`,`rent`,`sell`,`general` |
| source enum | `website`,`phone`,`whatsapp`,`walk_in`,`referral`,`social`,`other` |
| source_page, utm_source, utm_medium, utm_campaign | Attribution. |
| budget_min, budget_max | DECIMAL(14,2) |
| preferred_locality_id FK, preferred_bhk | |
| message | Customer's original message. |
| requirements | Team-recorded requirements. |
| preferred_visit_date, preferred_visit_slot | From site-visit requests. |
| status enum | `new`,`assigned`,`contacted`,`qualified`,`site_visit`,`negotiation`,`won`,`lost`,`cancelled` |
| closed_reason | Required for `lost` / `cancelled`. |
| assigned_to FK users, assigned_at | |
| next_follow_up_at | Denormalised = earliest pending follow-up. |
| last_contacted_at, contact_attempts | |
| consent_contact, consent_marketing | Separate consents. |
| ip_address | Spam/rate-limit forensics. |
| timestamps, deleted_at | |

### lead_activities
`lead_id`, `user_id` (null = system), `type` (`created`,`note`,`call`,`whatsapp`,`email`,`sms`,`meeting`,`status_change`,`assignment`,`follow_up`,`site_visit`,`owner_coordination`,`requirement`,`negotiation`,`deal`), `outcome` (e.g. `connected`,`no_answer`,`busy`,`wrong_number`), `body`, `meta` json, timestamps. Append-only.

### follow_ups
`lead_id`, `assigned_to`, `created_by`, `due_at`, `channel` (`call`,`whatsapp`,`email`,`meeting`,`other`), `notes`, `status` (`pending`,`done`,`cancelled`), `completed_at`, `completed_by`, `outcome`. Index `(status, due_at)`, `(assigned_to, status)`.

### site_visits
`lead_id`, `property_id`, `status` (`requested`,`scheduled`,`completed`,`cancelled`,`no_show`), `requested_date`, `requested_slot`, `scheduled_at`, `assigned_to`, `owner_confirmed`, `notes`, `customer_feedback`, `created_by`, timestamps.

### owner_coordination_notes
`property_id`, `lead_id` null, `deal_id` null, `user_id`, `type` (`availability`,`confirmed_price`,`viewing_availability`,`negotiation`,`owner_response`,`agreed_terms`,`general`), `body`, timestamps. Internal only.

### brokerage_rules
| Column | Notes |
|---|---|
| name, notes | |
| transaction_type enum `sale`,`rent` | |
| method enum `fixed`,`percentage`,`negotiated` | |
| fixed_amount DECIMAL(14,2) | For `fixed`. |
| percentage DECIMAL(7,4) | For `percentage`. |
| percentage_basis enum | `monthly_rent`,`annual_rent`,`final_sale_price`,`asking_price` |
| min_amount, max_amount | Optional floor/cap. |
| payer enum | `owner`,`tenant`,`buyer`,`seller`,`split` |
| split_shares json | e.g. `{"owner": 50, "tenant": 50}` — must total 100. |
| property_type, locality_id | Optional scope. |
| effective_from, effective_to | Date range. |
| is_active, priority | |
| created_by, updated_by, timestamps, deleted_at | Every change audited. |

Rule selection: active, matching type, date in range; most specific wins (locality+type > locality > type > general), then `priority`, then latest `effective_from`. **No amounts are hardcoded** — the seeder creates *example* development rules only.

### deals
| Column | Notes |
|---|---|
| reference_code | `DL-000123` |
| property_id, lead_id, owner_id, assigned_to, created_by | |
| transaction_type enum `sale`,`rent` | |
| status enum | `negotiation`,`agreement_pending`,`closed_won`,`closed_lost`,`cancelled` |
| customer_name, customer_phone | Snapshot of counterparty. |
| asking_price | Snapshot of listing price at deal creation. |
| final_price | Final sale price or final monthly rent. |
| security_deposit, lease_start_date, lease_term_months | Rent. |
| brokerage_rule_id, brokerage_basis json | Snapshot of rule + calculation explanation. |
| estimated_brokerage | Recomputed when final price changes. |
| negotiation_notes, closed_reason, agreement_date, closed_at | |
| timestamps, deleted_at | |

### brokerage_agreements (one row per responsible party)
| Column | Notes |
|---|---|
| deal_id, party (`owner`,`tenant`,`buyer`,`seller`), party_name, party_phone | |
| estimated_amount | From rule (party's share). |
| agreed_amount | What the party actually agreed. Never silently overwritten. |
| is_override, override_reason | Required when agreed ≠ estimate or when changed later. |
| due_date | |
| invoice_number, invoice_date, invoiced_amount | Invoice reference (no invoice PDF generation). |
| amount_received, amount_refunded, amount_waived, outstanding_amount | Maintained by `BrokerageLedger` in a transaction from `brokerage_payments`. |
| status | `estimated`,`agreed`,`due`,`partially_paid`,`paid`,`cancelled`,`waived`,`refunded` |
| agreed_at, agreed_by, cancelled_reason, notes | |

Derived status rules: cancelled stays cancelled → no agreed amount = `estimated` → fully refunded = `refunded` → waived covers the whole balance and nothing net received = `waived` → outstanding ≤ 0 = `paid` → net received > 0 = `partially_paid` → invoiced or due date reached = `due` → otherwise `agreed`.

`outstanding = agreed − (received − refunded) − waived`, never below 0.

### brokerage_payments (ledger, append-only)
`brokerage_agreement_id`, `deal_id`, `type` (`payment`,`refund`,`waiver`), `amount` (> 0), `payment_date`, `method` (`cash`,`bank_transfer`,`upi`,`cheque`,`card`,`other`), `reference_number`, `receipt_number`, `notes`, `recorded_by`, `voided_at`, `voided_by`, `void_reason`. Entries are voided, never deleted. Refunds cannot exceed net received; waivers cannot exceed outstanding; payments cannot exceed outstanding.

### deal_documents
`deal_id`, `type` (`agreement`,`token_receipt`,`invoice`,`receipt`,`id_proof`,`other`), `title`, `reference_number`, `disk`, `path` (private disk, nullable), `mime_type`, `size_bytes`, `uploaded_by`.

### audit_logs
`user_id`, `action`, `auditable_type`, `auditable_id`, `old_values` json, `new_values` json, `reason`, `ip_address`, `user_agent`, `created_at`. Written for: role/permission/user changes, property moderation, brokerage rule changes, deal status changes, agreement create/override/cancel, every payment/refund/waiver/void, settings changes, lead assignment.

### settings
`key` (unique), `value` (text), `is_public`. Public keys (business phone, WhatsApp, email, address, hours, social URLs) are exposed via `/settings/public`; empty values are hidden in the UI.

## Seeders

- `ReferenceDataSeeder` (safe for production): Ahmedabad localities, amenities, empty settings keys.
- `DevelopmentSeeder` (refuses to run when `APP_ENV=production`): demo users for each role, sample owner listings with placeholder images, example brokerage rules, sample leads. Demo data is clearly labelled.
