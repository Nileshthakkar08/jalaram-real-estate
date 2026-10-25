export type UserRole = 'owner' | 'team_member' | 'admin';
export type Permission = 'leads.view_all' | 'leads.assign' | 'properties.moderate' | 'finance.manage';

export type ListingPurpose = 'sale' | 'rent';
export type PropertyType = 'apartment' | 'independent_house' | 'villa' | 'plot';
export type FurnishingStatus = 'unfurnished' | 'semi_furnished' | 'fully_furnished';
export type ListingStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'unavailable' | 'expired' | 'closed' | 'suspended';

export type LeadInterest = 'buy' | 'rent' | 'sell' | 'general';
export type LeadSource = 'website' | 'phone' | 'whatsapp' | 'walk_in' | 'referral' | 'social' | 'other';
export type LeadStatus = 'new' | 'assigned' | 'contacted' | 'qualified' | 'site_visit' | 'negotiation' | 'won' | 'lost' | 'cancelled';
export type SiteVisitStatus = 'requested' | 'scheduled' | 'completed' | 'cancelled' | 'no_show';
export type DealStatus = 'negotiation' | 'agreement_pending' | 'closed_won' | 'closed_lost' | 'cancelled';
export type BrokerageParty = 'owner' | 'tenant' | 'buyer' | 'seller';
export type AgreementStatus = 'estimated' | 'agreed' | 'due' | 'partially_paid' | 'paid' | 'cancelled' | 'waived' | 'refunded';

/** Money values arrive from the API as decimal strings, e.g. "10000.00". */
export type Money = string;

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  permissions: Permission[];
  granted_permissions: Permission[];
  is_active: boolean;
  email_verified: boolean;
  last_login_at: string | null;
  created_at: string;
  properties_count?: number;
  assigned_leads_count?: number;
}

export interface Locality {
  id: number;
  name: string;
  slug: string;
  city: string;
  description: string | null;
  image_url: string | null;
  is_active?: boolean;
  sort_order?: number;
  listing_count?: number;
  properties_count?: number;
}

export interface Amenity {
  id: number;
  name: string;
  slug: string;
  is_active?: boolean;
  sort_order?: number;
  properties_count?: number;
}

export interface PropertyImage {
  id: number;
  url: string;
  width: number | null;
  height: number | null;
  sort_order: number;
  alt: string | null;
}

/** Public listing as served to visitors. Contains no owner or private data. */
export interface PublicProperty {
  id: number;
  reference_code: string;
  slug: string;
  title: string;
  listing_purpose: ListingPurpose;
  property_type: PropertyType;
  price: Money;
  price_negotiable: boolean;
  area_sqft: number;
  bedrooms: number | null;
  bathrooms: number | null;
  furnishing: FurnishingStatus | null;
  public_address: string;
  is_featured: boolean;
  locality?: { name: string; slug: string; has_page?: boolean };
  cover_image: PropertyImage | null;
  published_at: string | null;
  updated_at: string | null;
  // detail-only
  description?: string;
  security_deposit?: Money | null;
  maintenance_charges?: Money | null;
  balconies?: number | null;
  floor_number?: number | null;
  total_floors?: number | null;
  facing?: string | null;
  property_age_years?: number | null;
  available_from?: string | null;
  images?: PropertyImage[];
  amenities?: { name: string; slug: string }[];
}

