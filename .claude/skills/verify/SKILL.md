---
name: verify
description: How to launch and drive bookm against a scratch database for end-to-end verification (dev server, test users, auth endpoints).
---

# Verifying bookm end-to-end

## Launch against a scratch DB

```bash
export PATH="$HOME/.bun/bin:$PATH"   # bun is not on PATH in non-interactive shells
DATABASE_URL=/path/to/scratch.db \
REGISTRATION_OPEN=true \
BETTER_AUTH_URL=http://localhost:3010 \
bun --bun vite dev --port 3010 --strictPort > dev.log 2>&1 &
until grep -qa "ready in" dev.log; do sleep 0.5; done
```

- Ports 3000/3001 are busy on this machine; use 3010+ and always `--strictPort` —
  otherwise vite silently increments and your requests hit whatever else owns the port.
- `BETTER_AUTH_URL` is required: Better Auth validates the Origin header on any
  POST that carries cookies, and without it trusted origins default to
  localhost:3000 → `INVALID_ORIGIN`. (Production sets it in docker-compose.)
- Migrations apply automatically at app boot (bun:sqlite), so a fresh scratch
  file just works.
- To stop: `pkill -f "vite dev --port 3010"` — killing the wrapper shell PID
  leaves the bun/node children alive and holding the port.

## Driving auth endpoints with curl

```bash
curl -s -c u.jar -X POST http://localhost:3010/api/auth/sign-up/email \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:3010' \
  -d '{"name":"Alice","email":"alice@test.local","password":"alicepass1"}'
```

- Every cookie-bearing POST needs the `Origin` header or Better Auth 403s.
- **First-request gotcha:** if `ADMIN_EMAIL` is set, the very first request
  against an empty DB triggers the admin bootstrap, and the bootstrap's
  session cookie leaks into that response's Set-Cookie — overwriting your
  user's cookie in a curl jar. Discard the signup cookies and sign in again
  with a fresh jar.
- Session check: `curl -s -b u.jar http://localhost:3010/api/auth/get-session`
  (returns `null` when unauthenticated).

## Surfaces

- No playwright/chromium in this environment — GUI clicks can't be driven.
  Closest substitutes: exercise the Better Auth / server-fn endpoints with
  curl, and fetch SSR'd pages with the session cookie (`curl -b u.jar
  http://localhost:3010/settings`) — TanStack Start renders the full page
  HTML including route-context user data, so you can assert markup and
  loader data server-side.
- Inspect the scratch DB read-only with bun:
  `bun -e 'const {Database}=require("bun:sqlite"); ... new Database(path,{readonly:true})'`
  (no sqlite3 CLI installed).
