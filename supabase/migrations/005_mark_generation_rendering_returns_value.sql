-- Fixes the real cause behind the repeated "Cannot read properties of undefined
-- (reading 'data')" crash on the Mark Rendering node: mark_generation_rendering was
-- declared `returns void`, so PostgREST always answers with an empty 204 No Content
-- body, no matter the HTTP method or headers sent. Forcing n8n to parse an empty
-- body as JSON is what crashes — the PATCH method and the Prefer header from
-- earlier attempts were both red herrings. Every other RPC this pipeline calls
-- (reserve_credits, refund_credits, complete_variant) already returns a real value
-- for this reason; this brings mark_generation_rendering in line with that pattern.
--
-- Postgres won't let `create or replace function` change a return type, so the old
-- (void-returning) version has to be dropped first.

drop function mark_generation_rendering(uuid, text);

create function mark_generation_rendering(p_generation_id uuid, p_prompt text) returns boolean
language sql security definer set search_path = public as $$
  update generations set status = 'rendering', prompt = p_prompt where id = p_generation_id
  returning true;
$$;

revoke execute on function mark_generation_rendering(uuid, text) from public, anon, authenticated;
grant execute on function mark_generation_rendering(uuid, text) to service_role;
