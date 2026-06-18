-- Parcel — SMS consent ledger (TCPA). Texting requires prior express consent
-- with a documented source + timestamp, and an honored opt-out. This table is
-- that paper trail: one row per opt-in/opt-out event, latest row per phone wins.
-- A change here is a keystone change — re-check @parcel/types + the send gate.

create table if not exists sms_consents (
  id uuid primary key default gen_random_uuid(),
  phone text not null,                 -- digits-only, normalized
  consented boolean not null default true,
  source text,                         -- 'web_optin' | 'reply' | 'STOP' | 'HELP'
  owner_id uuid references owners(id) on delete set null,
  buyer_id uuid references buyers(id) on delete set null,
  consented_at timestamptz default now(),
  revoked_at timestamptz,              -- set when the contact texts STOP
  created_at timestamptz default now()
);
create index if not exists idx_sms_consents_phone on sms_consents(phone);

alter table sms_consents enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'sms_consents' and policyname = 'sms_consents_authenticated_all'
  ) then
    create policy sms_consents_authenticated_all on sms_consents
      for all to authenticated using (true) with check (true);
  end if;
end $$;
