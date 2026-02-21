import knex, { type Knex } from 'knex';

export type { Knex };

export interface PgConfig {
  /** PostgreSQL connection string, e.g. `postgres://user:pass@localhost:5432/mydb` */
  connectionString?: string;
  /** Individual connection parameters (used when connectionString is not provided) */
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  /** Connection pool settings */
  pool?: {
    min?: number;
    max?: number;
  };
  /** Enable debug logging for knex queries */
  debug?: boolean;
  /** Search path / schemas */
  searchPath?: string[];
}

export function createKnex(config: PgConfig): Knex {
  const connection = config.connectionString ?? {
    host: config.host ?? 'localhost',
    port: config.port ?? 5432,
    user: config.user ?? 'postgres',
    password: config.password ?? '',
    database: config.database ?? 'postgres',
  };

  return knex({
    client: 'pg',
    connection,
    pool: config.pool ?? { min: 2, max: 10 },
    debug: config.debug ?? false,
    searchPath: config.searchPath,
  });
}
