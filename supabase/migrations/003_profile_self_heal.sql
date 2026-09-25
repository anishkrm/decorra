-- Fixes accounts left without a `profiles` row: anyone who signed up (an auth.users
-- row was created) before 001_init.sql's on_auth_user_created trigger existed on this
-- project never got a profile, so their credit balance reads as nothing and
-- reserve_credits matches zero rows and reports "not enough credits" — even though
-- the real problem is that there's no row to check at all.

-- One-off backfill for any such accounts already stuck like this.
insert into profiles (id, name, credits)
select u.id, u.email, 25
from auth.users u
left join profiles p on p.id = u.id
where p.id is null;

-- Going forward, self-heal at the point of use: if reserve_credits ever runs for a
-- user with no profile row (trigger failure, manual DB edits, anything), create one
-- with the standard free allowance before attempting the deduction, instead of
-- failing the request.
create or replace function reserve_credits(n int) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  insert into profiles (id, credits) values (auth.uid(), 25)
  on conflict (id) do nothing;

  update profiles set credits = credits - n
   where id = auth.uid() and credits >= n
  returning true into ok;
  return coalesce(ok, false);
end $$;
