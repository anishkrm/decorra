-- n8n's HTTP Request node has a bug in this account's n8n version: sending a real
-- PATCH request with a JSON body crashes internally ("Cannot read properties of
-- undefined (reading 'data')"). Every other write in this pipeline already goes
-- through an RPC function called with POST (reserve_credits, refund_credits,
-- complete_variant) rather than a raw table PATCH/POST, which is exactly why only
-- this one call site had a problem. This gives the "mark rendering" update the same
-- RPC shape, sidestepping the PATCH bug entirely instead of working around it.

create function mark_generation_rendering(p_generation_id uuid, p_prompt text) returns void
language sql security definer set search_path = public as $$
  update generations set status = 'rendering', prompt = p_prompt where id = p_generation_id;
$$;

revoke execute on function mark_generation_rendering(uuid, text) from public, anon, authenticated;
grant execute on function mark_generation_rendering(uuid, text) to service_role;
