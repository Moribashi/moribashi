# Moribashi

Lightweight TypeScript dependency injection framework built on [Awilix](https://github.com/jeffijoe/awilix), with composable scopes, lifecycle hooks, and a plugin system.

## Packages

| Package | Description |
|---------|-------------|
| `@moribashi/common` | Shared interfaces (`OnInit`, `OnDestroy`, type guards) |
| `@moribashi/core` | DI container, plugin system, scopes, lifecycle management |
| `@moribashi/cli` | CLI integration |
| `@moribashi/web` | Fastify web server integration with per-request scopes |
| `@moribashi/pg` | PostgreSQL integration via Knex with migrations and camelCase query helper |

## Installation

Packages are published to GitHub Packages. Configure your `.npmrc`:

```
@moribashi:registry=https://npm.pkg.github.com
```

Then install:

```sh
npm install @moribashi/core @moribashi/common
```

## Quick Start

```ts
import { createApp } from '@moribashi/core';
import { pgPlugin } from '@moribashi/pg';
import { webPlugin } from '@moribashi/web';

const app = createApp();

app.use(pgPlugin({
  host: 'localhost',
  user: 'postgres',
  database: 'mydb',
}));
app.use(webPlugin({ port: 3000 }));

// Scan for services and repositories by convention
await app.scan(['**/*.svc.ts', '**/*.repo.ts'], { cwd: __dirname });

await app.start();  // Resolves singletons, calls onInit()
// ...
await app.stop();   // Calls onDestroy() in reverse order, disposes scopes
```

## Plugins

### `@moribashi/web`

Wraps Fastify with per-request DI scopes:

```ts
import { webPlugin } from '@moribashi/web';

app.use(webPlugin({ port: 3000 }));

// After start, routes get scoped DI containers per request
const fastify = app.resolve('fastify');
fastify.get('/items', async (request) => {
  const svc = request.scope.resolve('itemsService');
  return svc.findAll();
});
```

### `@moribashi/pg`

Registers `knex` (raw Knex instance) and `db` (camelCase query wrapper) as singletons:

```ts
import { pgPlugin, type Db } from '@moribashi/pg';

app.use(pgPlugin({
  connectionString: 'postgres://user:pass@localhost:5432/mydb',
  migrationsDir: './data/migrations',  // optional: runs on startup
}));

// In a service or repo:
class UsersRepo {
  constructor({ db }: { db: Db }) {
    this.db = db;
  }

  async findAll() {
    // Columns are auto-camelCased (e.g. created_at -> createdAt)
    return this.db.query('SELECT id, full_name, created_at FROM users');
  }
}
```

SQL migrations use the Flyway naming convention: `V1.0.0__description.sql`.

## Conventions

- **File naming**: `*.svc.ts` (services), `*.repo.ts` (repositories), `*.domain.ts` (types)
- **Auto-format**: `books.svc` resolves to `booksService`, `books.repo` to `booksRepo`
- **Constructor injection**: Destructured object pattern: `constructor({ dep }: { dep: Dep })`
- **Lifecycle hooks**: Duck-typed `onInit()` / `onDestroy()` methods
- **Lifetimes**: Singletons by default, scoped services via `registerInScope()`
- **No decorators**: Convention-based, keeping it simple

## Architecture

```
createApp() -> MoribashiApp
  .use(plugin)         Collects plugins
  .scan(patterns)      Auto-discovers services by file convention
  .start()             Registers plugins, resolves singletons, fires onInit
  .stop()              Disposes scopes, fires onDestroy in reverse, disposes root

Plugins:
  { name, register(app) }   Sync or async registration into the root container

Scopes:
  app.registerInScope(key, services)   Pre-registers scoped services
  app.createScope(key?)                Creates an isolated child container
  scope.dispose()                      Fires onDestroy on scoped services
```

## Development

```sh
pnpm install                              # Install dependencies
pnpm run build                            # Build all packages (ordered)
pnpm --filter @moribashi/pg run test      # Run tests
npx tsc --noEmit -p packages/core/tsconfig.json   # Type-check a package
```

### Releasing

1. Update version numbers in each `packages/*/package.json`
2. Commit and push to `main`
3. Tag the commit: `git tag 0.1.0`
4. Push the tag: `git push origin 0.1.0`
5. CI builds, tests, and publishes all packages to GitHub Packages

## License

Private
