import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { SqlMigrationSource, type Logger } from '../migrator.js';

let tmpDir: string;
const log: Logger = {
  debug: () => {},
  info: () => {},
};

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pg-migrator-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function writeFile(name: string, content = 'SELECT 1;') {
  await fs.writeFile(path.join(tmpDir, name), content);
}

describe('SqlMigrationSource', () => {
  describe('getMigrations', () => {
    it('returns only V-prefixed .sql files', async () => {
      await writeFile('V1.0.0__init.sql');
      await writeFile('V1.1.0__add_users.sql');
      await writeFile('README.md');
      await writeFile('seed.sql');
      await writeFile('.gitkeep');

      const source = new SqlMigrationSource(tmpDir, log);
      const migrations = await source.getMigrations();

      expect(migrations).toEqual([
        'V1.0.0__init.sql',
        'V1.1.0__add_users.sql',
      ]);
    });

    it('sorts by semver version', async () => {
      await writeFile('V2.0.0__big_change.sql');
      await writeFile('V1.0.0__init.sql');
      await writeFile('V1.2.0__feature.sql');
      await writeFile('V1.0.1__bugfix.sql');

      const source = new SqlMigrationSource(tmpDir, log);
      const migrations = await source.getMigrations();

      expect(migrations).toEqual([
        'V1.0.0__init.sql',
        'V1.0.1__bugfix.sql',
        'V1.2.0__feature.sql',
        'V2.0.0__big_change.sql',
      ]);
    });

    it('handles two-part versions', async () => {
      await writeFile('V1.1__first.sql');
      await writeFile('V1.0__init.sql');
      await writeFile('V2.0__next.sql');

      const source = new SqlMigrationSource(tmpDir, log);
      const migrations = await source.getMigrations();

      expect(migrations).toEqual([
        'V1.0__init.sql',
        'V1.1__first.sql',
        'V2.0__next.sql',
      ]);
    });

    it('handles single-part versions', async () => {
      await writeFile('V3__third.sql');
      await writeFile('V1__first.sql');
      await writeFile('V2__second.sql');

      const source = new SqlMigrationSource(tmpDir, log);
      const migrations = await source.getMigrations();

      expect(migrations).toEqual([
        'V1__first.sql',
        'V2__second.sql',
        'V3__third.sql',
      ]);
    });

    it('returns empty array when no migrations exist', async () => {
      const source = new SqlMigrationSource(tmpDir, log);
      const migrations = await source.getMigrations();

      expect(migrations).toEqual([]);
    });

    it('returns empty array when only non-versioned sql files exist', async () => {
      await writeFile('seed.sql');
      await writeFile('R__repeatable.sql');

      const source = new SqlMigrationSource(tmpDir, log);
      const migrations = await source.getMigrations();

      expect(migrations).toEqual([]);
    });
  });

  describe('getMigrationName', () => {
    it('returns the filename as-is', () => {
      const source = new SqlMigrationSource(tmpDir, log);
      expect(source.getMigrationName('V1.0.0__init.sql')).toBe('V1.0.0__init.sql');
    });
  });

  describe('getMigration', () => {
    it('returns an object with up and down functions', async () => {
      await writeFile('V1.0.0__init.sql', 'CREATE TABLE test (id int);');

      const source = new SqlMigrationSource(tmpDir, log);
      const migration = await source.getMigration('V1.0.0__init.sql');

      expect(migration).toHaveProperty('up');
      expect(migration).toHaveProperty('down');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('up runs the SQL inside a transaction', async () => {
      await writeFile('V1.0.0__init.sql', 'CREATE TABLE test (id int);');

      const source = new SqlMigrationSource(tmpDir, log);
      const migration = await source.getMigration('V1.0.0__init.sql');

      const rawResult = { rows: [] };
      const trx = { raw: (sql: string) => { trx._sql = sql; return rawResult; }, _sql: '' };
      const knex = { transaction: (fn: (trx: unknown) => unknown) => fn(trx) } as any;

      const result = await migration.up(knex);
      expect(trx._sql).toBe('CREATE TABLE test (id int);');
      expect(result).toBe(rawResult);
    });

    it('down throws an error', async () => {
      await writeFile('V1.0.0__init.sql', 'SELECT 1;');

      const source = new SqlMigrationSource(tmpDir, log);
      const migration = await source.getMigration('V1.0.0__init.sql');

      await expect(migration.down!(null as any)).rejects.toThrow(
        'Down migration not supported for V1.0.0__init.sql',
      );
    });
  });
});
