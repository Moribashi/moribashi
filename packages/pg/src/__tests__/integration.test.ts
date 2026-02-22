import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createKnex, type Knex } from '../index.js';
import { pgOpts, connectionString } from './pg-config.js';

let knex: Knex;

beforeAll(async () => {
  knex = createKnex(pgOpts);
});

afterAll(async () => {
  await knex.destroy();
});

describe('integration: createKnex against real Postgres', () => {
  it('connects and runs a raw query', async () => {
    const result = await knex.raw('SELECT 1 AS val');
    expect(result.rows).toEqual([{ val: 1 }]);
  });

  it('reports the correct server version', async () => {
    const result = await knex.raw('SHOW server_version');
    expect(result.rows[0].server_version).toBeDefined();
  });

  it('can create, insert, query, and drop a table', async () => {
    await knex.schema.createTable('integration_test', (t) => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.integer('value');
    });

    try {
      await knex('integration_test').insert([
        { name: 'alpha', value: 1 },
        { name: 'beta', value: 2 },
        { name: 'gamma', value: 3 },
      ]);

      const rows = await knex('integration_test').select('*').orderBy('id');
      expect(rows).toHaveLength(3);
      expect(rows[0]).toMatchObject({ name: 'alpha', value: 1 });
      expect(rows[1]).toMatchObject({ name: 'beta', value: 2 });
      expect(rows[2]).toMatchObject({ name: 'gamma', value: 3 });
    } finally {
      await knex.schema.dropTableIfExists('integration_test');
    }
  });

  it('supports transactions with commit', async () => {
    await knex.schema.createTable('txn_test', (t) => {
      t.increments('id').primary();
      t.string('label').notNullable();
    });

    try {
      await knex.transaction(async (trx) => {
        await trx('txn_test').insert({ label: 'committed' });
      });

      const rows = await knex('txn_test').select('*');
      expect(rows).toHaveLength(1);
      expect(rows[0].label).toBe('committed');
    } finally {
      await knex.schema.dropTableIfExists('txn_test');
    }
  });

  it('supports transactions with rollback', async () => {
    await knex.schema.createTable('txn_rollback_test', (t) => {
      t.increments('id').primary();
      t.string('label').notNullable();
    });

    try {
      await expect(
        knex.transaction(async (trx) => {
          await trx('txn_rollback_test').insert({ label: 'will_rollback' });
          throw new Error('intentional rollback');
        }),
      ).rejects.toThrow('intentional rollback');

      const rows = await knex('txn_rollback_test').select('*');
      expect(rows).toHaveLength(0);
    } finally {
      await knex.schema.dropTableIfExists('txn_rollback_test');
    }
  });

  it('handles parameterized queries', async () => {
    const result = await knex.raw('SELECT ?::int + ?::int AS sum', [10, 20]);
    expect(result.rows[0].sum).toBe(30);
  });

  it('supports where clauses and updates', async () => {
    await knex.schema.createTable('update_test', (t) => {
      t.increments('id').primary();
      t.string('status').notNullable();
    });

    try {
      await knex('update_test').insert([
        { status: 'pending' },
        { status: 'pending' },
        { status: 'done' },
      ]);

      const updated = await knex('update_test')
        .where('status', 'pending')
        .update({ status: 'complete' });
      expect(updated).toBe(2);

      const rows = await knex('update_test').select('*').orderBy('id');
      expect(rows[0].status).toBe('complete');
      expect(rows[1].status).toBe('complete');
      expect(rows[2].status).toBe('done');
    } finally {
      await knex.schema.dropTableIfExists('update_test');
    }
  });

  it('supports deletes', async () => {
    await knex.schema.createTable('delete_test', (t) => {
      t.increments('id').primary();
      t.string('name').notNullable();
    });

    try {
      await knex('delete_test').insert([{ name: 'keep' }, { name: 'remove' }]);
      const deleted = await knex('delete_test').where('name', 'remove').del();
      expect(deleted).toBe(1);

      const rows = await knex('delete_test').select('*');
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('keep');
    } finally {
      await knex.schema.dropTableIfExists('delete_test');
    }
  });

  it('supports connectionString config', async () => {
    const k = createKnex({ connectionString });
    try {
      const result = await k.raw('SELECT current_database() AS db');
      expect(result.rows[0].db).toBe('moribashi');
    } finally {
      await k.destroy();
    }
  });
});
