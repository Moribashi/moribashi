# Moribashi v1 Quality-Uplift Plan

## Context

Moribashi is a TypeScript DI framework (Awilix + lifecycle + scopes + plugins) in the "foundation complete" milestone per `.agents/state/progress.md`. The **public API contract is not the problem** — downstream consumers depend on it and it must not change. What's missing is **Spring-framework-level polish**: tests, docs, examples, and release hygiene.

Three parallel audits found:

- **Tests:** only `@moribashi/pg` is tested (~900 LOC, integration-heavy). `common`, `core`, `cli`, `graphql`, `web` have **zero tests**. Critical lifecycle (double-start, reverse teardown, plugin async errors, scope disposal, per-request scope isolation) is completely uncovered. No vitest config, no coverage gate, CI runs pg tests only.
- **Docs:** Root README is good. Zero package-level READMEs. Zero JSDoc on `createApp()`, `webPlugin()`, `graphqlPlugin()` — the three primary entry points. No TypeDoc, no LICENSE/CHANGELOG/CONTRIBUTING. `pg` is the lone exemplar of good inline docs.
- **Tooling:** No Biome config, no pre-commit (and per decision we keep it that way), no changesets. CI type-checks but doesn't lint, doesn't enforce coverage, doesn't smoke-test `examples/simple`.

The goal of this plan: close those gaps in phased, non-breaking increments so a new adopter can discover the API, trust the tests, and follow idiomatic examples — without the framework's surface shifting under them.

## Guiding Principles

- **Contract-preserving only.** No signature, export-shape, naming, or build changes. Every PR compiles existing consumers untouched.
- **Leverage over volume.** Cover the load-bearing abstractions (lifecycle, scope, plugin) before surface polish.
- **Follow existing conventions.** CLAUDE.md rules (ESM, `.svc.ts`/`.repo.ts`, `Symbol.for()` scopes, duck-typed hooks, constructor injection) in every new test and example. `pg`'s JSDoc and test style are the reference.
- **CI is the only gate.** No husky, no lint-staged, no pre-commit hooks. Developers get instant feedback via format-on-save in their editor; CI is the authoritative check.
- **One tool for format + lint.** Biome replaces ESLint + Prettier + eslint-plugin-import + their configs.
- **Integration tests stay opt-in.** Pure-unit work expands without requiring Postgres; pg remains the one integration-heavy package.
- **Thin, reviewable slices.** Each phase lands incrementally; no phase blocks later phases longer than necessary.

## Phase 1 — Foundation (tooling & CI)

Why first: Biome formatting-on-save and a CI lint gate must exist before test/doc PRs land, so we can catch drift and ratchet coverage.

**Create:**
- `/workspace/biome.json` — formatter + linter config. 2-space indent, single quotes, trailing-comma `all`, `recommended` rules. Matches current `pg` test style so it doesn't rewrite the world.
- `/workspace/vitest.config.ts` — workspace-aware (`projects: ['packages/*', 'examples/*']`), v8 coverage, initial thresholds matching current pg baseline, ratcheting upward over time.
- `/workspace/.vscode/settings.json` — mirrors devcontainer settings for contributors not using the devcontainer: `editor.formatOnSave`, `editor.defaultFormatter: biomejs.biome`, `source.fixAll.biome` on save.
- `/workspace/.vscode/extensions.json` — recommends `biomejs.biome`.
- `/workspace/.github/workflows/ci.yml` — runs on push/PR: `biome ci` (format + lint check, no fix), typecheck all packages, `pnpm -r run test` across the workspace, upload coverage artifact. Postgres service available for pg integration tests.

**Modify:**
- `/workspace/package.json` — add scripts: `format` (biome format --write), `format:check`, `lint` (biome lint), `check` (biome check — one-shot format+lint), `test`, `test:coverage`, `typecheck`. Add devDeps: `@biomejs/biome`, `@vitest/coverage-v8`.
- `/workspace/.devcontainer/devcontainer.json` — already has biome extension + format-on-save wired (no change needed; just confirm).
- Each `packages/{common,core,cli,graphql,web}/package.json` + `examples/simple/package.json` — add `"test": "vitest run --passWithNoTests"` so the matrix is uniform.
- `/workspace/.github/workflows/publish.yml` — leave alone (tag-gated publish still works). `ci.yml` takes over PR/push checks.

