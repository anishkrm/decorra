// Paste into the n8n "Build prompt" Code node (JavaScript, Run Once for All Items).
// Mirrors lib/prompt.ts; lib/prompt.test.ts fails if the two drift apart.
// Everything below the "n8n glue" marker is n8n-specific and is ignored by the test.

const TIER_RULES = {
  refresh: { rule: "Budget-friendly refresh only, using affordable, cost-effective pieces that fit a tight budget: refresh soft furnishings like cushions, curtains or rugs where relevant to this room, improve the lighting with simple fixtures, and swap at most one budget furniture piece appropriate to this room type if it clearly needs it. Only add a plant or a few flowers if the space naturally suits it — do not force one in otherwise. If the wall already has photos or frames, refresh or restyle them to match; do not add new wall photos where there are none. No premium or luxury items. Keep the walls and the rest of the furniture as they are.", strength: 0.5 },
  mid: { rule: "Mid-range makeover within a moderate budget: replace the furniture and decor with good-quality, mid-range pieces, and repaint the walls in a complementary colour for the style. You may add a few wall photos or art frames if it suits the space. Keep the flooring as it is. Avoid ultra-premium or luxury materials that would exceed a moderate budget.", strength: 0.68 },
  premium: { rule: "Premium redesign reflecting a higher budget, with quality premium materials but not ultra-luxury overall: replace the furniture, flooring and wall finish, add a few large, high-quality photographs or modern art pieces, include stylish lighting fixtures, and add a couple of luxury-feel accent pieces (e.g. a statement mirror, a designer accent chair, premium textiles). If a window is visible, add elegant curtains or blinds that match the style. If the ceiling is clearly visible, add a premium ceiling light fixture such as a chandelier or cove lighting. If the floor is clearly visible, upgrade it to a premium flooring material such as hardwood or marble-look tile.", strength: 0.82 },
};

// Scopes what "furniture"/"decor" means per room so the generic tier rules
// above don't cause nonsense like a sofa in a pooja room. Keyed to match
// lib/api/types.ts's ROOM_TYPES exactly (lowercased).
const ROOM_TYPE_RULES = {
  "living room": {
    focus: "In this room, furniture means seating and entertaining pieces: a sofa or sectional, a coffee table, a TV/entertainment unit, an area rug, curtains and wall art.",
  },
  bedroom: {
    focus: "In this room, furniture means bedroom essentials only: the bed with headboard, a wardrobe or closet, bedside tables, and bedroom-appropriate lighting.",
    negative: "sofa, sofa set, dining table, dining chairs, kitchen cabinets",
  },
  kitchen: {
    focus: "In this room, changes mean kitchen essentials only: cabinetry, countertop, backsplash and kitchen fixtures.",
    negative: "sofa, bed, dining table, living room furniture",
  },
  "dining room": {
    focus: "In this room, furniture means dining essentials only: a dining table with chairs, a sideboard or crockery unit, and pendant lighting above the table.",
    negative: "sofa, bed, kitchen cabinets",
  },
  study: {
    focus: "In this room, furniture means study essentials only: a desk, an ergonomic chair, a bookshelf or storage unit, and focused task lighting.",
    negative: "sofa, bed, dining table",
  },
  balcony: {
    focus: "In this room, furniture means outdoor-appropriate pieces only: weatherproof seating such as a small chair or a swing, planters or a small vertical garden, and outdoor-safe lighting.",
    negative: "indoor sofa, bed, dining table, indoor carpet",
  },
  "pooja room": {
    focus: "This is a pooja/prayer room, not a seating space — do not treat it like a living room. The only 'furniture' here is a mandir or temple unit (wooden, marble, or a glass-and-brass altar), floating shelves for pooja essentials, diyas and brass lamps, and soft warm lighting such as spotlights on the idols plus warm LED backlighting. Flooring, if changed, should be marble or a matte tile. At most a small stool or asana for sitting during prayer.",
    negative: "sofa, sofa set, bed, dining table, TV unit, television, coffee table, living room furniture",
  },
};
const DEFAULT_ROOM_FOCUS = "Only add furniture and decor that would realistically belong in this specific type of room.";

const RENTER_RULE =
  "Renter-friendly override: even if the budget rule above suggests plants or new wall art, do not add any plants and do not add any new wall-mounted or hanging items that would require drilling (no new hung photos, frames, shelves or hooks) — existing wall-mounted items can be left as is or restyled in place, but nothing new gets drilled in. No structural changes, no wall paint change, no flooring change. Only change freestanding furniture, textiles such as cushions, rugs and curtains, and freestanding or plug-in lighting.";
const RENTER_MAX_STRENGTH = 0.55;
const RENTER_NEGATIVE =
  "plant, plants, potted plant, houseplant, flower vase, floral arrangement, flowers, new wall art, new hanging photo frame, new wall shelf, wall hooks, nails in wall, drilled holes";
const GLOBAL_NEGATIVE =
  "distorted walls, extra windows, moved doors, repositioned windows, repositioned doors, warped furniture, mirrored image, flipped horizontally, reversed layout, people, text, watermark, blurry";

const clean = (s) => s.replace(/\s+/g, " ").trim();
const sanitizeNote = (note) => (note ? clean(note.replace(/[{}<>`"\\]/g, "")).slice(0, 200) : "");

function buildPrompt(i) {
  const tier = TIER_RULES[i.budgetTier] ?? TIER_RULES.mid;
  const roomRule = ROOM_TYPE_RULES[i.roomType.toLowerCase()];
  let strength = i.style.strength ?? tier.strength;
  const parts = [
    `Redesign this ${i.roomType} in a ${i.style.name} interior style: ${i.style.details}.`,
    roomRule?.focus ?? DEFAULT_ROOM_FOCUS,
    tier.rule,
  ];
  if (i.renterMode) {
    parts.push(RENTER_RULE);
    strength = Math.min(strength, RENTER_MAX_STRENGTH);
  }
  for (const obj of i.lockedObjects ?? []) parts.push(`Keep the existing ${obj} exactly as it is.`);
  const note = sanitizeNote(i.userNote);
  if (note) parts.push(`Homeowner request: ${note}.`);
  parts.push(
    "Do not move, resize, add or remove any windows or doors, and do not mirror or flip the image — keep their exact original position, size and side of the room, and keep the camera framing exactly as shown.",
    "Keep the same ceiling and camera angle. Only change interior styling — never the room's architecture.",
    "Photorealistic interior photograph. Do not add people or text."
  );
  const negative = [i.style.negative, GLOBAL_NEGATIVE, roomRule?.negative, i.renterMode ? RENTER_NEGATIVE : null]
    .filter(Boolean)
    .join(", ");
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
