-- AuthStatus subscribes to postgres_changes on `profiles` to show the credit
-- balance updating live after a successful generation, but 001_init.sql only ever
-- added `generations` and `concepts` to the realtime publication — `profiles` was
-- missing, so that subscription has never actually received anything. This is why
-- the credit count only ever appeared to update on a full page reload.

alter publication supabase_realtime add table profiles;
