import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { apiError, CreateGenerationBody } from "@/lib/api/types";

const HOURLY_LIMIT = 10;

export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return apiError("unauthorized", "Please sign in", 401);

  const parsed = CreateGenerationBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("invalid_input", "Invalid input", 400);
  const b = parsed.data;

  // Duplicate taps return the same job.
  const { data: existing } = await sb.from("generations").select("id")
    .eq("user_id", user.id).eq("idempotency_key", b.idempotencyKey).maybeSingle();
  if (existing) return Response.json({ generationId: existing.id }, { status: 202 });

  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await sb.from("generations").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).gte("created_at", since);
  if ((count ?? 0) >= HOURLY_LIMIT) return apiError("rate_limited", "Hourly limit reached. Try again soon.", 429, true);

  // RLS ensures the room belongs to the user.
  const { data: room } = await sb.from("rooms").select("id").eq("id", b.roomId).maybeSingle();
  if (!room) return apiError("not_found", "Room not found", 404);
  if (b.roomType) await sb.from("rooms").update({ room_type: b.roomType }).eq("id", b.roomId);

  const { data: reserved } = await sb.rpc("reserve_credits", { n: b.variants });
  if (!reserved) return apiError("no_credits", "You're out of credits.", 402);

  const { data: gen, error } = await sb.from("generations").insert({
    user_id: user.id,
    room_id: b.roomId,
    style_id: b.styleId,
    budget_tier: b.budgetTier,
    renter_mode: b.renterMode,
    user_note: b.note || null,
    variants: b.variants,
    idempotency_key: b.idempotencyKey,
  }).select("id").single();

  const admin = supabaseAdmin();
  if (error || !gen) {
    await admin.rpc("add_credits", { p_user_id: user.id, n: b.variants });
    return apiError("upstream_failed", error?.message ?? "Could not create job", 500, true);
  }

  const hook = await fetch(process.env.N8N_WEBHOOK_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Decorra-Secret": process.env.N8N_WEBHOOK_SECRET! },
    body: JSON.stringify({ generation_id: gen.id }),
  }).catch(() => null);

  if (!hook?.ok) {
    await admin.from("generations").update({ status: "failed", error: "Could not start the design job" }).eq("id", gen.id);
    await admin.rpc("refund_credits", { p_generation_id: gen.id });
    return apiError("upstream_failed", "Could not start the design job", 502, true);
  }

  return Response.json({ generationId: gen.id }, { status: 202 });
}
