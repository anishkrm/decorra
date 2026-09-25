# Decorra image fixtures

Generated with the built-in ImageGen workflow on 25 September 2026. These files are synthetic and contain no personal data.

## Showcase samples

The product-facing 4:5 WebP samples live in `public/samples/` and are referenced by `supabase/seed.sql`:

| File | Intended use |
| --- | --- |
| `modern-indian-living-room.webp` | Modern Indian style card and demo content |
| `kerala-traditional-living-room.webp` | Kerala Traditional style card and demo content |
| `japandi-bedroom.webp` | Minimal Japandi style card and demo content |

Re-run `supabase/seed.sql` to update an existing Supabase project's style rows.

## Website before-and-after pairs

The matched 4:3 WebP pairs live in `public/showcase/`. They preserve each source room's viewpoint and fixed architecture, and are used by the interactive homepage comparisons.

| Pair | Redesign brief |
| --- | --- |
| `living-room-before.webp` / `living-room-after-modern-indian.webp` | Mid-budget Modern Indian redesign with sheesham, cane, block prints, indigo, terracotta and a dhurrie rug |
| `bedroom-before.webp` / `bedroom-after-japandi.webp` | Renter-friendly Japandi refresh that keeps the bed, wardrobe, desk, curtains, walls and floor |
| `kitchen-before.webp` / `kitchen-after-indo-contemporary.webp` | Indo-Contemporary organization refresh that keeps all cabinets, counters, appliances, sink, hob and window |

## Upload and transformation fixtures

| File | Format | Scenario | What to verify |
| --- | --- | --- | --- |
| `images/01-baseline-living-room.jpg` | JPEG | Well-lit, straight, normal room | Upload succeeds; layout, doors, windows, TV and sofa stay structurally consistent |
| `images/02-low-light-bedroom.png` | PNG | Dim mixed lighting and moderate shadow noise | PNG is accepted and converted to JPEG; makeover remains usable without inventing openings |
| `images/03-cluttered-kitchen.webp` | WebP | Busy counters and many small objects | WebP is accepted; cabinets, window, sink and hob remain coherent; clutter is handled cleanly |
| `images/04-backlit-balcony.jpg` | JPEG | Bright exterior, dark interior and wide-angle convergence | Exposure is handled without losing the balcony boundary; railing and doorway geometry remain safe |

## Suggested manual test matrix

1. Upload every fixture and confirm a private preview appears.
2. Generate one concept for each fixture with the matching room type.
3. For the baseline living room, compare `refresh`, `mid`, and `premium` tiers.
4. For the bedroom, enable renter mode and request: `Keep the bed and wardrobe`.
5. For the kitchen, request: `Keep the cabinets and refrigerator`.
6. For the balcony, verify the railing, doorway, camera angle, and number of openings do not change.
7. Use the before/after slider and hold-to-original control to inspect structural drift.

## Generation prompts

All prompts used the `photorealistic-natural` use case and prohibited people, text, logos, watermarks, distorted walls, and warped furniture.

- Modern Indian sample: contemporary urban Indian apartment living room with sheesham furniture, block-print cushions, cane, terracotta, indigo, brass, and a dhurrie rug; warm daylight; attainable 4:5 composition.
- Kerala Traditional sample: modern Kerala living room with carved teak seating, red oxide floor, brass nilavilakku and uruli, jute, timber rafters, and warm daylight; authentic residential 4:5 composition.
- Japandi sample: compact apartment bedroom with low light-oak bed, linen, sage, paper lantern, ceramic, and soft morning light; minimal 4:5 composition.
- Baseline fixture: ordinary mid-sized Indian apartment living room, lightly furnished, evenly lit, photographed from a corner in 4:3.
- Low-light fixture: compact lived-in bedroom at night, weak warm lights, mild phone-camera noise, readable but underexposed 4:3 scene.
- Clutter fixture: narrow working Indian kitchen with ordinary appliances, utensils, jars, and mixed lighting, photographed from the doorway in 4:3.
- Backlit fixture: narrow high-rise balcony from inside the doorway, bright exterior, dark interior, plausible wide-angle convergence, 4:3.
- Living-room after edit: replace movable furniture and decor with a warm Modern Indian scheme while preserving the exact camera, room shell, floor, balcony opening, ceiling fan, lighting positions and exterior view.
- Bedroom after edit: change only removable bedding, rug, lighting and decor to a restrained Japandi scheme while preserving the nighttime setting and all fixed or renter-sensitive elements.
- Kitchen after edit: declutter and add small Indo-Contemporary accessories and under-cabinet lighting while preserving the full kitchen layout and every fixed fixture.
