-- Raise the free sign-up allowance from 5 to 25 credits.
-- 001_init.sql already ran against this project (it isn't safe to re-run — plain
-- `create table`/`create type` errors on a second pass), so the new-user default
-- lives here instead. Run this once in the Supabase SQL Editor.

alter table profiles alter column credits set default 25;

-- Top up any existing accounts that signed up under the old default, without
-- lowering anyone who already has more (e.g. a top-up or a demo account).
update profiles set credits = 25 where credits < 25;
