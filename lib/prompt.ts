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
    rule: "Only change decor, cushions, curtains, rugs and lighting; keep the existing furniture.",
    strength: 0.55,
  },
  mid: { rule: "Replace furniture and decor; keep the flooring and wall finish.", strength: 0.65 },
  premium: { rule: "Replace furniture, flooring and wall finish.", strength: 0.75 },
};

export const RENTER_RULE =
  "Renter-friendly: no structural changes, no wall paint change, no flooring change; only movable furniture, soft furnishings, decor and lighting.";
export const RENTER_MAX_STRENGTH = 0.55;

export const GLOBAL_NEGATIVE =
  "distorted walls, extra windows, moved doors, warped furniture, people, text, watermark, blurry";

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
    "Keep the same walls, windows, doors, ceiling and camera angle.",
    "Photorealistic interior photograph. Do not add people or text."
  );

  const negative = [i.style.negative, GLOBAL_NEGATIVE].filter(Boolean).join(", ");
  return { prompt: clean(parts.join(" ")), negative, strength };
}
