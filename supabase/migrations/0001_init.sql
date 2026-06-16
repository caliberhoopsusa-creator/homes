-- Parcel — Phase 0 keystone schema (PRD §5).
-- Every service codes against these tables and the generated types in @parcel/types.
-- A change here requires review across all modules.

create extension if not exists "pgcrypto";

-- ── properties: the raw asset ────────────────────────────────────────────────
create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  source text not null,                 -- 'attom' | 'batchdata' | 'firecrawl' | 'county' | 'manual'
  source_id text,
  address text not null,
  city text, state text, zip text,
  lat double precision, lng double precision,
  beds int, baths numeric, sqft int, year_built int,
  est_value numeric,                    -- provider AVM
  asking numeric,                       -- if listed/known
  distress_signals text[],              -- ['tax_delinquent','preforeclosure','vacant','absentee']
  created_at timestamptz default now(),
  unique (source, source_id)
);

-- ── owners: who we actually email (a house can't read) ───────────────────────
create table if not exists owners (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade,
  full_name text,
  email text, phone text, mailing_address text,
  skiptrace_status text default 'pending', -- pending|matched|none
  skiptrace_confidence numeric,
  created_at timestamptz default now()
);

-- ── underwrites: the 70% math, one row per property ──────────────────────────
create table if not exists underwrites (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade,
  arv numeric, repairs numeric,
  rule_pct numeric default 0.70, fee_target numeric default 10000,
  buyer_ceiling numeric,                -- arv*rule_pct - repairs
  your_mao numeric,                     -- buyer_ceiling - fee_target
  fee_potential numeric,                -- buyer_ceiling - asking
  is_estimate boolean default true,     -- arv/repairs from AVM heuristic until comps wired
  verdict text,                         -- 'clear' | 'thin' | 'pass'
  created_at timestamptz default now()
);

-- ── campaigns + messages: the outreach layer ─────────────────────────────────
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text, status text default 'active',
  from_domain text, daily_cap int default 50,
  created_at timestamptz default now()
);
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id),
  owner_id uuid references owners(id) on delete cascade,
  step int default 1,                   -- which touch in the sequence
  direction text default 'outbound',    -- outbound | inbound
  subject text, body text,
  status text,                          -- queued|sent|delivered|opened|bounced|replied|unsubscribed
  provider_id text,
  sent_at timestamptz, created_at timestamptz default now()
);

-- ── replies → intent → gated contract ────────────────────────────────────────
create table if not exists replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references messages(id),
  owner_id uuid references owners(id),
  raw_text text,
  intent text,                          -- 'interested'|'maybe'|'not_now'|'do_not_contact'|'unknown'
  intent_confidence numeric,
  created_at timestamptz default now()
);
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id),
  owner_id uuid references owners(id),
  offer_price numeric,
  pdf_url text,
  status text default 'queued',         -- queued|approved|sent|signed|void
  created_at timestamptz default now()
);

-- ── suppression list (CAN-SPAM §8.2): permanent opt-outs ─────────────────────
create table if not exists suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  reason text,                          -- 'unsubscribe' | 'do_not_contact'
  created_at timestamptz default now(),
  unique (email)
);

-- ── the desk: deals + buyers + matches ───────────────────────────────────────
create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id),
  stage text default 'Lead',            -- Lead|Contacted|Under contract|Assigned|Closed
  notes text, created_at timestamptz default now()
);
create table if not exists buyers (
  id uuid primary key default gen_random_uuid(),
  name text, type text,
  min_price numeric, max_price numeric, min_beds int,
  areas text[], max_repairs numeric, notes text,
  created_at timestamptz default now()
);
create table if not exists matches (
  deal_id uuid references deals(id) on delete cascade,
  buyer_id uuid references buyers(id) on delete cascade,
  score int, qualifies boolean,
  primary key (deal_id, buyer_id)
);

-- ── helpful indexes ──────────────────────────────────────────────────────────
create index if not exists idx_owners_property on owners(property_id);
create index if not exists idx_underwrites_property on underwrites(property_id);
create index if not exists idx_messages_owner on messages(owner_id);
create index if not exists idx_replies_owner on replies(owner_id);
create index if not exists idx_deals_property on deals(property_id);

-- ── RLS (§8.5): owner contact data is PII. Single-operator app: lock to ───────
-- service_role; the desk uses an authenticated session. Tighten per-table as auth lands.
alter table properties  enable row level security;
alter table owners      enable row level security;
alter table underwrites enable row level security;
alter table campaigns   enable row level security;
alter table messages    enable row level security;
alter table replies     enable row level security;
alter table contracts   enable row level security;
alter table suppressions enable row level security;
alter table deals       enable row level security;
alter table buyers      enable row level security;
alter table matches     enable row level security;

-- Single-operator policy: any authenticated user may read/write. Replace with
-- per-operator scoping if multi-tenant is ever introduced (explicitly a non-goal in v1).
do $$
declare t text;
begin
  foreach t in array array[
    'properties','owners','underwrites','campaigns','messages',
    'replies','contracts','suppressions','deals','buyers','matches'
  ] loop
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true);',
      t || '_authenticated_all', t
    );
  end loop;
end $$;
