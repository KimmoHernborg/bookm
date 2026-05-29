# Bookm — Updated Plan

An AI-tagged bookmarking service for tab hoarders. Save anything quickly; let an
LLM read the page, summarize it, and tag it; find it again later by searching
across tags, titles, and AI-generated summaries.

This document supersedes the original spec and folds in the review feedback.
The existing scaffold (TanStack Start + Drizzle + Better Auth + Biome) is the
starting point and stays.

---

## 1. Audience and positioning

The user is the person with 200+ tabs open across three windows who wants to
"close everything" without losing anything. Existing tools (Raindrop, Pinboard,
Linkding) cover bookmarking well, but require manual tagging, which is the
exact friction that causes hoarding in the first place. The wedge is:

- **Zero-effort save.** Paste / share / bulk-import; tags happen in the background.
- **Survives link rot.** Every save captures title, summary, content, og-image
  at ingest time, so the bookmark is still useful when the page 404s.
- **Self-hostable, single binary + SQLite.** Friendly to the homelab crowd.

## 2. Naming

`hoardy` is the most memorable and leans into the audience, but the name is
already in use by at least one related tool — pick the final name only after a
namespace check (npm, GitHub org, .com / .app, Chrome Web Store). Working name
in the repo is `bookm`. Backup options: **Hoardly**, **Stash**, **Squirrel**,
**Tabby**, **Linkden** (homage).

## 3. MVP scope (two-week target)

The smallest thing that proves the tagging quality is good enough to use daily:

- Multi-user with Better Auth enabled from day one. First admin bootstrapped via
  `ADMIN_EMAIL` env var on startup (if users table is empty, that user is
  created with `is_admin=true`).
- Add bookmark by URL (paste in form).
- Bulk import from Netscape bookmark HTML (Chrome / Firefox / Safari export
  format).
- Server-side fetch + Readability extraction → cheap LLM call →
  `{summary, description, tags[], content_type, language, reading_time}`.
- SQLite + FTS5 search across title, summary, description, and tag names.
- List view with filters: tag, content type, "read / unread", date added.
- Docker compose with a Litestream sidecar replicating SQLite to S3-compatible
  storage.

Everything else (extension, snapshots, sharing, mobile) is post-MVP.

## 4. Core features (full vision)

- Add bookmark via: paste URL, browser extension, share-target PWA, bulk import
  (Netscape HTML, JSON, CSV).
- AI processing pipeline: fetch → extract → classify → tag → store.
- Search by full-text (FTS5) across title + summary + description + tag names,
  with filters for tag, content type, language, date range, and read state.
- Tag management: rename, merge, delete, color, hierarchy (optional, later).
- Re-tag job: when the prompt or model changes, re-run extraction across
  selected bookmarks.
- Link rot handling: periodic `HEAD` check, mark as broken, optional Wayback
  Machine save at ingest.
- Export to Netscape HTML, JSON, CSV.
- Public/shared lists (post-MVP, opt-in).
- Multi-user with Better Auth, including OIDC for self-hosters who want to plug
  PocketID / Authelia / Authentik in.

## 5. AI tagging design

This is the whole product, so design it carefully.

**Controlled vocabulary, model can extend.** Keep a `tags` table per user. On
each ingest, pass the user's top-N most-used tags into the system prompt and
ask the model to reuse them where appropriate; only invent a new tag when none
fit. Normalize on write: lowercase, kebab-case, singular, ASCII-fold. This
prevents the `js / javascript / JS-language` drift problem.

**One LLM call per bookmark, structured output.** Use OpenRouter with a small,
cheap model as the default — Haiku, Gemini Flash, or GPT-4o-mini class. Force
JSON schema output:

```ts
{
  title: string,            // cleaned-up title (strip site suffix)
  summary: string,          // one sentence
  description: string,      // 2–4 sentences, what's in the page
  tags: string[],           // 3–7, prefer existing
  content_type: "article" | "video" | "repo" | "docs" | "paper"
                | "tool" | "discussion" | "other",
  language: string,         // ISO 639-1
  reading_time_minutes: number | null
}
```

**Reduce tokens before calling.** Mozilla Readability (or `@mozilla/readability`
in JS) extracts main content, drops nav/footer/ads. Truncate to a sane limit
(e.g. 8k chars). For YouTube / GitHub / arXiv, use site-specific extractors
(oEmbed, GitHub README, arXiv abstract API) and skip Readability entirely.

