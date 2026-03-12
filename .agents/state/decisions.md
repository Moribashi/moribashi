# Architectural Decisions

## DI Container: Awilix with PROXY mode
- Awilix provides mature container with scoping, lifetime management, disposal
- PROXY injection mode: dependencies resolved lazily via Proxy object, supports circular detection
- `strict: true`: prevents lifetime leakage (singletons can't depend on shorter-lived services)

## Lifecycle: Duck-typed interfaces
- Services implement `onInit()`/`onDestroy()` methods — detected at runtime via typeof check
- No decorators, no metadata reflection — keeps it simple and compatible
- Interfaces (`OnInit`, `OnDestroy`) in `@moribashi/common` for type-safety, but runtime detection is structural
- Singletons: `onInit` called during `app.start()`, `onDestroy` during `app.stop()` in reverse order

## Plugin System: Deferred registration
- `app.use(plugin)` collects plugins; `app.start()` calls `register()` in order
- This allows all plugins to be collected before any run, enabling ordered initialization
- Plugins register into the one root container — no per-plugin containers
- `register()` can be async for plugins that need setup (loading config, etc.)

## Scopes: Symbol.for() keys
- Named scopes use `Symbol.for('moribashi.scope.<name>')` for cross-package compatibility
- `app.registerInScope(key, services)` stores scoped registrations
- `app.createScope(key)` creates Awilix child scope with stored registrations applied
- Framework tracks active scopes; `app.stop()` disposes all remaining scopes
- Scopes are opt-in — most plugins just register singletons into root

## TypeScript Config: Decentralized rootDir
- `tsconfig.base.json` does NOT set `rootDir` or `outDir` — each package sets its own
- Allows `examples/simple` to use `paths` mappings (for IDE click-through to package sources) without TS6059 errors
- Example uses `noEmit: true` so rootDir is irrelevant for its output

## Repository Pattern: Repo + RepoQuery with SQL files
- `RepoQuery<E>` wraps a single SQL query with typed, bounds-checked access (`one`, `any`, `many`, `none`)
- `Repo` base class auto-wires `RepoQuery` fields by reading `.sql` files from a `sql/` directory next to the repo
- SQL file names must match the `RepoQuery` property names (e.g. `findById` → `sql/findById.sql`)
- `_autowire()` must be called at the end of the **subclass** constructor, not in `super()` — JS class field initializers run after `super()` returns, so the `RepoQuery` fields don't exist during the base constructor
- Keeps SQL out of TypeScript — easier to read, lint, and review separately
- Uses `fs.readFileSync` at construction time (sync, one-time cost at startup)
