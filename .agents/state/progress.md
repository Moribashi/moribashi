# Progress

## Current Milestone
Foundation complete — DI container with composable scopes, lifecycle hooks, and plugin system.

## Recently Completed
- Fixed TS6059 errors by removing redundant `rootDir`/`outDir` from `tsconfig.base.json` (packages set their own)
- Added lifecycle interfaces (`OnInit`, `OnDestroy`) to `@moribashi/common`
- Added plugin system (`MoribashiPlugin`, `app.use()`), composable scopes (`app.createScope(key?)`), and lifecycle management (`app.start()`/`app.stop()`) to `@moribashi/core`
- Named scopes via `Symbol.for()` — `app.registerInScope(key, services)` + `app.createScope(key)`
- Re-exported Awilix utilities (`asClass`, `asFunction`, `asValue`, `Lifetime`) from core
- Updated example with lifecycle hooks on `BooksService`
- IDE click-through works via `paths` mappings in `examples/simple/tsconfig.json`

## Next Steps
- Build concrete scope plugins (WebContext via `@moribashi/web`, EventContext for Kafka)
- Add scoped service lifecycle hooks (onInit/onDestroy within scopes)
- Build a real plugin (e.g., `@moribashi/postgres`) to validate the plugin contract
- Add tests
- Middleware/interceptor support
