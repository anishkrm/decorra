# Decorra — Project Summary

AI Interior Makeover for Indian homes. Upload one room photo, pick a style and an
INR budget, get a photoreal redesign concept in under a minute, compare it against
the original, and save your favorites.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind | One codebase, phone + desktop |
| Backend | Supabase (Postgres, Auth, Storage, Realtime, RLS) | Managed, fast to build on |
| AI orchestration | n8n Cloud | Handles the 30–90s render outside the request/response cycle |
| Image model | Replicate — `black-forest-labs/flux-kontext-pro` | Instruction-based editing, keeps room structure |

The browser never talks to n8n or Replicate directly — only the Next.js server does,
so no API keys reach the client.

## User flow

1. **Sign in** — magic link or Google (Supabase Auth).
2. **Upload** (`/new`) — a room photo (HEIC auto-converted, resized, EXIF stripped),
   room type, one of 12 styles, a budget tier, optional renter mode + a note.
3. **Generate** — the app inserts a `generations` row, checks the credit balance,
   pings an n8n webhook with just the row's ID, and returns immediately (202).
4. **Results** (`/generations/[id]`) — watches that row live via Supabase Realtime
   (with a 3s poll fallback) and shows a before/after slider once it's done.
5. **Gallery** — saved concepts, grouped by room, with signed-URL downloads.

## Styles

5 India-first (Modern Indian, Kerala Traditional, Chettinad, Rajasthani,
Indo-Contemporary) + 7 global (Japandi, Scandinavian, Modern Luxe, Industrial,
Bohemian, Coastal, Mid-Century). Each has a prompt recipe, a palette, and a sample
image, stored in the `styles` table so new ones can be added without a deploy.

## Data model (short version)

`profiles` (credits, unlimited flag) · `rooms` · `styles` · `model_configs` ·
`generations` (one per "Generate" click) · `concepts` (one per rendered image).
Every table has row-level security scoped to `auth.uid()`. Photos live in private
Storage buckets (`originals`, `concepts`), only ever accessed via short-lived signed
URLs.

## Credits

- 5 free credits per sign-up. 1 credit = 1 generated concept.
- **Charged only on success.** Starting a job just checks the balance — nothing is
  deducted up front. A credit is spent the moment a concept actually finishes
  rendering. A failed, crashed, or stuck job costs nothing; there's no refund step
  because nothing was ever taken.
- The owner's account has an `unlimited` flag that skips the check and the
  deduction entirely, so it's immune to any future bulk credit reset.

## Not built yet (P1 backlog)

- Room quality check / auto room-type detection (vision LLM) — schema is ready
  (`rooms.analysis`), workflow isn't built.
- "Explain the design" card with an INR cost estimate — same story
  (`concepts.explain` column exists, no workflow yet).
- Object locking ("keep my sofa") and style-reference upload.
- Share link + family vote.
- The hourly rate limit on generations is currently **disabled** for testing —
  re-enable `HOURLY_LIMIT` in `app/api/generations/route.ts` before real users.

## Where things live

- Pages: `app/new`, `app/generations/[id]`, `app/gallery`
- API: `app/api/generations/route.ts`
- Prompt logic: `lib/prompt.ts` (mirrored into the n8n Code node)
- DB schema/history: `supabase/migrations/001…008`
- n8n workflow notes: `n8n/README.md`, and the node-by-node breakdown in
  [DEVELOPMENT_SUMMARY.md](./DEVELOPMENT_SUMMARY.md)

See [DEVELOPMENT_SUMMARY.md](./DEVELOPMENT_SUMMARY.md) for how the n8n pipeline
and prompt engineering actually work, the gotchas we hit building it, and the
condensed prompts used to build the app.
