import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildPrompt, RENTER_MAX_STRENGTH, type PromptInput } from "./prompt";

const base: PromptInput = {
  roomType: "living room",
  style: { name: "Kerala Traditional", details: "teak wood furniture, red oxide floor", negative: "carpeted floor" },
  budgetTier: "mid",
  renterMode: false,
};

describe("buildPrompt", () => {
  it("builds the base prompt with tier rule and structure guard", () => {
    const out = buildPrompt(base);
    expect(out.prompt).toContain("Redesign this living room in a Kerala Traditional interior style");
    expect(out.prompt).toContain("keep the flooring and wall finish");
    expect(out.prompt).toContain("Keep the same walls, windows, doors, ceiling and camera angle");
    expect(out.strength).toBe(0.65);
    expect(out.negative).toMatch(/^carpeted floor, distorted walls/);
  });

  it("maps budget tiers to strength", () => {
    expect(buildPrompt({ ...base, budgetTier: "refresh" }).strength).toBe(0.55);
    expect(buildPrompt({ ...base, budgetTier: "premium" }).strength).toBe(0.75);
  });

  it("prefers a calibrated style strength", () => {
    expect(buildPrompt({ ...base, style: { ...base.style, strength: 0.7 } }).strength).toBe(0.7);
  });

  it("renter mode adds constraints and caps strength", () => {
    const out = buildPrompt({ ...base, budgetTier: "premium", renterMode: true });
    expect(out.prompt).toContain("no wall paint change");
    expect(out.strength).toBe(RENTER_MAX_STRENGTH);
  });

  it("appends locked objects and a sanitized note", () => {
    const out = buildPrompt({ ...base, lockedObjects: ["sofa"], userNote: '  add "plants" {x}\n please ' });
    expect(out.prompt).toContain("Keep the existing sofa exactly as it is.");
    expect(out.prompt).toContain("Homeowner request: add plants x please.");
    expect(out.prompt).not.toMatch(/[{}"]/);
  });

  it("n8n Code node produces identical output", () => {
    const src = readFileSync(new URL("../n8n/build-prompt.js", import.meta.url), "utf8");
    const fn = new Function("input", `${src}\nreturn buildPrompt(input);`);
    const cases: PromptInput[] = [
      base,
      { ...base, budgetTier: "premium", renterMode: true, userNote: "warmer lighting" },
      { ...base, budgetTier: "refresh", lockedObjects: ["sofa", "window"] },
    ];
    for (const c of cases) expect(fn(c)).toEqual(buildPrompt(c));
  });
});
