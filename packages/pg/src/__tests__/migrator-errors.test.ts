import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createKnex, type Knex } from '../index.js';
import { type Logger, SqlMigrationSource } from '../migrator.js';
import { pgOpts } from './pg-config.js';

const log: Logger = {
  debug: () => {},
  info: () => {},
};

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moribashi-pg-'));
});

afterEach(async () => {
  await fsp.rm(tmpDir, { recursive: true, force: true });
});

describe('SqlMigrationSource error paths', () => {
  describe('getMigrations', () => {
    it('throws ENOENT when the migrations directory does not exist', async () => {
      const missing = path.join(tmpDir, 'does-not-exist');
      const source = new SqlMigrationSource(missing, log);

      await expect(source.getMigrations()).rejects.toMatchObject({
        code: 'ENOENT',
      });
    });

    it('throws ENOTDIR when the configured path is a file, not a directory', async () => {
      const filePath = path.join(tmpDir, 'not-a-dir');
      await fsp.writeFile(filePath, 'not a directory');
      const source = new SqlMigrationSource(filePath, log);

      await expect(source.getMigrations()).rejects.toMatchObject({
        code: 'ENOTDIR',
      });
    });
  });

  describe('getMigration', () => {
    it('throws ENOENT when the requested file is missing from the directory', async () => {
      const source = new SqlMigrationSource(tmpDir, log);

      await expect(source.getMigration('V1.0.0__missing.sql')).rejects.toMatchObject({
        code: 'ENOENT',
      });
    });

    it('throws ENOENT when the directory itself does not exist', async () => {
      const missing = path.join(tmpDir, 'nope');
      const source = new SqlMigrationSource(missing, log);

      await expect(source.getMigration('V1.0.0__init.sql')).rejects.toMatchObject({
        code: 'ENOENT',
      });
    });
  });
});

describe('SqlMigrationSource error propagation through knex.migrate', () => {
  // Namespace knex's bookkeeping tables so this file's tests don't race with
  // sibling integration tests that also use knex_migrations / knex_migrations_lock.
  const migrationsTable = 'knex_migrations_errors';
  const lockTable = `${migrationsTable}_lock`;
  const migrateOpts = { tableName: migrationsTable };

  let knex: Knex;

  beforeAll(() => {
    knex = createKnex(pgOpts);
  });

  afterAll(async () => {
    await knex.destroy();
  });

  beforeEach(async () => {
    await knex.raw('DROP TABLE IF EXISTS migrator_errors_test');
    await knex.raw(`DROP TABLE IF EXISTS ${migrationsTable}`);
    await knex.raw(`DROP TABLE IF EXISTS ${lockTable}`);
  });

  afterEach(async () => {
    await knex.raw('DROP TABLE IF EXISTS migrator_errors_test');
    await knex.raw(`DROP TABLE IF EXISTS ${migrationsTable}`);
    await knex.raw(`DROP TABLE IF EXISTS ${lockTable}`);
  });

  it('surfaces a pg error when a migration references a nonexistent table', async () => {
    await fsp.writeFile(
      path.join(tmpDir, 'V1.0.0__bad_reference.sql'),
      'INSERT INTO table_that_does_not_exist (id) VALUES (1);',
    );

    const source = new SqlMigrationSource(tmpDir, log);

    await expect(knex.migrate.latest({ ...migrateOpts, migrationSource: source })).rejects.toThrow(
      /table_that_does_not_exist/,
    );
  });

  it('surfaces a pg syntax error when a migration contains invalid SQL', async () => {
    await fsp.writeFile(path.join(tmpDir, 'V1.0.0__bad_syntax.sql'), 'THIS IS NOT VALID SQL;');

    const source = new SqlMigrationSource(tmpDir, log);

    await expect(
      knex.migrate.latest({ ...migrateOpts, migrationSource: source }),
    ).rejects.toThrow();
  });

  it('rolls back the failing migration so its side effects are not persisted', async () => {
    await fsp.writeFile(
      path.join(tmpDir, 'V1.0.0__partial_then_fail.sql'),
      [
        'CREATE TABLE migrator_errors_test (id int);',
        'INSERT INTO table_that_does_not_exist (id) VALUES (1);',
      ].join('\n'),
    );

    const source = new SqlMigrationSource(tmpDir, log);

    await expect(
      knex.migrate.latest({ ...migrateOpts, migrationSource: source }),
    ).rejects.toThrow();

    const exists = await knex.schema.hasTable('migrator_errors_test');
    expect(exists).toBe(false);
  });

  it('propagates ENOENT from getMigrations when migrationsDir is missing', async () => {
    const missing = path.join(tmpDir, 'no-such-dir');
    const source = new SqlMigrationSource(missing, log);

    await expect(
      knex.migrate.latest({ ...migrateOpts, migrationSource: source }),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
