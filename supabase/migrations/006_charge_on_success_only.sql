-- Switches the credit model from "reserve up front, refund on failure" to "only
-- ever charge for a variant that actually succeeds." Also resets the free sign-up
-- allowance from 25 back to 5.
--
-- Why: the reserve/refund model needed every failure path (n8n crashes, dropped
-- webhooks, the app's own error handling) to remember to call refund_credits, and
-- we spent a lot of this session finding crashes that skipped it. Charging only on
-- a real success removes that whole failure category: nothing is ever taken until
-- there is an actual image to show for it, so there is nothing to refund.

alter table profiles alter column credits set default 5;
update profiles set credits = 5;

-- reserve_credits keeps its name/signature (app/api/generations/route.ts already
-- calls it) but now only CHECKS the balance and self-heals a missing profile row —
-- it no longer deducts anything.
create or replace function reserve_credits(n int) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  insert into profiles (id, credits) values (auth.uid(), 5)
  on conflict (id) do nothing;

  select credits >= n into ok from profiles where id = auth.uid();
  return coalesce(ok, false);
end $$;

-- Charges exactly one credit at the moment a variant succeeds, instead of crediting
-- nothing on success and refunding the untouched balance on total failure.
create or replace function complete_variant(p_generation_id uuid, p_ok boolean, p_error text default null)
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

  if p_ok then
    update profiles set credits = greatest(credits - 1, 0) where id = g.user_id;
  end if;

  if g.variants_done >= g.variants then
    update generations
       set status = case when g.variants_ok > 0 then 'done'::gen_status else 'failed'::gen_status end
     where id = g.id
    returning * into g;
  end if;
  return g.status;
end $$;

-- A stuck job now costs nothing by construction (nothing was ever deducted for a
-- variant that hasn't succeeded), so the sweeper only needs to mark it failed.
create or replace function sweep_stuck_generations(p_minutes int default 10) returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from generations
            where status not in ('done','failed')
              and updated_at < now() - make_interval(mins => p_minutes)
            for update skip locked
  loop
    update generations set status = 'failed', error = coalesce(error, 'timed out') where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
