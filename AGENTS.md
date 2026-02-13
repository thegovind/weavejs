# AGENTS.md — Weave.js (Root)

> Weave.js is a TypeScript framework for real-time collaborative applications built on Yjs and Konva.
> Monorepo managed with **Nx** and **npm workspaces**. Licensed under Apache-2.0.

---

## 1. Build & Run Commands

All commands run from the `code/` directory:

```bash
cd code
npm ci                  # Install dependencies (clean)
npm run build           # Build all packages (nx run-many -t build)
npm run test            # Run all tests (nx run-many -t test, Vitest)
npm run lint            # Lint all packages
npm run lint:fix        # Auto-fix lint issues
npm run dev             # Start dev servers for all packages
npm run format          # Format code with Prettier
npm run check           # Type-check all packages
npm run verify          # Full verify: npm ci + nx run-many -t verify
```

**Prerequisites:** Node >= 22.11, npm >= 10.9

---

## 2. Testing

- **Framework:** Vitest
- **Run all tests:** `cd code && npm run test`
- **Run a single package's tests:**
  ```bash
  cd code && npx nx run @inditextech/weave-sdk:test
  cd code && npx nx run @inditextech/weave-react:test
  cd code && npx nx run @inditextech/weave-types:test
  ```
- **Run a specific test file:**
  ```bash
  cd code && npx vitest run packages/sdk/src/__tests__/some.test.ts
  ```
- Tests must pass before pushing (enforced by husky `pre-push` hook).

---

## 3. Project Structure

```
weavejs/
├── code/                          # Main workspace root
│   ├── package.json               # Workspace config, scripts, engines
│   ├── nx.json                    # Nx orchestration config
│   ├── tsconfig.base.json         # Shared TypeScript config
│   ├── commitlint.config.ts       # Conventional commits config
│   ├── .husky/                    # Git hooks (pre-commit, pre-push, commit-msg)
│   ├── .prettierrc                # Prettier config (singleQuote: true)
│   └── packages/
│       ├── sdk/                   # @inditextech/weave-sdk — Core SDK
│       ├── react/                 # @inditextech/weave-react — React bindings
│       ├── types/                 # @inditextech/weave-types — Shared type definitions
│       ├── store-websockets/      # @inditextech/weave-store-websockets
│       ├── store-standalone/      # @inditextech/weave-store-standalone
│       ├── store-azure-web-pubsub/# @inditextech/weave-store-azure-web-pubsub
│       ├── create-frontend-app/   # Scaffolding CLI for frontend apps
│       └── create-backend-app/    # Scaffolding CLI for backend apps
├── docs/                          # Documentation source
├── .github/
│   ├── illuminate/                # VitePress wiki site
│   │   ├── .vitepress/            # VitePress config & theme
│   │   ├── getting-started/       # Getting started guides
│   │   ├── deep-dive/             # Deep-dive articles
│   │   └── onboarding/            # Onboarding guides
│   └── workflows/                 # CI/CD GitHub Actions
├── images/                        # Project images/assets
├── CONTRIBUTING.md                # Contribution guidelines
├── LICENSE                        # Apache-2.0
├── REUSE.toml                     # REUSE/SPDX compliance config
└── repolinter.json                # Repo linting rules
```

---

## 4. Code Style

- **Language:** TypeScript (strict mode), ESM modules (`"type": "module"`)
- **Formatter:** Prettier — single quotes (`singleQuote: true`)
- **Linter:** ESLint (run via `npm run lint`)
- **SPDX license headers required** on every source file:
  ```typescript
  // SPDX-FileCopyrightText: 2025 INDUSTRIA DE DISEÑO TEXTIL S.A. (INDITEX S.A.)
  //
  // SPDX-License-Identifier: Apache-2.0
  ```
- REUSE compliance is enforced — see `REUSE.toml` for coverage rules.
- Target: ES2015+ with ESNext modules.

---

## 5. Git Workflow

- **Branch model:** Feature branches off `main`, PRs required for merge.
- **Conventional Commits** enforced via commitlint (`@commitlint/config-conventional`):
  ```
  feat: add new collaboration mode
  fix: resolve sync race condition
  docs: update getting-started guide
  chore: bump dependency versions
  ```
- **Husky git hooks:**
  - `commit-msg` → runs commitlint
  - `pre-commit` → runs `npm run lint`
  - `pre-push` → runs `npm run build && npm run test`
- Always rebase or merge from `main` before opening a PR.

---

## 6. Boundaries

### ✅ Always Do
- Run `npm run test` and `npm run lint` before opening a PR
- Follow conventional commit message format
- Add SPDX license headers to all new source files
- Keep changes scoped to a single package when possible
- Update relevant documentation when changing public APIs

### ⚠️ Ask First
- Architectural changes spanning multiple packages
- Adding new packages to the monorepo
- Upgrading major dependency versions (Yjs, Konva, Nx, TypeScript)
- Modifying shared configs (`tsconfig.base.json`, `nx.json`)

### 🚫 Never Do
- Commit with tests failing
- Remove or alter SPDX license headers
- Modify CI/CD workflows (`.github/workflows/`) without review
- Push directly to `main` — always use a PR
- Add dependencies without verifying license compatibility (Apache-2.0)
