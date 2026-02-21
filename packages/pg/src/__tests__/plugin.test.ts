import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '@moribashi/core';
import { pgPlugin, Db } from '../index.js';
import type { Knex } from 'knex';

const pgOpts = {
  host: 'postgres',
  port: 5432,
  user: 'moribashi',
  password: 'password',
  database: 'moribashi',
};

let app: ReturnType<typeof createApp>;

afterEach(async () => {
  await app?.stop();
});

describe('pgPlugin', () => {
  it('registers knex on the root container', async () => {
    app = createApp();
    app.use(pgPlugin(pgOpts));
    await app.start();

    const knex = app.resolve<Knex>('knex');
    expect(knex).toBeDefined();

    const result = await knex.raw('SELECT 1 AS val');
    expect(result.rows).toEqual([{ val: 1 }]);
  });

  it('registers db on the root container', async () => {
    app = createApp();
    app.use(pgPlugin(pgOpts));
    await app.start();

    const db = app.resolve<Db>('db');
    expect(db).toBeInstanceOf(Db);
  });

  it('db.query works against real Postgres', async () => {
    app = createApp();
    app.use(pgPlugin(pgOpts));
    await app.start();

    const db = app.resolve<Db>('db');
    const rows = await db.query<{ greeting: string }>(
      "SELECT 'hello ' || :name AS greeting",
      { name: 'world' },
    );
    expect(rows).toEqual([{ greeting: 'hello world' }]);
  });

  it('db.knex is the same instance as the registered knex', async () => {
    app = createApp();
    app.use(pgPlugin(pgOpts));
    await app.start();

    const knex = app.resolve<Knex>('knex');
    const db = app.resolve<Db>('db');
    expect(db.knex).toBe(knex);
  });

  it('cleans up the connection pool on app.stop() via onDestroy', async () => {
    app = createApp();
    app.use(pgPlugin(pgOpts));
    await app.start();

    const db = app.resolve<Db>('db');
    const knex = db.knex;

    await app.stop();

    // After destroy, querying should fail
    await expect(knex.raw('SELECT 1')).rejects.toThrow();
  });

  it('supports connectionString config', async () => {
    app = createApp();
    app.use(pgPlugin({ connectionString: 'postgres://moribashi:password@postgres:5432/moribashi' }));
    await app.start();

    const db = app.resolve<Db>('db');
    const rows = await db.query<{ db: string }>('SELECT current_database() AS db');
    expect(rows).toEqual([{ db: 'moribashi' }]);
  });
});
