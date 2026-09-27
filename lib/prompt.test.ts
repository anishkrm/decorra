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
    expect(out.prompt).toContain("repaint the walls in a complementary colour");
    expect(out.prompt).toContain("Keep the flooring as it is");
    expect(out.prompt).toContain("keep their exact original position, size and side of the room");
    expect(out.prompt).toContain("do not mirror or flip the image");
    expect(out.prompt).not.toContain("Keep the same walls");
    expect(out.strength).toBe(0.68);
    expect(out.negative).toMatch(/^carpeted floor, distorted walls/);
    expect(out.negative).toContain("mirrored image");
  });

  it("maps budget tiers to strength", () => {
    expect(buildPrompt({ ...base, budgetTier: "refresh" }).strength).toBe(0.5);
    expect(buildPrompt({ ...base, budgetTier: "premium" }).strength).toBe(0.82);
  });

  it("prefers a calibrated style strength", () => {
    expect(buildPrompt({ ...base, style: { ...base.style, strength: 0.7 } }).strength).toBe(0.7);
  });

  it("renter mode overrides the tier's plants/new-wall-art suggestions and caps strength", () => {
    // Refresh's own rule conditionally allows a plant; premium's rule can add
    // new wall art. Renter mode must veto both regardless of tier, since
    // plants and drilling for new wall-mounted items aren't renter-friendly.
    const refreshOut = buildPrompt({ ...base, budgetTier: "refresh", renterMode: true });
    expect(refreshOut.prompt).toContain("do not add any plants");
    expect(refreshOut.prompt).toContain("do not add any new wall-mounted or hanging items");
    expect(refreshOut.prompt).toContain("no wall paint change");
    // Refresh's own strength (0.5) is already below the renter cap (0.55), so
    // renter mode leaves it as-is rather than raising it — the cap only ever
    // lowers strength, never increases it.
    expect(refreshOut.strength).toBe(0.5);

    const premiumOut = buildPrompt({ ...base, budgetTier: "premium", renterMode: true });
    expect(premiumOut.prompt).toContain("do not add any new wall-mounted or hanging items");
    expect(premiumOut.strength).toBe(RENTER_MAX_STRENGTH);
  });

  it("renter mode also blocks plants/drilling via the negative prompt, not just instruction text", () => {
    // A "do not add X" instruction alone is unreliable on diffusion-style image
    // editors — this was seen in practice (a plant still got added under renter
    // mode). The negative prompt is what actually suppresses it.
    const out = buildPrompt({ ...base, renterMode: true });
    expect(out.negative).toContain("plant");
    expect(out.negative).toContain("flower");
    expect(out.negative).toContain("drilled holes");
    expect(buildPrompt({ ...base, renterMode: false }).negative).not.toContain("plant");
  });

  it("refresh tier makes flowers and wall photos conditional, not forced", () => {
    const out = buildPrompt({ ...base, budgetTier: "refresh" });
    expect(out.prompt).toContain("Only add a plant or a few flowers if the space naturally suits it");
    expect(out.prompt).toContain("do not add new wall photos where there are none");
  });

  it("scopes furniture to the room type, so a pooja room never gets a sofa", () => {
    // Reported bug: selecting "pooja room" + a style still resulted in sofas
    // and other living-room furniture being added.
    const out = buildPrompt({ ...base, roomType: "pooja room" });
    expect(out.prompt).toContain("mandir or temple unit");
    expect(out.prompt).toContain("not a seating space");
    expect(out.negative).toContain("sofa");
    expect(out.negative).toContain("TV unit");
  });

  it("scopes furniture per room type generally, not just pooja room", () => {
    expect(buildPrompt({ ...base, roomType: "kitchen" }).prompt).toContain("kitchen essentials only");
    expect(buildPrompt({ ...base, roomType: "kitchen" }).negative).toContain("sofa");

    expect(buildPrompt({ ...base, roomType: "study" }).prompt).toContain("study essentials only");
    expect(buildPrompt({ ...base, roomType: "study" }).negative).toContain("dining table");

    // An unrecognized/custom room type still gets a sane generic instruction
    // instead of silently falling through with no room scoping at all.
    expect(buildPrompt({ ...base, roomType: "home office" }).prompt).toContain(
      "realistically belong in this specific type of room"
    );
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
      { ...base, roomType: "pooja room", budgetTier: "premium" },
    ];
    for (const c of cases) expect(fn(c)).toEqual(buildPrompt(c));
  });
});
