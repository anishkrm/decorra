-- Decorra: initial schema. Run in Supabase SQL Editor (or `supabase db push`).

create extension if not exists pgcrypto;

create type gen_status as enum ('queued','analysing','rendering','post_processing','done','failed');
create type budget_tier as enum ('refresh','mid','premium');

-- ---------- tables ----------

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  credits int not null default 5 check (credits >= 0),
  locale text default 'en-IN',
  created_at timestamptz default now()
);

create table styles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  region text not null default 'global',      -- 'india' | 'global'
  tagline text,
  details text not null,                      -- fills {style_details} in the prompt
  negative text default '',
  palette text[] default '{}',
  room_types text[] default '{}',             -- empty = suits all
  strength numeric,                           -- calibrated per style (Phase 6); null = tier default
  sample_image text,
  sort int default 100,
  active boolean default true
);

create table model_configs (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('render','inpaint','segment','vision')),
  provider text not null,                     -- 'replicate' | 'anthropic' | 'google'
  model_ref text not null,
  params jsonb default '{}',
  active boolean default true
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text,
  original_path text not null,                -- originals/{user_id}/{room_id}.jpg
  room_type text default 'living room',
  analysis jsonb,
  is_demo boolean default false,
  created_at timestamptz default now()
);

create table generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  room_id uuid not null references rooms on delete cascade,
  style_id uuid not null references styles,
  budget_tier budget_tier not null default 'mid',
  renter_mode boolean not null default false,
  user_note text,
  parent_concept_id uuid,                     -- FK added below (refine flow)
  variants int not null default 1 check (variants between 1 and 4),
  variants_done int not null default 0,
  variants_ok int not null default 0,
  status gen_status not null default 'queued',
  error text,
  prompt text,
  idempotency_key text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, idempotency_key)
);

create table concepts (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references generations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  variant int not null default 1,
  image_path text not null,                   -- concepts/{user_id}/{generation_id}-{variant}.jpg
  thumb_path text,
  saved boolean default false,
  quality_score numeric,
  explain jsonb,
  created_at timestamptz default now()
);

alter table generations
  add constraint generations_parent_concept_fk
  foreign key (parent_concept_id) references concepts on delete set null;

create table generation_events (
  id bigint generated always as identity primary key,
  generation_id uuid references generations on delete cascade,
  step text not null,
  status text not null,
  ms int,
  provider_id text,
  cost_estimate numeric,
  created_at timestamptz default now()
);

create index on rooms (user_id);
create index on generations (user_id, created_at desc);
create index on generations (room_id);
create index on concepts (generation_id);
create index on concepts (user_id) where saved;

-- ---------- timestamps ----------

create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger generations_touch before update on generations
  for each row execute function touch_updated_at();

-- ---------- profile on sign-up ----------

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- credits (1 credit = 1 variant) ----------

-- Atomically deducts n credits from the caller. Returns false if not enough.
create function reserve_credits(n int) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  update profiles set credits = credits - n
   where id = auth.uid() and credits >= n
  returning true into ok;
  return coalesce(ok, false);
end $$;

-- Adds credits to a user (refund when a job row could not be created, top-ups). Service role only.
create function add_credits(p_user_id uuid, n int) returns void
language sql security definer set search_path = public as $$
  update profiles set credits = credits + n where id = p_user_id;
$$;

-- Refunds the credits of variants that did not succeed. Service role only.
create function refund_credits(p_generation_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g generations;
begin
  select * into g from generations where id = p_generation_id for update;
  if g is null then return; end if;
  update profiles set credits = credits + greatest(g.variants - g.variants_ok, 0) where id = g.user_id;
end $$;

-- Called by n8n once per variant. Closes the job when the last variant reports.
create function complete_variant(p_generation_id uuid, p_ok boolean, p_error text default null)
returns gen_status
language plpgsql security definer set search_path = public as $$
declare g generations; s gen_status;
begin
  update generations
     set variants_done = variants_done + 1,
         variants_ok   = variants_ok + (case when p_ok then 1 else 0 end),
         error         = coalesce(p_error, error)
   where id = p_generation_id and status not in ('done','failed')
  returning * into g;

  if g.id is null then  -- already closed (duplicate callback) or unknown id
    select status into s from generations where id = p_generation_id;
    return s;
  end if;

  if g.variants_done >= g.variants then
    update generations
       set status = case when g.variants_ok > 0 then 'done'::gen_status else 'failed'::gen_status end
     where id = g.id
    returning * into g;
    perform refund_credits(g.id);
  end if;
  return g.status;
end $$;

-- Marks jobs stuck in a non-terminal state as failed and refunds them (WF-6 sweeper).
create function sweep_stuck_generations(p_minutes int default 10) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from generations
            where status not in ('done','failed')
              and updated_at < now() - make_interval(mins => p_minutes)
            for update skip locked
  loop
    update generations set status = 'failed', error = coalesce(error, 'timed out') where id = r.id;
    perform refund_credits(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function add_credits(uuid, int) from public, anon, authenticated;
revoke execute on function refund_credits(uuid) from public, anon, authenticated;
revoke execute on function complete_variant(uuid, boolean, text) from public, anon, authenticated;
revoke execute on function sweep_stuck_generations(int) from public, anon, authenticated;
grant execute on function add_credits(uuid, int), refund_credits(uuid),
  complete_variant(uuid, boolean, text), sweep_stuck_generations(int) to service_role;
revoke execute on function reserve_credits(int) from public, anon;
grant execute on function reserve_credits(int) to authenticated;

-- ---------- row-level security ----------

alter table profiles enable row level security;
alter table styles enable row level security;
alter table model_configs enable row level security;   -- no policies: service role only
alter table rooms enable row level security;
alter table generations enable row level security;
alter table concepts enable row level security;
alter table generation_events enable row level security; -- service role only

create policy "own profile read" on profiles for select using (auth.uid() = id);

create policy "styles readable" on styles for select using (active);

create policy "own rooms" on rooms for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Users can read and create their generations; only the service role changes status.
create policy "own generations read" on generations for select using (auth.uid() = user_id);
create policy "own generations insert" on generations for insert
  with check (auth.uid() = user_id and status = 'queued' and variants_done = 0 and variants_ok = 0);

-- Users can read and (un)save their concepts; only the service role inserts them.
create policy "own concepts read" on concepts for select using (auth.uid() = user_id);
create policy "own concepts update" on concepts for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own concepts delete" on concepts for delete using (auth.uid() = user_id);

-- Column-level: users may only flip `saved` on concepts.
revoke update on concepts from authenticated;
grant update (saved) on concepts to authenticated;

-- ---------- storage ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('originals', 'originals', false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('concepts',  'concepts',  false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('exports',   'exports',   false, 10485760, array['image/jpeg','image/png'])
on conflict (id) do nothing;

create policy "upload own originals" on storage.objects for insert to authenticated
  with check (bucket_id = 'originals' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "read own files" on storage.objects for select to authenticated
  using (bucket_id in ('originals','concepts','exports') and (storage.foldername(name))[1] = auth.uid()::text);

create policy "delete own files" on storage.objects for delete to authenticated
  using (bucket_id in ('originals','concepts','exports') and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- realtime ----------

alter publication supabase_realtime add table generations, concepts;
