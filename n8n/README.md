# n8n workflows

Build these in n8n Cloud. After every change, export them (⋯ → Download) into this folder as `wf-*.json`.

Base the build on the Developer Guide, Step 6 (15-node Generate workflow). This file lists only where this repo differs from that guide.

## Credentials
| Name | Type | Value |
|---|---|---|
| Decorra Supabase | Supabase API | project URL + service_role key |
| Decorra Storage | Header Auth | `Authorization: Bearer <service_role>` (also used for RPC calls, with `apikey: <service_role>` as an extra header) |
| Replicate | Header Auth | `Authorization: Bearer <replicate token>` |
| Decorra Webhook Secret | Header Auth | `X-Decorra-Secret: <N8N_WEBHOOK_SECRET>` |

Set the n8n variable `SUPABASE_URL` (Settings → Variables), or edit the fallback in `build-prompt.js`.

## WF-2 Generate (parent): webhook `decorra-generate`
1. **Start job**: Webhook, POST, Header Auth, Respond Immediately.
2. **Get generation**, **Get room**, **Get style**: Supabase Get, exactly as in the guide.
3. **Mark analysing**: Supabase Update `generations.status = analysing`.
4. **Sign photo URL**: HTTP POST `{SUPABASE_URL}/storage/v1/object/sign/originals/{{ $('Get room').first().json.original_path }}`, body `{"expiresIn": 3600}`.
5. **Build prompt**: Code node. Paste `build-prompt.js`. It outputs **one item per variant** (`prompt, negative, strength, seed, variant, imageUrl, generation_id, user_id`).
6. **Mark rendering**: Supabase Update `status = rendering`, `prompt = {{ $json.prompt }}`. Set the node to *Execute Once*.
7. **Render variant**: Execute Workflow → WF-2b, mode *Run once for each item*, **Wait for sub-workflow completion: off**.

## WF-2b Render one variant (Execute Workflow Trigger)
Each variant runs in its own execution, so each gets its own `$execution.resumeUrl`.
1. **Start render**: HTTP POST `https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions`
   ```json
   { "input": { "prompt": {{ JSON.stringify($json.prompt) }}, "input_image": "{{ $json.imageUrl }}",
                "aspect_ratio": "match_input_image", "output_format": "jpg", "seed": {{ $json.seed }} },
     "webhook": "{{ $execution.resumeUrl }}", "webhook_events_filter": ["completed"] }
   ```
   With `adirik/interior-design`, use `/v1/predictions` plus `version`, `image`, `negative_prompt: $json.negative` and `prompt_strength: $json.strength`.
2. **Wait for callback**: Wait, On Webhook Call, POST, Limit Wait Time 3 min.
3. **Succeeded?**: If `{{ $json.body.status }}` equals `succeeded`.
4. **Download image**: HTTP GET the output URL, Response Format File. Copy it right away, because Replicate deletes outputs after 1 hour.
5. **Upload to Storage**: POST `{SUPABASE_URL}/storage/v1/object/concepts/{{user_id}}/{{generation_id}}-{{variant}}.jpg`. Add the headers `Content-Type: image/jpeg` and `x-upsert: true`.
6. **Insert concept**: Supabase Create `concepts` with `generation_id`, `user_id`, `variant` and `image_path = {{user_id}}/{{generation_id}}-{{variant}}.jpg`.
7. **Complete variant**: HTTP POST `{SUPABASE_URL}/rest/v1/rpc/complete_variant`, body `{"p_generation_id": "...", "p_ok": true}`.
   This RPC flips the job to `done` after the last variant. If none succeeded, it flips it to `failed` and refunds the credits.
8. **Explain** (P1): Execute Workflow → WF-3 with `concept_id`, not waiting.
9. **Failure branch** (the false branch of step 3, plus the Wait timeout): the same RPC with `"p_ok": false, "p_error": "{{ $json.body?.error ?? 'timed out' }}"`.

Do **not** set `status = done` directly anywhere. Only `complete_variant` closes a job.

## WF-6 Sweeper (Schedule, every 5 min)
HTTP POST `{SUPABASE_URL}/rest/v1/rpc/sweep_stuck_generations`, body `{"p_minutes": 10}`.

## Settings on every workflow
- Error Workflow: a small workflow that emails you.
- Retry On Fail (2 tries, 2000 ms) on every external HTTP node.
- Activate the workflow and use the **production** webhook URL. The Wait node cannot resume on test URLs.
