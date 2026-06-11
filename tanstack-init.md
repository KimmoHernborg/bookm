```bash
bunx @tanstack/cli create bookm
```

```
┌  Let's configure your TanStack application
│
◇  Select framework:
│  React
│
◇  Select toolchain
│  Biome
│
◇  Select deployment adapter:
│  Nitro (agnostic)
│
◇  Would you like to include demo/example pages?
│  No
│
◇  Keyboard Shortcuts ────────────────────────────────────────────────╮
│                                                                     │
│  Use ↑/↓ to navigate • Space to select/deselect • Enter to confirm  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────╯
│
◇  What add-ons would you like for your project? (Space to toggle, Enter to confirm)
│  Compiler, Drizzle, Form, Shadcn, Better Auth, Store, Query
│
◇  Drizzle: Database Provider
│  SQLite
│
◇  Would you like to initialize a new git repository?
│  Yes
│
●  About to create:
│
│    Project:         bookm2
│    Location:        /Users/kimmo/Dev/AI/bookm2
│    Framework:       React
│    Mode:            file-router
│    Package manager: bun
│
│    Auth:            Better Auth
│    ORM:             Drizzle
│    Deploy:          Nitro (agnostic)
│    Other add-ons:   Biome, Compiler, Form, Shadcn, Query, Store
│
│    Initialize git:  yes
│    Install deps:    yes
│    Agent skills:    no
│
◇  Continue with these settings?
│  Yes
│
◇  Initialized git repository
│
◇  Installed dependencies
│
◇  Installed additional shadcn components
│
$ tsr generate
◇  Route tree generated
│
└  Your TanStack app is ready in 'bookm2'.

Use the following commands to start your app:
% cd bookm2
% bun --bun run dev

Next steps:

Docs for the integrations you picked:
  • Nitro (agnostic) (deploy) — https://v3.nitro.build/
  • Drizzle (orm) — https://orm.drizzle.team/
  • Better Auth (auth) — https://www.better-auth.com

Please read the README.md file for information on testing, styling, adding routes, etc.
```