/** A listing as its owner or the team sees it. */
export interface ManagedProperty {
  id: number;
  reference_code: string;
  slug: string;
  title: string;
  description: string;
  listing_purpose: ListingPurpose;
  property_type: PropertyType;
  locality_id: number;
  locality?: { id: number; name: string; slug: string };
  public_address: string;
  private_address: string | null;
  pincode: string | null;
  price: Money;
  security_deposit: Money | null;
  maintenance_charges: Money | null;
  price_negotiable: boolean;
  area_sqft: number;
  bedrooms: number | null;
  bathrooms: number | null;
  balconies: number | null;
  floor_number: number | null;
  total_floors: number | null;
  furnishing: FurnishingStatus | null;
  facing: string | null;
  property_age_years: number | null;
  available_from: string | null;
  owner_contact_name: string | null;
  owner_contact_phone: string | null;
  owner_contact_email: string | null;
  status: ListingStatus;
  rejection_reason: string | null;
  is_featured: boolean;
  is_public: boolean;
  submitted_at: string | null;
  published_at: string | null;
  expires_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  images?: PropertyImage[];
  cover_image: PropertyImage | null;
  amenity_ids?: number[];
  amenities?: { id: number; name: string; slug: string }[];
  // staff-only
  moderation_note?: string | null;
  owner?: { id: number; name: string; email: string; phone: string | null; is_active: boolean };
  coordination_contact?: { name: string | null; phone: string | null; email: string | null };
  reviewer?: { id: number; name: string } | null;
  leads_count?: number | null;
  deals_count?: number | null;
}

