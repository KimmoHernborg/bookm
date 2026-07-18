<div align="center"><img width="300" height="86" alt="Bookm logo" src="./public/bookm-logo.svg" /></div>

# Bookm

AI-tagged bookmarking for tab hoarders. Save anything quickly; an LLM reads
the page, summarizes it, and tags it; find it again later by searching across
tags, titles, and AI-generated summaries.

- **Zero-effort save** — paste a URL or bulk-import a browser bookmarks file;
  tagging happens in the background.
- **Light and dark** — follows your OS by default; override per browser from
  the avatar menu or Settings.
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

## Optional: OIDC / SSO

Bookm can delegate sign-in to any OIDC provider — PocketID, Authelia,
Authentik, etc. — instead of (or alongside) email/password. It's off by
default and only activates once all three required variables are set:

```bash
# .env.local
OIDC_ISSUER_URL=https://idp.example.com
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
```

Setup:

1. In your IdP, register a new OIDC client with redirect URI:
   `${BETTER_AUTH_URL}/api/auth/oauth2/callback/oidc` (e.g.
   `http://localhost:3000/api/auth/oauth2/callback/oidc`).
2. Copy the client ID/secret and the IdP's base URL into `OIDC_CLIENT_ID`,
   `OIDC_CLIENT_SECRET`, and `OIDC_ISSUER_URL`.
3. Restart Bookm. A "Sign in with…" button appears on `/login` and `/signup`.

Optional variables: `OIDC_PROVIDER_ID` (default `oidc`, part of the callback
URL), `OIDC_PROVIDER_NAME` (button label, default "Single Sign-On"), and
`OIDC_SCOPES` (default `openid profile email`).

New users are provisioned on first OIDC sign-in regardless of
`REGISTRATION_OPEN` — the IdP is treated as the registration gate. Signing in
via OIDC with an email matching an existing account links the two rather than
erroring.

## How it works

A single process runs the web app (TanStack Start) and a SQLite-backed job
worker. Saving a URL enqueues `fetch_and_extract` (polite fetch, Readability
extraction, site-specific extractors for YouTube/GitHub), which enqueues
`tag_bookmark` (one OpenRouter call with structured output → title, summary,
description, 3–7 tags, content type, language, reading time). Search is
SQLite FTS5 across title, summary, description, and tag names. The model
used is `OPENROUTER_DEFAULT_MODEL` (default `openrouter/free`), same for all
users.

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
