export { type PgConfig, type Knex, createKnex } from './knex.js';
export { type KnexMigrationSource, SqlMigrationSource } from './migrator.js';
export { type KnexPluginOptions, fastifyKnex } from './knex.fastify.js';
export { Db, RepoQuery, Repo } from './db.js';
export { type PgPluginOptions, pgPlugin } from './plugin.js';

export function diagnostics() {
  return { module: '@moribashi/pg' };
}
