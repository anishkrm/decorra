-- Marks the owner's account as exempt from the credit limit entirely, so it can
-- never be affected by a future credit reset (like 006's "set everyone to 5") or
-- simply run out from a very large number of generations.

alter table profiles add column if not exists unlimited boolean not null default false;

update profiles set unlimited = true
where id = (select id from auth.users where email = 'anishkrm@gmail.com');

-- Skip the balance check entirely for an unlimited account.
create or replace function reserve_credits(n int) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  insert into profiles (id, credits) values (auth.uid(), 5)
  on conflict (id) do nothing;

  select (unlimited or credits >= n) into ok from profiles where id = auth.uid();
  return coalesce(ok, false);
end $$;

-- Skip the deduction on success for an unlimited account, so its credit count
-- never even ticks down (stays accurate for display, not just "very large").
create or replace function complete_variant(p_generation_id uuid, p_ok boolean, p_error text default null)
returns gen_status
language plpgsql security definer set search_path = public as $$
declare g generations; s gen_status; is_unlimited boolean;
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
    select unlimited into is_unlimited from profiles where id = g.user_id;
    if not coalesce(is_unlimited, false) then
      update profiles set credits = greatest(credits - 1, 0) where id = g.user_id;
    end if;
  end if;

  if g.variants_done >= g.variants then
    update generations
       set status = case when g.variants_ok > 0 then 'done'::gen_status else 'failed'::gen_status end
     where id = g.id
    returning * into g;
  end if;
  return g.status;
end $$;
