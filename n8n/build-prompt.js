// Paste into the n8n "Build prompt" Code node (JavaScript, Run Once for All Items).
// Mirrors lib/prompt.ts; lib/prompt.test.ts fails if the two drift apart.
// Everything below the "n8n glue" marker is n8n-specific and is ignored by the test.

const TIER_RULES = {
  refresh: { rule: "Only change decor, cushions, curtains, rugs and lighting; keep the existing furniture.", strength: 0.55 },
  mid: { rule: "Replace furniture and decor; keep the flooring and wall finish.", strength: 0.65 },
  premium: { rule: "Replace furniture, flooring and wall finish.", strength: 0.75 },
};
const RENTER_RULE =
  "Renter-friendly: no structural changes, no wall paint change, no flooring change; only movable furniture, soft furnishings, decor and lighting.";
const RENTER_MAX_STRENGTH = 0.55;
const GLOBAL_NEGATIVE =
  "distorted walls, extra windows, moved doors, warped furniture, people, text, watermark, blurry";

const clean = (s) => s.replace(/\s+/g, " ").trim();
const sanitizeNote = (note) => (note ? clean(note.replace(/[{}<>`"\\]/g, "")).slice(0, 200) : "");

function buildPrompt(i) {
  const tier = TIER_RULES[i.budgetTier] ?? TIER_RULES.mid;
  let strength = i.style.strength ?? tier.strength;
  const parts = [`Redesign this ${i.roomType} in a ${i.style.name} interior style: ${i.style.details}.`, tier.rule];
  if (i.renterMode) {
    parts.push(RENTER_RULE);
    strength = Math.min(strength, RENTER_MAX_STRENGTH);
  }
  for (const obj of i.lockedObjects ?? []) parts.push(`Keep the existing ${obj} exactly as it is.`);
  const note = sanitizeNote(i.userNote);
  if (note) parts.push(`Homeowner request: ${note}.`);
  parts.push(
    "Keep the same walls, windows, doors, ceiling and camera angle.",
    "Photorealistic interior photograph. Do not add people or text."
  );
  const negative = [i.style.negative, GLOBAL_NEGATIVE].filter(Boolean).join(", ");
  return { prompt: clean(parts.join(" ")), negative, strength };
}

// ---- n8n glue ----
if (typeof $ === "function") {
  const gen = $("Get generation").first().json;
  const room = $("Get room").first().json;
  const style = $("Get style").first().json;
  const signed = $("Sign photo URL").first().json.signedURL; // "/object/sign/originals/...?token=..."
  const SUPABASE_URL = $env.SUPABASE_URL ?? "https://YOUR-PROJECT.supabase.co";

  const out = buildPrompt({
    roomType: room.room_type ?? "living room",
    style: { name: style.name, details: style.details, negative: style.negative, strength: style.strength },
    budgetTier: gen.budget_tier,
    renterMode: gen.renter_mode,
    userNote: gen.user_note,
  });

  // One item per variant, each with its own seed, for the per-variant child workflow (WF-2b).
  return Array.from({ length: gen.variants ?? 1 }, (_, k) => ({
    json: {
      ...out,
      generation_id: gen.id,
      user_id: gen.user_id,
      variant: k + 1,
      seed: Math.floor(Math.random() * 2 ** 31),
      imageUrl: `${SUPABASE_URL}/storage/v1${signed}`,
    },
  }));
}