export interface Lead {
  id: number;
  reference_code: string;
  name: string;
  phone: string;
  email: string | null;
  interest: LeadInterest;
  source: LeadSource;
  source_page: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  budget_min: Money | null;
  budget_max: Money | null;
  preferred_bhk: number | null;
  preferred_locality_id: number | null;
  preferred_locality?: { id: number; name: string } | null;
  message: string | null;
  requirements: string | null;
  preferred_visit_date: string | null;
  preferred_visit_slot: string | null;
  status: LeadStatus;
  closed_reason: string | null;
  assigned_to: number | null;
  assignee?: { id: number; name: string } | null;
  assigned_at: string | null;
  next_follow_up_at: string | null;
  last_contacted_at: string | null;
  contact_attempts: number;
  consent_contact: boolean;
  consent_marketing: boolean;
  property?: {
    id: number; title: string; slug: string; reference_code: string; listing_purpose: ListingPurpose;
    price: Money; status: ListingStatus; public_address: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface LeadActivity {
  id: number;
  type: string;
  outcome: string | null;
  body: string | null;
  meta: Record<string, unknown> | null;
  user?: { id: number; name: string } | null;
  created_at: string;
}

export interface FollowUp {
  id: number;
  lead_id: number;
  lead?: { id: number; reference_code: string; name: string; phone: string; status: LeadStatus; interest: LeadInterest } | null;
  assignee?: { id: number; name: string } | null;
  due_at: string;
  channel: string;
  notes: string | null;
  status: 'pending' | 'done' | 'cancelled';
  outcome: string | null;
  completed_at: string | null;
  is_overdue: boolean;
}

export interface SiteVisit {
  id: number;
  lead_id: number;
  lead?: { id: number; reference_code: string; name: string; phone: string } | null;
  property?: { id: number; title: string; reference_code: string; public_address: string; private_address: string | null } | null;
  assignee?: { id: number; name: string } | null;
  assigned_to: number | null;
  status: SiteVisitStatus;
  requested_date: string | null;
  requested_slot: string | null;
  scheduled_at: string | null;
  owner_confirmed: boolean;
  notes: string | null;
  customer_feedback: string | null;
  created_at: string;
}

export interface OwnerNote {
  id: number;
  property_id: number;
  lead_id: number | null;
  deal_id: number | null;
  type: string;
  body: string;
  user?: { id: number; name: string } | null;
  created_at: string;
}

export interface BrokeragePayment {
  id: number;
  brokerage_agreement_id: number;
  type: 'payment' | 'refund' | 'waiver';
  amount: Money;
  payment_date: string;
  method: string | null;
  reference_number: string | null;
  receipt_number: string | null;
  notes: string | null;
  recorded_by?: { id: number; name: string } | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
}

export interface BrokerageAgreement {
  id: number;
  deal_id: number;
  party: BrokerageParty;
  party_name: string | null;
  party_phone: string | null;
  estimated_amount: Money | null;
  agreed_amount: Money | null;
  is_override: boolean;
  override_reason: string | null;
  due_date: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  invoiced_amount: Money;
  amount_received: Money;
  amount_refunded: Money;
  amount_waived: Money;
  outstanding_amount: Money;
  status: AgreementStatus;
  agreed_at: string | null;
  agreed_by?: { id: number; name: string } | null;
  cancelled_reason: string | null;
  notes: string | null;
  payments?: BrokeragePayment[];
}

export interface BrokerageEstimate {
  rule_id: number | null;
  rule_name: string | null;
  method: string | null;
  basis: string | null;
  basis_amount: Money | null;
  percentage: string | null;
  fixed_amount: Money | null;
  total: Money | null;
  shares: Record<string, Money>;
  explanation: string;
}

export interface DealDocument {
  id: number;
  type: string;
  title: string;
  reference_number: string | null;
  has_file: boolean;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by?: { id: number; name: string } | null;
  created_at: string;
}

export interface Deal {
  id: number;
  reference_code: string;
  status: DealStatus;
  transaction_type: ListingPurpose;
  customer_name: string;
  customer_phone: string | null;
  asking_price: Money;
  final_price: Money | null;
  security_deposit: Money | null;
  lease_start_date: string | null;
  lease_term_months: number | null;
  estimated_brokerage: Money | null;
  brokerage_basis: BrokerageEstimate | null;
  rule?: { id: number; name: string; method: string } | null;
  negotiation_notes: string | null;
  closed_reason: string | null;
  agreement_date: string | null;
  closed_at: string | null;
  assigned_to: number | null;
  assignee?: { id: number; name: string } | null;
  lead?: { id: number; reference_code: string; name: string; phone: string; status: LeadStatus } | null;
  property?: {
    id: number; title: string; reference_code: string; status: ListingStatus; property_type: PropertyType;
    locality: string | null; coordination_contact: { name: string | null; phone: string | null; email: string | null };
  } | null;
  owner?: { id: number; name: string; phone: string | null; email: string } | null;
  agreements?: BrokerageAgreement[];
  documents?: DealDocument[];
  totals?: { agreed: Money; invoiced: Money; received: Money; refunded: Money; waived: Money; outstanding: Money };
  created_at: string;
  updated_at: string;
}

export interface BrokerageRule {
  id: number;
  name: string;
  transaction_type: ListingPurpose;
  method: 'fixed' | 'percentage' | 'negotiated';
  fixed_amount: Money | null;
  percentage: string | null;
  percentage_basis: 'monthly_rent' | 'annual_rent' | 'final_sale_price' | 'asking_price' | null;
  min_amount: Money | null;
  max_amount: Money | null;
  payer: 'owner' | 'tenant' | 'buyer' | 'seller' | 'split';
  split_shares: Record<string, number> | null;
  property_type: PropertyType | null;
  locality_id: number | null;
  locality?: { id: number; name: string } | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  priority: number;
  notes: string | null;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  action: string;
  auditable_type: string | null;
  auditable_id: number | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  reason: string | null;
  ip_address: string | null;
  user?: { id: number; name: string; role: UserRole } | null;
  created_at: string;
}

export interface FinanceRow { key: string | number; label: string; agreed: Money; collected: Money; outstanding: Money }

export interface FinanceReport {
  period: { from: string; to: string };
  scope?: 'all' | 'own_deals';
  totals: {
    potential: Money; agreed: Money; invoiced: Money; received: Money; refunded: Money;
    collected: Money; waived: Money; outstanding: Money; agreed_pending_closure: Money;
  };
  by_month: { month: string; agreed: Money; collected: Money }[];
  by_team_member: FinanceRow[];
  by_locality: FinanceRow[];
  by_transaction_type: FinanceRow[];
}

export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export type PublicSettings = Partial<Record<
  'business_phone' | 'business_whatsapp' | 'business_email' | 'business_address' | 'business_hours'
  | 'social_instagram' | 'social_facebook' | 'rera_registration', string>>;
