-- Parcel — Phase A keystone: automation plan (docs/AUTOMATION-PLAN.md).
-- Extends the §5 schema for: itemized MAO, comps confidence, buyer-dispo messages,
-- and the closing coordinator. All additive + idempotent; a change here requires
-- review across all modules (see @parcel/types database.types.ts).

-- ── underwrites: itemized MAO inputs + comps confidence ───────────────────────
-- holding/closing/buyer_profit_pct power Max Maxwell's full MAO formula
-- (arv - repairs - holding - closing - arv*buyer_profit_pct - fee_target).
-- When null, the engine falls back to the canonical 70% rule. comp_count records
-- how many real sold-comps backed the ARV (0 = heuristic estimate).
alter table underwrites add column if not exists holding_costs numeric;
alter table underwrites add column if not exists closing_costs numeric;
alter table underwrites add column if not exists buyer_profit_pct numeric;
alter table underwrites add column if not exists comp_count int;

-- ── messages: distinguish seller outreach from buyer-disposition blasts ───────
-- Both are CAN-SPAM-governed sends; this lets the desk/outreach report on each.
alter table messages add column if not exists kind text default 'seller_outreach';
  -- 'seller_outreach' | 'buyer_dispo'

-- ── deals: closing coordination fields ───────────────────────────────────────
alter table deals add column if not exists title_company text;
alter table deals add column if not exists closing_date date;

-- ── closing_tasks: Max's 5-phase "quarterback" close checklist ────────────────
create table if not exists closing_tasks (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade,
  phase text not null,        -- contract_to_assignment|buyer_selection|due_diligence|closing_prep|closing_day
  label text not null,
  status text default 'pending',  -- pending|done
  sort int default 0,         -- order within a phase
  due_at timestamptz,
  done_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_closing_tasks_deal on closing_tasks(deal_id);

-- ── RLS: same single-operator policy as the rest of the schema ────────────────
alter table closing_tasks enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'closing_tasks' and policyname = 'closing_tasks_authenticated_all'
  ) then
    create policy closing_tasks_authenticated_all on closing_tasks
      for all to authenticated using (true) with check (true);
  end if;
end $$;
