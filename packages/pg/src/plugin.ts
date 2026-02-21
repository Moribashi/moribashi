import { asValue, asFunction, Lifetime, type MoribashiApp, type MoribashiPlugin } from '@moribashi/core';
import { createKnex, type PgConfig } from './knex.js';
import { Db } from './db.js';

export interface PgPluginOptions extends PgConfig {}

/**
 * Moribashi plugin that registers `knex` and `db` as singletons
 * on the root container.
 *
 * - `knex` — the raw Knex instance for schema ops, migrations, etc.
 * - `db` — a `Db` wrapper with `query()` that returns camelCase'd rows
 *
 * `db` is registered as a singleton so the core lifecycle calls its
 * `onDestroy` to clean up the connection pool on `app.stop()`.
 */
export function pgPlugin(opts: PgPluginOptions): MoribashiPlugin {
  return {
    name: '@moribashi/pg',
    register(app: MoribashiApp) {
      const knex = createKnex(opts);

      app.container.register({
        knex: asValue(knex),
        db: asFunction(() => new Db(knex)).setLifetime(Lifetime.SINGLETON),
      });
    },
  };
}
