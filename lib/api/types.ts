import { z } from "zod";

export const BUDGET_TIERS = ["refresh", "mid", "premium"] as const;
export const ROOM_TYPES = [
  "living room", "bedroom", "kitchen", "dining room", "study", "balcony", "pooja room",
] as const;

export const CreateGenerationBody = z.object({
  roomId: z.uuid(),
  styleId: z.uuid(),
  budgetTier: z.enum(BUDGET_TIERS),
  renterMode: z.boolean().default(false),
  variants: z.number().int().min(1).max(4).default(2),
  note: z.string().max(200).optional(),
  roomType: z.enum(ROOM_TYPES).optional(),
  idempotencyKey: z.string().min(8).max(64),
});
export type CreateGenerationBody = z.infer<typeof CreateGenerationBody>;

export type GenStatus = "queued" | "analysing" | "rendering" | "post_processing" | "done" | "failed";

export type Style = {
  id: string;
  slug: string;
  name: string;
  region: "india" | "global";
  tagline: string | null;
  palette: string[];
  sample_image: string | null;
};

export type Explain = {
  palette: string[];
  materials: string[];
  key_items: { name: string; category?: string; inr_low: number; inr_high: number }[];
  why_it_works: string;
  structure_score?: number;
};

export type ApiErrorCode = "invalid_input" | "unauthorized" | "no_credits" | "rate_limited" | "not_found" | "upstream_failed";

export const apiError = (code: ApiErrorCode, message: string, status: number, retryable = false) =>
  Response.json({ error: { code, message, retryable } }, { status });
