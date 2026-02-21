import { asValue, asFunction, Lifetime, type MoribashiApp, type MoribashiPlugin } from '@moribashi/core';
import { createKnex, type PgConfig } from './knex.js';
import { Db } from './db.js';
import { SqlMigrationSource } from './migrator.js';

export interface PgPluginOptions extends PgConfig {
  /** Path to SQL migrations directory. If set, migrations run during plugin registration. */
  migrationsDir?: string;
}

/**
 * Moribashi plugin that registers `knex` and `db` as singletons
 * on the root container.
 *
 * - `knex` — the raw Knex instance for schema ops, migrations, etc.
 * - `db` — a `Db` wrapper with `query()` that returns camelCase'd rows
 *
 * If `migrationsDir` is provided, SQL migrations run automatically
 * before the app finishes starting.
 *
 * `db` is registered as a singleton so the core lifecycle calls its
 * `onDestroy` to clean up the connection pool on `app.stop()`.
 */
export function pgPlugin(opts: PgPluginOptions): MoribashiPlugin {
  const { migrationsDir, ...pgConfig } = opts;

  return {
    name: '@moribashi/pg',
    async register(app: MoribashiApp) {
      const knex = createKnex(pgConfig);

      app.container.register({
        knex: asValue(knex),
        db: asFunction(() => new Db(knex)).setLifetime(Lifetime.SINGLETON),
      });

      if (migrationsDir) {
        const source = new SqlMigrationSource(migrationsDir);
        await knex.migrate.latest({ migrationSource: source });
      }
    },
  };
}
