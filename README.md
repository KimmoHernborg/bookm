<div align="center"><img width="300" height="86" alt="Bookm logo" src="https://github.com/user-attachments/assets/25279d30-4f42-44f0-b2a2-d83414dfdeab" /></div>

# Bookm

AI-tagged bookmarking for tab hoarders. Save anything quickly; an LLM reads
the page, summarizes it, and tags it; find it again later by searching across
tags, titles, and AI-generated summaries.

- **Zero-effort save** — paste a URL or bulk-import a browser bookmarks file;
  tagging happens in the background.
- **Self-hostable** — single process, SQLite, one Docker volume.
- **Honest states** — pending, failed, and broken links are shown plainly
  inline and surfaced in the admin view.

See [PLAN.md](PLAN.md) for the full product plan and [DESIGN.md](DESIGN.md)
for the design system.

## Getting started (dev)

```bash
bun install
cp .env.example .env.local   # then fill in the values below
bun run dev
```

Required configuration in `.env.local`:

- `BETTER_AUTH_SECRET` — generate with `bunx --bun @better-auth/cli secret`
- `ADMIN_EMAIL` — on first startup with an empty database this user is
  created as admin and its generated password is printed once in the server
  logs
- `OPENROUTER_API_KEY` — required for AI tagging (bookmarks fail processing
  without it; jobs can be retried from `/admin` once set)

Registration is closed by default (`REGISTRATION_OPEN=false`); the admin
creates users from `/admin`.

## How it works

A single process runs the web app (TanStack Start) and a SQLite-backed job
worker. Saving a URL enqueues `fetch_and_extract` (polite fetch, Readability
extraction, site-specific extractors for YouTube/GitHub), which enqueues
`tag_bookmark` (one OpenRouter call with structured output → title, summary,
description, 3–7 tags, content type, language, reading time). Search is
SQLite FTS5 across title, summary, description, and tag names.

Per-user model overrides (any OpenRouter slug) live in `/settings`.

## Commands

```bash
bun run dev        # dev server on :3000
bun run test       # vitest unit tests
bun run check      # biome lint + format
bun run build      # production build (.output/)
bun run db:generate  # generate drizzle migrations after schema changes
```

Migrations in `drizzle/` run automatically on startup.

## Docker

```bash
BETTER_AUTH_SECRET=$(openssl rand -base64 32) \
ADMIN_EMAIL=you@example.com \
OPENROUTER_API_KEY=sk-or-... \
docker compose up --build
```

Data lives in the `bookm-data` named volume. Health check: `GET /api/healthz`.

Set `PORT` to publish on a different host port (default 3000), e.g. `PORT=3001 docker compose up`. The default `BETTER_AUTH_URL` follows it; if you set `BETTER_AUTH_URL` yourself, make sure its port matches. Running the built server directly (`bun .output/server/index.mjs`) also respects `PORT` as the listen port.