**Deliberate non-goals for Phase 1:**
- No auto-reformatting the whole repo. Biome config is tuned to match current style so the initial `biome ci` run passes on the existing codebase (or close to it — we fix drift but don't restyle).
- No pre-commit hooks. Husky/lint-staged stay off.
- No eslint, no prettier.

## Phase 2 — Test coverage to Spring-tier

All pure-unit unless noted. Each file is one PR-sized slice. All core/web/graphql tests live in `packages/<pkg>/src/__tests__/` to match `pg`'s existing layout.

1. `packages/core/src/__tests__/app.lifecycle.test.ts` — double-`start()` rejection, reverse-order teardown, plugin async error propagation, `stop()` without `start()` is safe. **(top risks 1, 2, 3)**
2. `packages/core/src/__tests__/scope.test.ts` — `createScope` with `Symbol.for()` keys, nested scope disposal (child before parent), active-scope tracking under concurrency. **(risk 4)**
3. `packages/core/src/__tests__/cradle-proxy.test.ts` — Awilix PROXY `strict: true` enforcement: unknown-key throws, enumeration behavior. **(risk 8)**
4. `packages/core/src/__tests__/plugin.test.ts` — `use()` ordering preserved, async `register` awaited, failing plugin surfaces clearly, `ScanOptions.formatName` callback invoked.
5. `packages/web/src/__tests__/webserver.test.ts` — `onInit` listens, `onDestroy` closes cleanly, uses ephemeral port. **(risk 5)**
6. `packages/web/src/__tests__/request-scope.test.ts` — per-request scope isolation, disposal on `onResponse` and `onRequestAbort`, concurrent requests. **(risk 6)**
7. `packages/graphql/src/__tests__/bindResolvers.test.ts` — resolver binding wires cradle into `this`, lazy resolution through proxy. **(risk 7)**
8. `packages/graphql/src/__tests__/scope-context.test.ts` — `scopeContext` produces fresh scope per op, throws when scope missing.
9. `packages/common/src/__tests__/common.test.ts` — smoke for `hasOnInit`, `hasOnDestroy`, both interfaces, `diagnostics()`.
10. `packages/pg/src/__tests__/migrator-errors.test.ts` (**requires Postgres**) — `SqlMigrationSource` error paths. **(risk 9)**
11. `examples/simple/src/__tests__/smoke.test.ts` — boots app, hits a route, shuts down clean. **(risk 10)**

**Coverage target:** 80% lines on `core`, `web`, `graphql`, `common` (reached by ratchet, not gated on PR 1). `pg` keeps its integration baseline. `cli` exempt (stub).

Delegate to `test-runner` for gap validation; `example-runner` for the smoke test.

## Phase 3 — Documentation uplift

**Per-package READMEs** at `packages/{common,core,cli,graphql,pg,web}/README.md`. Template: purpose · install · 20-line quickstart · links to API docs · stability marker (`@public` / `@experimental`). Single shared structure; `pg` can use its existing JSDoc prose as seed.

**JSDoc pass priority** (use `pg` as style reference):

1. `packages/core/src/index.ts` — `createApp`, `MoribashiApp`, `MoribashiScope`, `MoribashiPlugin`, `ScanOptions` (incl. `formatName` callback signature + example).
2. `packages/web/src/index.ts` — all 6 exports, especially `webPlugin`, `WEB_REQUEST_SCOPE`, and the `FastifyRequest.scope` augmentation.
3. `packages/graphql/src/index.ts` — fill remaining 5 un-JSDoc'd exports; `bindResolvers`/`scopeContext` already have good prose.
4. `packages/common/src/index.ts` — all 5 exports.
5. `packages/cli/src/index.ts` — stub only; JSDoc the intent.
6. `packages/pg/src/*.ts` — polish gaps, mark `Repo`/`RepoQuery` `@experimental`.

**TypeDoc:** `/workspace/typedoc.json` + `/workspace/docs/api/` generated output, built in CI as artifact. Use `--entryPointStrategy packages`.

**Docs site:** **deferred** (per decision). VitePress or similar comes after READMEs + TypeDoc land — content first, host later.

Delegate to `general-purpose` for JSDoc; `code-reviewer` for the polish gate.

## Phase 4 — Examples expansion

Under `/workspace/examples/`:

- `simple/` (existing) — add CI smoke test (Phase 2.11).
- `scoped-services/` — `Symbol.for()` tag + request-scoped repo.
- `custom-plugin/` — user-authored `MoribashiPlugin` with `onInit`/`onDestroy`.
- `error-handling/` — plugin failure + graceful shutdown.
- `migrations-demo/` — `SqlMigrationSource` + `pgPlugin`; Postgres-gated in CI.
- `graphql-server/` — minimal `bindResolvers` + `scopeContext` demo.

(`cli-basic` deferred per decision — `cli` package stays a stub.)

**CI smoke tests** for `simple`, `scoped-services`, `custom-plugin`, `error-handling`, `graphql-server` (no Postgres). `migrations-demo` runs in the pg-integration job only. Each example gets its own README.

Delegate to `example-runner`.

## Phase 5 — Release hygiene

**Create:**
- `/workspace/LICENSE` — MIT (per decision).
- `/workspace/CONTRIBUTING.md` — dev setup, test matrix, PR checklist.
- `/workspace/CHANGELOG.md` — seeded; changesets owns going forward.
- `/workspace/.changeset/config.json` — per-package semver.
- `/workspace/CODE_OF_CONDUCT.md` — Contributor Covenant.

**Stability markers** (pure annotation, no API change): `@public` on `createApp`, `MoribashiApp`, `MoribashiScope`, `MoribashiPlugin`, `pgPlugin`, `webPlugin`, `graphqlPlugin`, `bindResolvers`, `scopeContext`, `Db`. `@experimental` on `Repo`, `RepoQuery`, `ScanOptions`, all `cli` exports.

**Semver policy** (documented in `CONTRIBUTING.md`): `@public` strict semver; `@experimental` may minor-break. Release automation via changesets + existing `publish.yml`.

Delegate to `release-prep`.

## Sequencing & Dependencies

- **Phase 1 gates everything** — Biome + CI + vitest workspace infra. ~1 day.
- **Phases 2, 3, 4 run in parallel** after Phase 1. Good PR unit: "core polish PR" = tests 2.1–2.4 + core README + core JSDoc, landed together.
- **Phase 5 runs last** — stability markers informed by Phase 3 JSDoc; changelog captures earlier phases.
- **Early "wow" deliverable (week 1):** Phase 1 + core tests (2.1–2.3) + core README + core JSDoc landed together. Demonstrates the new quality bar on the framework's most critical package.

## Verification Plan

| Phase | Gate |
|---|---|
| 1 | CI green: `biome ci` + typecheck + workspace tests + coverage artifact uploaded. Format-on-save working in devcontainer and in local VSCode via `.vscode/settings.json`. |
| 2 | ≥80% line coverage on `core`/`web`/`graphql`/`common` (ratcheted). All 10 audited risks have a named test. `examples/simple` smoke test green. CI fails on regression. |
| 3 | 100% of `@public` exports carry JSDoc (enforced via a Biome rule or a custom check). All 6 packages have a README. TypeDoc builds zero warnings. |
| 4 | 5 example smoke tests green in default CI; `migrations-demo` green in pg-integration CI. Each example has a README. |
| 5 | `pnpm changeset` produces a valid release. LICENSE/CONTRIBUTING/CHANGELOG/COC present. Every exported symbol tagged `@public` or `@experimental` (verified via TypeDoc categorization). |

## Critical Files

**Create:**
- `/workspace/biome.json`
- `/workspace/vitest.config.ts`
- `/workspace/.vscode/settings.json`, `/workspace/.vscode/extensions.json`
- `/workspace/.github/workflows/ci.yml`
- `/workspace/typedoc.json`
- `/workspace/LICENSE`, `/workspace/CONTRIBUTING.md`, `/workspace/CHANGELOG.md`, `/workspace/CODE_OF_CONDUCT.md`
- `/workspace/.changeset/config.json`
- Test files under `packages/{core,web,graphql,common}/src/__tests__/`
- `packages/{common,core,cli,graphql,pg,web}/README.md`

**Modify (JSDoc + stability tags + scripts only, no behavior change):**
- `packages/core/src/index.ts`, `packages/web/src/index.ts`, `packages/graphql/src/index.ts`, `packages/common/src/index.ts`, `packages/cli/src/index.ts`, `packages/pg/src/*.ts`
- `packages/*/package.json` + `examples/simple/package.json` (test scripts)
- `/workspace/package.json` (root scripts + devDeps)

## Decisions (confirmed)

1. **LICENSE** — MIT.
2. **Docs site** — deferred. TypeDoc HTML artifact only for now; revisit a site (VitePress/Docusaurus) once per-package content stabilizes.
3. **`cli` package** — remains a stub. All `cli` exports tagged `@experimental`. No `cli-basic/` example in this pass.
4. **Coverage threshold** — ratchet from current baseline. CI records pg's current number as the floor and enforces "no regression"; the 80% target is aspirational, reached via successive Phase 2 PRs rather than gating the first one.
5. **Linter/formatter** — Biome (single config, replaces ESLint + Prettier).
6. **Pre-commit hooks** — none. CI is the only gate; developers rely on format-on-save in VSCode (devcontainer + local `.vscode/settings.json`).
