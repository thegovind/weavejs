# AGENTS.md — Weave.js Code Workspace

> The `code/` directory is the npm workspace root for all Weave.js packages, orchestrated by Nx.

---

## Workspace Setup

```bash
cd code
npm ci                  # Clean install all dependencies
npm run build           # Build all packages (respects Nx dependency graph)
npm run dev             # Start dev mode for all packages
```

**Requirements:** Node >= 22.11, npm >= 10.9

---

## Nx Commands

Nx orchestrates builds, tests, and lints across the monorepo. The dependency graph ensures packages build in correct order (`build.dependsOn: ["^build"]`).

```bash
# All packages
npm run build                   # nx run-many -t build
npm run test                    # nx run-many -t test
npm run lint                    # nx run-many -t lint
npm run format                  # nx run-many -t format

# Single package
npx nx run @inditextech/weave-sdk:build
npx nx run @inditextech/weave-sdk:test
npx nx run @inditextech/weave-react:lint

# View dependency graph
npx nx graph

# Reset Nx cache
npm run reset                   # nx reset
```

---

## Package Interdependencies

```
types ──────────────────┐
                        ├──► sdk ──► react
store-websockets ───────┘
store-standalone ───────┘
store-azure-web-pubsub ─┘

create-frontend-app   (standalone scaffolding CLI)
create-backend-app    (standalone scaffolding CLI)
```

- **`types`** — Shared TypeScript type definitions used across packages.
- **`sdk`** — Core Weave SDK; depends on `types` and store packages.
- **`react`** — React bindings; depends on `sdk`.
- **`store-*`** — Pluggable store backends (WebSockets, standalone, Azure Web PubSub).
- **`create-*-app`** — Project scaffolding CLIs, independent of other packages.

---

## Package Structure Convention

Each package under `packages/` follows this layout:

```
packages/<name>/
├── package.json        # Scoped @inditextech/weave-<name>
├── tsconfig.json       # Extends ../../tsconfig.base.json
├── vite.config.ts      # Vite/Vitest build config
├── src/
│   ├── index.ts        # Public entry point
│   └── __tests__/      # Vitest test files
└── dist/               # Build output (gitignored)
```

---

## Dev Server

```bash
npm run dev             # Starts dev watchers for all packages
```

Individual package dev mode:
```bash
npx nx run @inditextech/weave-sdk:dev
```

---

## Key Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Workspace root, scripts, engines, dependency overrides |
| `nx.json` | Nx target defaults, caching, release config |
| `tsconfig.base.json` | Shared TypeScript compiler options |
| `commitlint.config.ts` | Conventional commit rules |
| `.prettierrc` | Prettier config (`singleQuote: true`) |
| `.husky/` | Git hooks (commit-msg, pre-commit, pre-push) |
| `lerna.json` | Legacy Lerna config (Nx handles orchestration) |
| `docker-compose.yml` | Local dev infrastructure |
| `verdaccio.setup.js` | Local npm registry for testing publishes |

---

## Boundaries

- Follow the parent `AGENTS.md` for git workflow and code style rules.
- Each package has its own `package.json` with scoped name `@inditextech/weave-*`.
- All source files must include SPDX license headers.
- Build order is managed by Nx — do not add circular dependencies between packages.
