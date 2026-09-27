// Prompt builder: single source of truth for the render prompt.
// n8n/build-prompt.js is generated from this logic (keep them in sync; see prompt.test.ts).

export type BudgetTier = "refresh" | "mid" | "premium";

export type PromptInput = {
  roomType: string;
  style: { name: string; details: string; negative?: string | null; strength?: number | null };
  budgetTier: BudgetTier;
  renterMode: boolean;
  userNote?: string | null;
  lockedObjects?: string[];
};

export type PromptOutput = { prompt: string; negative: string; strength: number };

export const TIER_RULES: Record<BudgetTier, { rule: string; strength: number }> = {
  refresh: {
    rule: "Budget-friendly refresh only, using affordable, cost-effective pieces that fit a tight budget: refresh cushions, curtains and rugs, improve the lighting with simple fixtures, and swap at most one budget furniture piece such as the sofa if it clearly needs it. Only add a plant or a few flowers if the space naturally suits it — do not force one in otherwise. If the wall already has photos or frames, refresh or restyle them to match; do not add new wall photos where there are none. No premium or luxury items. Keep the walls and the rest of the furniture as they are.",
    strength: 0.5,
  },
  mid: {
    rule: "Mid-range makeover within a moderate budget: replace the furniture and decor with good-quality, mid-range pieces, and repaint the walls in a complementary colour for the style. You may add a few wall photos or art frames if it suits the space. Keep the flooring as it is. Avoid ultra-premium or luxury materials that would exceed a moderate budget.",
    strength: 0.68,
  },
  premium: {
    rule: "Premium redesign reflecting a higher budget, with quality premium materials but not ultra-luxury overall: replace the furniture, flooring and wall finish, add a few large, high-quality photographs or modern art pieces, include stylish lighting fixtures, and add a couple of luxury-feel accent pieces (e.g. a statement mirror, a designer accent chair, premium textiles). If a window is visible, add elegant curtains or blinds that match the style. If the ceiling is clearly visible, add a premium ceiling light fixture such as a chandelier or cove lighting. If the floor is clearly visible, upgrade it to a premium flooring material such as hardwood or marble-look tile.",
    strength: 0.82,
  },
};

export const RENTER_RULE =
  "Renter-friendly override: even if the budget rule above suggests plants or new wall art, do not add any plants and do not add any new wall-mounted or hanging items that would require drilling (no new hung photos, frames, shelves or hooks) — existing wall-mounted items can be left as is or restyled in place, but nothing new gets drilled in. No structural changes, no wall paint change, no flooring change. Only change freestanding furniture, textiles such as cushions, rugs and curtains, and freestanding or plug-in lighting.";
export const RENTER_MAX_STRENGTH = 0.55;

// Includes mirroring/flipping terms because flux-kontext-pro occasionally
// mirrors the whole photo, which silently swaps which side a window/door is
// on even though it never technically "moved" one.
export const GLOBAL_NEGATIVE =
  "distorted walls, extra windows, moved doors, repositioned windows, repositioned doors, warped furniture, mirrored image, flipped horizontally, reversed layout, people, text, watermark, blurry";

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export function sanitizeNote(note?: string | null): string {
  if (!note) return "";
  // Keep it short and strip characters that could break JSON or the prompt structure.
  return clean(note.replace(/[{}<>`"\\]/g, "")).slice(0, 200);
}

export function buildPrompt(i: PromptInput): PromptOutput {
  const tier = TIER_RULES[i.budgetTier] ?? TIER_RULES.mid;
  let strength = i.style.strength ?? tier.strength;
  const parts = [
    `Redesign this ${i.roomType} in a ${i.style.name} interior style: ${i.style.details}.`,
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
    // Walls are deliberately left out here — whether they change is now a per-tier
    // decision (refresh keeps them, mid repaints them, premium redoes the finish).
    // Windows/doors get an explicit "exact position and side" callout plus a
    // no-mirroring instruction, because the model has been observed flipping
    // the whole photo horizontally, which swaps which wall a window is on.
    "Do not move, resize, add or remove any windows or doors, and do not mirror or flip the image — keep their exact original position, size and side of the room, and keep the camera framing exactly as shown.",
    "Keep the same ceiling and camera angle. Only change interior styling — never the room's architecture.",
    "Photorealistic interior photograph. Do not add people or text."
  );

  const negative = [i.style.negative, GLOBAL_NEGATIVE].filter(Boolean).join(", ");
  return { prompt: clean(parts.join(" ")), negative, strength };
}
