/** Shared Postgres connection config for tests.
 *  Reads from standard PG env vars with defaults matching docker-compose. */
export const pgOpts = {
  host: process.env.PGHOST ?? 'postgres',
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? 'moribashi',
  password: process.env.PGPASSWORD ?? 'password',
  database: process.env.PGDATABASE ?? 'moribashi',
};

export const connectionString =
  `postgres://${pgOpts.user}:${pgOpts.password}@${pgOpts.host}:${pgOpts.port}/${pgOpts.database}`;
