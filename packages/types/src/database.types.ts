// Hand-maintained to mirror supabase/migrations/0001_init.sql.
// When a real Supabase project is wired, replace with `supabase gen types typescript`.
// This is the keystone contract — every service imports row/insert shapes from here.

// ── string-literal enums used across the schema ──────────────────────────────
export type PropertySource = "attom" | "batchdata" | "firecrawl" | "manual";
export type SkiptraceStatus = "pending" | "matched" | "none";
export type Verdict = "clear" | "thin" | "pass";
export type DistressSignal =
  | "tax_delinquent"
  | "preforeclosure"
  | "vacant"
  | "absentee";
export type MessageDirection = "outbound" | "inbound";
export type MessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "bounced"
  | "replied"
  | "unsubscribed";
export type ReplyIntent =
  | "interested"
  | "maybe"
  | "not_now"
  | "do_not_contact"
  | "unknown";
export type ContractStatus = "queued" | "approved" | "sent" | "signed" | "void";
export type SuppressionReason = "unsubscribe" | "do_not_contact";
export type DealStage =
  | "Lead"
  | "Contacted"
  | "Under contract"
  | "Assigned"
  | "Closed";

// ── row shapes (what you read back) ──────────────────────────────────────────
export interface Property {
  id: string;
  source: PropertySource;
  source_id: string | null;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  year_built: number | null;
  est_value: number | null;
  asking: number | null;
  distress_signals: DistressSignal[] | null;
  created_at: string;
}

export interface Owner {
  id: string;
  property_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  mailing_address: string | null;
  skiptrace_status: SkiptraceStatus;
  skiptrace_confidence: number | null;
  created_at: string;
}

export interface Underwrite {
  id: string;
  property_id: string | null;
  arv: number | null;
  repairs: number | null;
  rule_pct: number;
  fee_target: number;
  buyer_ceiling: number | null;
  your_mao: number | null;
  fee_potential: number | null;
  is_estimate: boolean;
  verdict: Verdict | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string | null;
  status: string;
  from_domain: string | null;
  daily_cap: number;
  created_at: string;
}

export interface Message {
  id: string;
  campaign_id: string | null;
  owner_id: string | null;
  step: number;
  direction: MessageDirection;
  subject: string | null;
  body: string | null;
  status: MessageStatus | null;
  provider_id: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface Reply {
  id: string;
  message_id: string | null;
  owner_id: string | null;
  raw_text: string | null;
  intent: ReplyIntent | null;
  intent_confidence: number | null;
  created_at: string;
}

export interface Contract {
  id: string;
  property_id: string | null;
  owner_id: string | null;
  offer_price: number | null;
  pdf_url: string | null;
  status: ContractStatus;
  created_at: string;
}

export interface Suppression {
  id: string;
  email: string;
  reason: SuppressionReason | null;
  created_at: string;
}

export interface Deal {
  id: string;
  property_id: string | null;
  stage: DealStage;
  notes: string | null;
  created_at: string;
}

export interface Buyer {
  id: string;
  name: string | null;
  type: string | null;
  min_price: number | null;
  max_price: number | null;
  min_beds: number | null;
  areas: string[] | null;
  max_repairs: number | null;
  notes: string | null;
  created_at: string;
}

export interface Match {
  deal_id: string;
  buyer_id: string;
  score: number | null;
  qualifies: boolean | null;
}

// ── insert shapes (db-defaulted columns optional) ────────────────────────────
export type PropertyInsert = Omit<Property, "id" | "created_at"> &
  Partial<Pick<Property, "id" | "created_at">>;
export type OwnerInsert = Omit<Owner, "id" | "created_at" | "skiptrace_status"> &
  Partial<Pick<Owner, "id" | "created_at" | "skiptrace_status">>;
export type UnderwriteInsert = Omit<
  Underwrite,
  "id" | "created_at" | "rule_pct" | "fee_target" | "is_estimate"
> &
  Partial<Pick<Underwrite, "id" | "created_at" | "rule_pct" | "fee_target" | "is_estimate">>;
export type MessageInsert = Omit<Message, "id" | "created_at"> &
  Partial<Pick<Message, "id" | "created_at">>;
export type ReplyInsert = Omit<Reply, "id" | "created_at"> &
  Partial<Pick<Reply, "id" | "created_at">>;
export type ContractInsert = Omit<Contract, "id" | "created_at" | "status"> &
  Partial<Pick<Contract, "id" | "created_at" | "status">>;
export type BuyerInsert = Omit<Buyer, "id" | "created_at"> &
  Partial<Pick<Buyer, "id" | "created_at">>;
export type DealInsert = Omit<Deal, "id" | "created_at" | "stage"> &
  Partial<Pick<Deal, "id" | "created_at" | "stage">>;
