# Decorra — Development Summary

How the AI pipeline is actually built: the n8n workflows node by node, the prompt
engineering, the gotchas we hit, and the condensed prompts that produced the app.
See [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) for what the product does and how
a user experiences it.

## The n8n workflows

Three workflows, all in the same n8n Cloud account. All three talk to Supabase
using the same header-auth credential (service-role key); "Decorra - Render
Variant" also uses a bearer-token credential for Replicate.

### 1. Decorra - Generate (parent)

**What it does:** the entry point for a "Generate" click. Loads everything a
render needs, writes the final prompt for each requested variant, flips the job
to "rendering," then hands each variant off to its own child execution.

**Input:** a webhook `POST` from the Next.js API route, body `{ generation_id }`,
header `X-Decorra-Secret: <shared secret>`. Nothing else — no photo, no style
data — the workflow looks all of that up itself from the id.

**Output:** no meaningful HTTP response (the webhook replies immediately with
"Workflow got started"); its real output is side effects — a `generations` row
moved to `rendering`, and one "Decorra - Render Variant" execution started per
variant.

**Nodes, in order:**

| # | Node | What it does |
|---|---|---|
| 1 | **Start Job** (webhook) | Receives the POST, checks the `X-Decorra-Secret` header, hands `generation_id` downstream. |
| 2 | **Get Generation** (HTTP GET) | Reads the full `generations` row by id — style, room, budget tier, renter flag, user note, variant count, user id. |
| 3 | **Get Room** (HTTP GET) | Reads the `rooms` row referenced by that generation — room type, path to the uploaded photo. |
| 4 | **Get Style** (HTTP GET) | Reads the `styles` row — style name, prompt `details`, `negative` terms, render `strength`. |
| 5 | **Sign Photo URL** (HTTP POST) | Asks Supabase Storage for a 1-hour signed URL to the private original photo, so Replicate (an external service) can fetch it. |
| 6 | **Build Prompt** (Code) | Combines room + style + budget tier + renter mode + user note into the final prompt/negative/strength using the same rules as `lib/prompt.ts`, and outputs one item per variant (each with its own random seed). |
| 7 | **Mark Rendering** (HTTP POST → RPC `mark_generation_rendering`) | Flips the `generations` row's status to `rendering` and stores the built prompt on it. Uses a Postgres function instead of a raw PATCH (see gotchas below). |
| 8 | **Render Each Variant** (Execute Workflow, mode "each") | Starts "Decorra - Render Variant" once per item from Build Prompt, explicitly passing all 8 fields (generation_id, user_id, variant, seed, prompt, negative, strength, imageUrl). Does not wait for the child to finish. |

### 2. Decorra - Render Variant (child)

**What it does:** renders and stores exactly **one** image. Runs once per
variant, each in its own n8n execution, because each execution needs its own
unique callback URL to resume on.

**Input:** the 8 fields passed in by the parent's "Render Each Variant" node —
`generation_id`, `user_id`, `variant`, `seed`, `prompt`, `negative`, `strength`,
`imageUrl` (the signed photo URL).

**Output:** on success, a new `concepts` row (with `image_path`) and the
generation's `variants_done`/`variants_ok` counters bumped via `complete_variant`
— which is also where a credit actually gets spent. On failure or a 3-minute
timeout, just the counters get bumped with `p_ok: false`, no row, no charge.

**Nodes, in order:**

| # | Node | What it does |
|---|---|---|
| 1 | **Render Variant Trigger** (Execute Workflow Trigger, passthrough) | Receives the 8 fields from the parent unchanged. |
| 2 | **Start Render** (HTTP POST to Replicate) | Kicks off a `flux-kontext-pro` prediction with the prompt/image/seed, and tells Replicate to call back at `$execution.resumeUrl` when it's done. |
| 3 | **Wait For Replicate** (Wait, resume on webhook) | Pauses this execution — for up to 3 minutes — until Replicate's callback hits that resume URL, or gives up and continues on timeout. |
| 4 | **Succeeded?** (IF) | Branches on whether Replicate's callback body says `status: "succeeded"`. |
| 5a | **Download Rendered Image** (HTTP GET, success branch) | Fetches the rendered image bytes from the URL Replicate returned (as binary). |
| 6a | **Upload To Storage** (HTTP POST) | Uploads that binary to the private `concepts` bucket at `{user_id}/{generation_id}-{variant}.jpg`. |
| 7a | **Insert Concept Row** (HTTP POST) | Inserts the `concepts` row (generation_id, user_id, variant, image_path) with `Prefer: return=representation` so the insert actually returns data. |
| 8a | **Mark Variant Done** (HTTP POST → RPC `complete_variant`, `p_ok: true`) | Bumps the generation's done/ok counters, deducts one credit (unless the account is unlimited), and — once every variant has reported — flips the generation to `done` or `failed`. |
| 5b | **Mark Variant Failed** (HTTP POST → RPC `complete_variant`, `p_ok: false`, failure/timeout branch) | Bumps the counters with no success and no charge, recording the error if Replicate sent one. |

