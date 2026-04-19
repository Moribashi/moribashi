export { Db, Repo, RepoQuery } from './db.js';
export { fastifyKnex, type KnexPluginOptions } from './knex.fastify.js';
export { createKnex, type Knex, type PgConfig } from './knex.js';
export { type KnexMigrationSource, SqlMigrationSource } from './migrator.js';
export { type PgPluginOptions, pgPlugin } from './plugin.js';

export function diagnostics() {
  return { module: '@moribashi/pg' };
}
