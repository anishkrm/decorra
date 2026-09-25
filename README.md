# Decorra

AI makeovers for Indian homes. Upload a room photo and get design concepts in Indian and global styles, with budget tiers in rupees.

Stack: Next.js 16 (App Router) · Supabase (Postgres, Auth, Storage, Realtime) · n8n Cloud · Replicate.

## Setup
1. `cp .env.example .env.local` and fill it in.
2. Supabase SQL Editor: run `supabase/migrations/001_init.sql`, then `supabase/seed.sql`.
3. In Supabase Auth, enable Email (magic link) and optionally Google. Add `http://localhost:3000` and your Vercel URL to the redirect URLs.
4. Build the n8n workflows by following `n8n/README.md`.
5. `npm install && npm run dev`

## Flow
The browser uploads to `originals/{uid}/…` and inserts a `rooms` row. `POST /api/generations` then reserves credits, inserts the `generations` row and pings the n8n webhook. n8n renders each variant on Replicate, copies the image into `concepts/`, and calls `complete_variant`. The results page updates through Realtime, with 3 s polling as a fallback.

## Scripts
- `npm run dev`: local dev server
- `npm test`: prompt-builder tests. These also check that `n8n/build-prompt.js` matches `lib/prompt.ts`.
- `npm run build`: production build