### 3. Decorra - Sweep Stuck Jobs

**What it does:** a periodic safety net, independent of any single generation.

**Input:** none — runs on a timer, not triggered by the app.

**Output:** none returned anywhere; its effect is flipping any `generations` row
that's been stuck in a non-terminal status too long over to `failed`, so it stops
showing as "in progress" forever and stops counting toward the hourly rate limit.

**Nodes, in order:**

| # | Node | What it does |
|---|---|---|
| 1 | **Every 5 Minutes** (Schedule Trigger) | Fires the workflow every 5 minutes, no input. |
| 2 | **Sweep Stuck Jobs** (HTTP POST → RPC `sweep_stuck_generations`, `p_minutes: 10`) | Marks any `generations` row still `queued`/`analysing`/`rendering` after 10+ minutes as `failed`. No refund step runs here — credits are only ever spent on success (see PROJECT_SUMMARY.md's Credits section), so a swept job was never charged in the first place. |

## The prompt

One template, filled in per request, built in a shared Code node so the logic
lives in exactly one place:

```
Redesign this {room_type} in a {style} interior style: {style_details}.
{room_focus}
{budget_rule}
Do not move, resize, add or remove any windows or doors, and do not mirror or
flip the image — keep their exact original position, size and side of the
room, and keep the camera framing exactly as shown.
Keep the same ceiling and camera angle. Only change interior styling — never
the room's architecture.
Photorealistic interior photograph. Do not add people or text.
```

**`{room_focus}` scopes what "furniture" even means, before the budget tier's
rule uses that word.** Bug: picking room type = pooja room still produced
sofas and other living-room furniture, because the tier rules only ever said
generic "furniture" (Refresh's rule even hardcoded "such as the sofa" as its
example — wrong for a kitchen, study or pooja room). `ROOM_TYPE_RULES` now
gives each of the 7 room types (matching `ROOM_TYPES` in `lib/api/types.ts`)
its own positive instruction plus, where it matters, a negative-prompt
exclusion list:

| Room type | Furniture/decor scoped to | Excluded (negative prompt) |
|---|---|---|
| Living room | Sofa/sectional, coffee table, TV unit, rug, curtains, wall art | — |
| Bedroom | Bed + headboard, wardrobe, bedside tables, bedroom lighting | sofa, dining table/chairs, kitchen cabinets |
| Kitchen | Cabinetry, countertop, backsplash, fixtures | sofa, bed, dining table, living room furniture |
| Dining room | Dining table + chairs, sideboard, pendant lighting | sofa, bed, kitchen cabinets |
| Study | Desk, ergonomic chair, bookshelf, task lighting | sofa, bed, dining table |
| Balcony | Weatherproof seating/swing, planters, outdoor lighting | indoor sofa, bed, dining table, indoor carpet |
| Pooja room | Mandir/temple unit, floating shelves, diyas/brass lamps, warm spotlighting, marble/matte-tile flooring, at most a small stool | sofa, bed, dining table, TV unit, coffee table, living room furniture |

Pooja room needed the most rework, since it's not a seating room at all —
grounded in how pooja rooms are actually specified in Indian interior design
practice: Vastu placement aside, the consistent elements across real guides
are the mandir/altar unit (wood, marble, or glass-and-brass), floating shelves
for pooja essentials, warm/soft lighting rather than harsh white LEDs, and
marble or matte-tile flooring. ([DesignCafe](https://www.designcafe.com/interior-design/pooja-room-design/),
[Studio Matrx's architect guide](https://www.studiomatrx.org/guides/pooja-room-design-india),
[Livspace](https://www.livspace.com/in/design-ideas/pooja-room)) The other room
types' vocabulary is likewise grounded rather than guessed — e.g. Indian
living rooms centering on sofa + rug + wall art + brass/wood accents, balconies
favoring a swing/planters over indoor furniture. ([HomeLane](https://www.homelane.com/design-ideas/living-room-design/indian-living-room-designs/),
[Beautiful Homes](https://www.beautifulhomes.asianpaints.com/interior-design-ideas/indian-style-living-room-design.html))

An unrecognized/custom room type falls back to a generic "only add what
realistically belongs in this room" instruction rather than silently getting
no room scoping at all.

Note the structure guard no longer locks the walls — whether they change is now
a per-tier decision, so each tier's rule below says explicitly what happens to
them. The guard also explicitly forbids mirroring/flipping: `flux-kontext-pro`
was occasionally mirroring the whole photo, which reads as "the window moved to
the other wall" even though nothing was technically added or removed — the
negative prompt now also carries `mirrored image, flipped horizontally,
reversed layout` for the same reason.

Each tier's rule is scoped to what's actually plausible at that budget — the
brief was "think like a senior interior architect": don't render luxury marble
in a Refresh room, and don't leave a Premium room looking like a Mid one.

| Budget tier | Rule | Render strength |
|---|---|---|
| Refresh (< ₹25k) | Budget-friendly only: refresh cushions/curtains/rugs, simple lighting, swap at most one **affordable** furniture piece (e.g. the sofa) — no premium items; walls untouched | 0.5 |
| Mid (₹25k–1L) | Replace furniture/decor with **mid-range, good-quality** pieces, **repaint the walls**, may add a few wall photos/art frames; flooring untouched; no ultra-premium materials | 0.68 |
| Premium (₹1L+) | Full redesign with **quality premium (not ultra-luxury overall) materials**: furniture, flooring, wall finish, a few large high-quality photos/modern art, stylish lighting, and a couple of realistic luxury-feel accents (statement mirror, designer chair, premium textiles) — **plus conditionally**: curtains/blinds if a window is visible, a chandelier/cove lighting if the ceiling is visible, upgraded flooring if the floor is visible | 0.82 |

The jump between tiers is deliberately drastic — Refresh should read as a light
touch-up, Premium as a different room — not three points on the same slider.
Premium's conditional additions (curtains, ceiling fixture, flooring) are
phrased as "if X is visible in the photo" rather than assumed, since the model
can see the actual photo and a room without a visible ceiling or window
shouldn't get an instruction it can't sensibly follow.

**Existing wall photos get the same "if visible" treatment as a separate rule**,
scoped by tier rather than left as an always-on instruction:
- Refresh only ever **refreshes/restyles photos already on the wall** — it never
  adds new ones where there are none (a flat "add a few plants or flowers" line
  was also removed from Refresh for the same reason: it was forcing a plant
  into every render even when nothing in the photo called for one; it's now
  conditional on the space actually suiting it).
- Mid **may add** a few new wall photos/art frames if it suits the space.
- Premium explicitly calls for **large, high-quality photos or modern art**.

**Renter mode explicitly vetoes plants and drilling, overriding the tier.**
Refresh's rule conditionally allows a plant, and Mid/Premium can add new wall
photos — but none of that is renter-friendly, since a plant is something a
renter usually wouldn't want assumed for them and any new wall-mounted item
needs drilling. Renter mode's instruction is phrased as an explicit override
("even if the budget rule above suggests plants or new wall art, do not...")
rather than a plain restriction list, specifically so it wins over the tier
rule's own suggestions instead of just sitting alongside them. Existing
wall-mounted items can still be left as-is or restyled in place — nothing
*new* gets drilled in. This matches the toggle's own copy in the UI: "Only
decor, textiles and lighting. No paint, no drilling."

**The instruction alone wasn't enough — a plant still got added in testing.**
A "do not add X" line in the positive prompt is unreliable on diffusion-style
image editors; the negative prompt is what actually suppresses an element.
`RENTER_NEGATIVE` (`plant, plants, potted plant, flowers, new wall art, new
hanging photo frame, new wall shelf, wall hooks, drilled holes`, …) is now
appended to the negative prompt whenever renter mode is on, so the veto is
enforced twice — once as an instruction, once as an actual negative.

**Renter mode** also caps strength at 0.55, regardless of tier (it only ever
lowers strength — Refresh's own 0.5 stays at 0.5). A global negative prompt
(`distorted walls, extra windows, moved doors, repositioned windows,
repositioned doors, warped furniture, mirrored image, flipped horizontally,
reversed layout, people, text, watermark, blurry`) is always appended, plus the
style's own negative terms.

## Known gotchas (so nobody rediscovers these the hard way)

- **PostgREST + n8n's PATCH bug:** sending a real `PATCH` request with a JSON body
  from n8n's HTTP node crashes internally on this n8n version. Every write in the
  pipeline goes through a Postgres **function called with POST** instead of a raw
  table PATCH — that's why `mark_generation_rendering` exists as an RPC rather than
  a direct table update.
- **`Prefer: return=minimal` (and its absence) both cause "empty response body"
  crashes** if the node's response format is forced to JSON. Any RPC/insert node
  that doesn't need its response data reads it as `text`, not `json`.
- **`generations` and `concepts` have two foreign keys** between them (the normal
  one, plus `parent_concept_id` for a future "refine" feature). Any Supabase query
  embedding one from the other must name the relationship explicitly
  (`concepts!concepts_generation_id_fkey(...)`) or it fails silently.
- **Realtime only fires for tables explicitly added to the `supabase_realtime`
  publication** — `profiles` was missed originally, which is why the credit count
  used to only update after a full page reload.

## Development prompts used

This app was built with Claude (Claude Code) from a Product Definition doc and a
Technical Architecture doc, then iterated on in a few big prompts. Below are
condensed versions of the prompts that actually *built* things — the initial
scaffold, the visual redesign, the theme system, and the n8n backend. Routine bug
fixes, credential troubleshooting, and small style tweaks are left out; that's
normal follow-up work with any AI pair-programmer, not something you need to
reproduce.

**1. Initial build (produced the whole app skeleton — schema, pages, API route):**

> Build "Decorra," an AI interior-makeover web app for Indian homes. A user
> uploads one photo of a room, picks a design style and an INR budget tier
> (Refresh / Mid / Premium), optionally turns on "renter mode" (no structural,
> paint, or flooring changes), and gets back a photoreal AI-redesigned version of
> their room in under a minute — with a before/after compare slider, a saved
> gallery, and a starter credit system (5 free generations per account).
>
> Include 12 styles: 5 India-specific (Modern Indian, Kerala Traditional,
> Chettinad, Rajasthani, Indo-Contemporary) and 7 global (Japandi, Scandinavian,
> Modern Luxe, Industrial, Bohemian, Coastal, Mid-Century).
>
> Stack: Next.js (App Router, TypeScript, Tailwind) for the frontend and API
> routes; Supabase for auth (magic link + Google), Postgres with row-level
> security, private image storage with signed URLs, and realtime row updates; n8n
> for orchestrating the actual image generation, since a render takes 30–90
> seconds and shouldn't block an HTTP request. n8n calls Replicate's
> `flux-kontext-pro` model, waits for its webhook callback, copies the result
> into Supabase Storage (Replicate deletes outputs after an hour), and writes the
> result back to Postgres. The browser must never call n8n or Replicate directly
> — only the Next.js server does.
>
> Design the full schema (profiles/credits, rooms, styles, generations,
> concepts), the upload → generate → compare → save flow, the credit
> reserve-and-check logic, and the n8n workflow(s) needed to run the pipeline
> end to end.

**2. Visual redesign (produced the current dark-glassmorphism look):**

> I don't like the current UX design — I want a more modern look and feel.
> Give me a few directions to choose from, then apply the one I pick
> consistently across every screen (landing, login, upload, results, gallery):
> frosted-glass cards, an ambient animated gradient background, gradient
> accents on buttons and headings, and a serif display font for headlines.

**3. Light/dark theme:**

> Add a light and dark theme, switchable by the user, consistent across every
> page, persisted across visits, with no flash of the wrong theme on first load.

**4. n8n backend workflows (built the actual orchestration, not just the code that calls it):**

> I've connected my n8n account — build the workflow(s) for me. I need: a
> "Generate" workflow that receives a job from the app, loads the room/style/
> photo data from Supabase, builds the image-generation prompt from the budget
> tier + renter mode + any user note, and kicks off rendering; a per-variant
> render workflow that calls the Replicate model, waits for its callback, saves
> the resulting image to Supabase Storage, and marks the job done or failed; and
> a scheduled workflow that sweeps and fails any job that's been stuck too long.

Together, these four prompts plus the two source docs (Product Definition,
Technical Architecture Guide) are enough for someone to hand to Claude and get a
similar app — the schema, credit rules, n8n wiring details (webhook auth,
service-role keys, response-format quirks) came out of debugging the generated
code against real Supabase/n8n/Replicate accounts, which is expected, iterative
work rather than something to script in advance.
