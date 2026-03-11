-- ─────────────────────────────────────────────
-- Acquira — Supabase Schema v1.0
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────────

-- Enable PostGIS for geo queries
create extension if not exists postgis;

-- ── ORGANISATIONS ──
create table organisations (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  name        text not null,
  plan        text not null default 'starter', -- starter / pro / enterprise
  report_credits int not null default 1
);

-- ── USERS (extends Supabase auth.users) ──
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz default now(),
  org_id      uuid references organisations(id),
  full_name   text,
  role        text default 'analyst' -- analyst / admin
);

-- ── DEALS ──
create table deals (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  user_id           uuid not null references auth.users(id),
  org_id            uuid references organisations(id),
  centre_name       text,
  address           text,
  suburb            text,
  state             text,
  postcode          text,
  lat               double precision,
  lng               double precision,
  status            text not null default 'processing', -- processing / scored / error
  source_type       text,                               -- pdf_im / data_room_excel_pdf / zip_mixed
  pipeline_version  text,
  file_urls         text[] default '{}',
  error_message     text,
  extracted         jsonb,                              -- ExtractedDeal
  confirmed_overrides jsonb default '{}',              -- user-confirmed field overrides
  geo_data          jsonb                               -- competitor map data
);

-- ── DEAL SCORES (versioned — never overwrite) ──
create table deal_scores (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  deal_id         uuid not null references deals(id) on delete cascade,
  version         int not null default 1,
  is_current      boolean not null default true,
  scoring_version text,
  overall_score   numeric(4,2),
  score_capped    boolean default false,
  score_cap_reason text,
  hard_flags      text[] default '{}',
  dimensions      jsonb,                               -- full dimension breakdown
  conditionals    jsonb,
  analyst_summary text,
  overall_verdict text,
  weights_used    jsonb                                -- snapshot of weights at scoring time
);

-- Only one current score per deal
create unique index deal_scores_current_idx 
  on deal_scores(deal_id) where is_current = true;

-- ── ACECQA CENTRES (for geo competitor queries) ──
create table acecqa_centres (
  id              uuid primary key default gen_random_uuid(),
  service_id      text unique,
  name            text,
  address         text,
  suburb          text,
  state           text,
  postcode        text,
  operator        text,
  licensed_places int,
  nqs_rating      text,
  centre_type     text,
  status          text,
  location        geography(point, 4326)               -- PostGIS point
);

-- Spatial index for fast radius queries
create index acecqa_centres_location_idx 
  on acecqa_centres using gist(location);

-- ── FUNCTIONS ──

-- Auto-update updated_at on deals
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger deals_updated_at
  before update on deals
  for each row execute function update_updated_at();

-- Version deal scores on new insert
create or replace function version_deal_score()
returns trigger as $$
begin
  -- Mark previous scores as not current
  update deal_scores 
  set is_current = false 
  where deal_id = new.deal_id and is_current = true;
  
  -- Set version number
  select coalesce(max(version), 0) + 1 
  into new.version 
  from deal_scores 
  where deal_id = new.deal_id;
  
  return new;
end;
$$ language plpgsql;

create trigger deal_scores_version
  before insert on deal_scores
  for each row execute function version_deal_score();

-- Competitor radius query function
create or replace function get_competitors(
  centre_lat double precision,
  centre_lng double precision,
  radius_km  double precision default 2.5
)
returns table (
  id              uuid,
  name            text,
  address         text,
  suburb          text,
  licensed_places int,
  nqs_rating      text,
  centre_type     text,
  distance_km     double precision
) as $$
begin
  return query
  select 
    a.id, a.name, a.address, a.suburb,
    a.licensed_places, a.nqs_rating, a.centre_type,
    round((st_distance(
      a.location,
      st_point(centre_lng, centre_lat)::geography
    ) / 1000)::numeric, 2)::double precision as distance_km
  from acecqa_centres a
  where 
    a.status = 'Approved' and
    st_dwithin(
      a.location,
      st_point(centre_lng, centre_lat)::geography,
      radius_km * 1000
    )
  order by distance_km;
end;
$$ language plpgsql;

-- ── ROW LEVEL SECURITY ──
alter table deals enable row level security;
alter table deal_scores enable row level security;
alter table profiles enable row level security;

-- Users can only see their own deals (or org deals)
create policy "deals_own" on deals
  for all using (
    auth.uid() = user_id or 
    org_id in (
      select org_id from profiles where id = auth.uid()
    )
  );

create policy "scores_own" on deal_scores
  for all using (
    deal_id in (
      select id from deals where 
        user_id = auth.uid() or
        org_id in (select org_id from profiles where id = auth.uid())
    )
  );

create policy "profiles_own" on profiles
  for all using (auth.uid() = id);