**Fallback for unfetchable pages.** If fetch fails or content is too thin
(paywall, login wall, JS-only SPA we can't render), tag from URL + title only
and mark `extraction_quality: "low"`. Surface this in the UI so the user can
re-process or fix manually.

**Cost guardrails.** Hard caps per user per day (configurable, default e.g.
500 tags/day). Bulk imports queue at lower priority and respect the cap;
they're naturally batched overnight if the cap is reached.

## 6. Data model (sketch)

```text
users (id, email, …)                          -- from Better Auth
bookmarks (
  id, user_id, url, url_canonical, title,
  summary, description, content_type, language,
  reading_time_minutes, extraction_quality,
  status,        -- pending | processed | failed | broken
  starred, archived, read_at,
  fetched_html_path,    -- on-disk snapshot
  og_image_path,
  created_at, updated_at, processed_at, last_checked_at
)
tags (id, user_id, name, color, parent_id?)
bookmark_tags (bookmark_id, tag_id)
jobs (
  id, kind, payload_json, status, attempts,
  next_run_at, last_error, created_at, updated_at
)
bookmarks_fts                                 -- FTS5 virtual table mirror
```

URL canonicalization on write: lowercase host, drop `www.`, drop fragment,
strip known tracking params (`utm_*`, `gclid`, `fbclid`, `mc_cid`,
`mc_eid`, `ref`, `ref_src`). Dedupe by `(user_id, url_canonical)`.

## 7. Tech stack (revised)

| Layer              | Choice                                                | Notes                                                                                                                                                     |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime            | **Bun**                                               | Already scaffolded. Fine for app + workers in one process.                                                                                                |
| Framework          | **TanStack Start**                                    | Already scaffolded; pre-1.0, accept some churn.                                                                                                           |
| UI                 | **React + Tailwind + Shadcn UI**                      | Already scaffolded.                                                                                                                                       |
| DB                 | **SQLite (WAL) + Drizzle**                            | Already scaffolded. Add FTS5 virtual table.                                                                                                               |
| Auth               | **Better Auth**                                       | Already scaffolded. Email + OIDC plugin for self-hosters. PocketID becomes one of several OIDC providers, not a hard dependency.                          |
| Background jobs    | **In-process SQLite-backed queue**                    | A `jobs` table + a worker loop in the same Bun process. Persistence, retries, and visibility for free, no Redis. Drop in BullMQ only if scale demands it. |
| LLM                | **OpenRouter**                                        | Default to a cheap model; allow override per user. Optional Ollama base URL for fully local self-hosters.                                                 |
| Content extraction | **Readability (`@mozilla/readability` + `linkedom`)** | Plus site-specific extractors for YouTube / GitHub / arXiv / Reddit.                                                                                      |
| Snapshots          | **Wayback Machine save API (optional)**               | Plus on-disk gzipped HTML for the cached extracted text.                                                                                                  |
| Backups            | **Litestream sidecar**                                | Replicate SQLite to S3 / R2 / B2.                                                                                                                         |
| Lint / format      | **Biome**                                             | Already configured.                                                                                                                                       |
| Tests              | **Vitest**                                            | Already configured.                                                                                                                                       |
| Container          | **Docker + compose**                                  | App image + Litestream sidecar; one named volume.                                                                                                         |
| Extension          | **WXT**                                               | One codebase → Chrome / Firefox / Edge, MV3.                                                                                                              |
| Mobile             | **PWA + Web Share Target API**                        | iOS Share Sheet works via the PWA.                                                                                                                        |

Things explicitly cut from the original spec: BullMQ + Redis, hard PocketID
dependency.

## 8. Architecture

Single Bun process runs the HTTP server (TanStack Start) and the job worker on
a timer loop. The worker pulls due rows from `jobs`, executes them with a
typed handler map, and writes back status. This keeps the deployment to one
container plus a Litestream sidecar.

```text
┌─────────────────────── bun process ────────────────────────┐
│                                                            │
│   TanStack Start ────►  sqlite (drizzle)                   │
│        ▲                  ▲                                │
│        │                  │                                │
│        │            ┌─────┴───────┐                        │
│        └────────────│ job worker  │                        │
│                     │  (timer)    │                        │
│                     └──────┬──────┘                        │
│                            ▼                               │
│        Readability  ─►  OpenRouter  ─►  tags + summary     │
│                                                            │
└────────────────────────────────────────────────────────────┘
                 │
                 ▼ (Litestream)
            S3 / R2 / B2
```

**Job worker design:**

- Each job handler is an `async` function. The worker runs up to N concurrent
  jobs via `Promise.all` with a semaphore (default `JOB_CONCURRENCY=3`).
- Jobs are claimed atomically:
  `UPDATE jobs SET status='running', claimed_at=unixepoch() WHERE id IN
  (SELECT id FROM jobs WHERE status='pending' AND next_run_at <= unixepoch()
  ORDER BY next_run_at LIMIT ?) RETURNING *`
- Bulk import jobs run in a separate slot capped at concurrency 1 to reduce
  tag invention races during cold-start.

Job kinds (initial set):

- `fetch_and_extract` — fetch URL, extract main text, store snapshot.
- `tag_bookmark` — call LLM, write summary/tags.
- `archive_to_wayback` — optional, fire-and-forget.
- `recheck_link` — periodic, scheduled per bookmark with jittered backoff.
- `retag_bookmark` — manual, used when prompt or model is updated.

All handlers are idempotent: a re-run produces the same result for the same
input. Failures retry with exponential backoff up to N times, then go to
`status='failed'` and surface in the admin view.

**Tag normalization:** all tags are written as lowercase kebab-case. Before
inserting, normalize the string, then `INSERT OR IGNORE INTO tags (user_id,
name)` and resolve to the canonical row. This collapses `JavaScript`,
`javascript`, and `JS` to `javascript` regardless of which job writes first.

**Extraction content limit:** controlled by `EXTRACTION_MAX_CHARS` env var
(default `8000`). A per-model override map in config can raise or lower this
per model (e.g. `{ 'google/gemini-flash-1.5': 12000 }`). The env var is the
floor/default; the map overrides per model.

**Site-specific extractors (MVP):** YouTube (oEmbed) and GitHub (raw README).
URL pattern routing is wired for arXiv and Reddit too, but they fall back to
Readability until implemented post-MVP.

**Snapshot storage:** files stored at `$DATA_DIR/{user_id}/{bookmark_id}.html.gz`
and `$DATA_DIR/{user_id}/{bookmark_id}.og.jpg`. Only the relative path
(`{user_id}/{bookmark_id}.html.gz`) is stored in the DB so the root is
relocatable. `DATA_DIR` defaults to `./data` in dev and `/data` in Docker.

**URL canonicalization:** lowercase host, strip `www.`, drop URL fragment,
dedup by `(user_id, url_canonical)`. No tracking param stripping (out of
scope).

**Admin access:** admin routes require a session from a user with `is_admin=true`
in the Better Auth users table. On startup, if the users table is empty and
`ADMIN_EMAIL` is set, that user is created with `is_admin=true`.

## 9. Operational concerns

**Cost controls.** Per-user daily cap on LLM calls. Per-user budget in USD with
a soft warning and a hard stop. Track per-call cost on each job row so you can
audit later.

**Observability.** Structured JSON logs (pino). `/healthz` for the container.
A small admin route showing: pending / failed jobs, recent errors, per-user
counts and cost, "broken link" list, and a "retry" button on failed jobs.

**Backups.** Litestream from day one. Document the restore procedure in the
README and _test it_ before relying on it.

**Privacy.** Fetched pages and snapshots never leave the user's instance
except for the LLM call itself. Allow choosing the OpenRouter model per user;
allow swapping in a local Ollama URL.

**Rate limits.** Polite outbound fetches: per-host 1 RPS, custom user-agent,
respect `robots.txt` for explicit `User-agent: *` disallows on the page being
fetched.

## 10. Phased roadmap

**Phase 0 — Foundations (in progress).** Scaffold, Drizzle schema, Better Auth
enabled, FTS5 wired, basic UI with empty states. Admin bootstrap via
`ADMIN_EMAIL` on first startup.

**Phase 1 — MVP.** Paste-URL + Netscape import → fetch → extract → LLM tag →
search/list/filter UI → Docker + Litestream. Multi-user from day one.

**Phase 2 — Extension + OIDC.** OIDC plugin doc'd for self-hosters
(PocketID / Authelia / Authentik). WXT extension for Chrome + Firefox with
one-click save. PWA share target.

**Phase 3 — Quality of life.** Tag merge/rename/color, re-tag job, link-rot
checker, Wayback snapshot, exporter, bulk operations, keyboard shortcuts.

**Phase 4 — Social / sharing.** Public lists with shareable URLs, opt-in
discoverable index, RSS feed per list.

**Phase 5 — Mobile + scale.** Native iOS / Android share extensions if the PWA
isn't enough, optional Postgres adapter, optional Redis-backed BullMQ for
people running this for a team.

## 11. Open decisions

These are the calls to make before Phase 1 starts in earnest:

- **Default model.** OpenRouter has churn; pick the current best price /
  quality tradeoff at build time and re-evaluate quarterly. Start: GPT-4o-mini
  or Gemini 2.x Flash class.
- **Tag taxonomy seed.** Ship with an empty vocabulary, or seed with a
  starter list (`programming`, `ai`, `news`, `recipe`, `tool`, …)? Suggest:
  empty, let it grow per user.
- **Read / unread semantics.** Is "read" set on click-through, on a manual
  toggle, or both? Suggest: both, with click-through opt-in per user.
- **Sharing model.** Per-bookmark public link vs. only public lists? Suggest:
  only lists; bookmarks inherit visibility from their list(s).
- **License.** AGPL-3.0 (protective) vs. MIT (permissive). Suggest: AGPL-3.0
  given self-hostable + potentially-hosted-SaaS dynamic.

## 12. Out of scope (for now)

- Browser sync replacement. This is not a Chrome Sync clone; it's a save-and-
  search tool.
- A recommendation engine. Maybe later, but not the wedge.
- A full archival reader (à la Pocket's reader view). The summary + link is
  enough; the snapshot is a fallback, not a primary reading surface.
- A team / org tier. Single-user and self-host first; team comes only after
  the single-user product is genuinely good.
