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
