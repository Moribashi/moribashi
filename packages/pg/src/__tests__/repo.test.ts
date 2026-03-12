import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { RepoQuery, Repo, Db, createKnex, type Knex } from '../index.js';
import { pgOpts } from './pg-config.js';

/* ------------------------------------------------------------------ */
/*  Unit tests — RepoQuery with mocked Db                            */
/* ------------------------------------------------------------------ */

describe('RepoQuery', () => {
  function createMockDb(rows: object[]) {
    return { query: vi.fn().mockResolvedValue(rows) } as unknown as Db;
  }

  function wired<E extends object>(rows: E[]) {
    const q = new RepoQuery<E>();
    q.db = createMockDb(rows);
    q.sql = 'SELECT 1';
    return q;
  }

  describe('guard checks', () => {
    it('throws when sql is missing', async () => {
      const q = new RepoQuery();
      q.db = createMockDb([]);
      await expect(q.any()).rejects.toThrow('Missing SQL');
    });

    it('throws when db is missing', async () => {
      const q = new RepoQuery();
      q.sql = 'SELECT 1';
      await expect(q.any()).rejects.toThrow('Missing DB');
    });
  });

  describe('one()', () => {
    it('returns the single row', async () => {
      const q = wired([{ id: 1 }]);
      expect(await q.one()).toEqual({ id: 1 });
    });

    it('throws when 0 rows', async () => {
      const q = wired([]);
      await expect(q.one()).rejects.toThrow('Expected exactly one row, got 0');
    });

    it('throws when >1 rows', async () => {
      const q = wired([{ id: 1 }, { id: 2 }]);
      await expect(q.one()).rejects.toThrow('Expected exactly one row, got 2');
    });
  });

  describe('any()', () => {
    it('returns empty array for 0 rows', async () => {
      const q = wired([]);
      expect(await q.any()).toEqual([]);
    });

    it('returns all rows', async () => {
      const q = wired([{ id: 1 }, { id: 2 }]);
      expect(await q.any()).toEqual([{ id: 1 }, { id: 2 }]);
    });
  });

  describe('many()', () => {
    it('returns rows when 1+', async () => {
      const q = wired([{ id: 1 }, { id: 2 }]);
      expect(await q.many()).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('throws when 0 rows', async () => {
      const q = wired([]);
      await expect(q.many()).rejects.toThrow('Expected one or more rows, got 0');
    });
  });

  describe('none()', () => {
    it('succeeds when 0 rows', async () => {
      const q = wired([]);
      await expect(q.none()).resolves.toBeUndefined();
    });

    it('throws when rows are returned', async () => {
      const q = wired([{ id: 1 }]);
      await expect(q.none()).rejects.toThrow('Expected no rows, got 1');
    });
  });

  it('passes params through to db.query', async () => {
    const mockDb = createMockDb([{ id: 1 }]);
    const q = new RepoQuery();
    q.db = mockDb;
    q.sql = 'SELECT * FROM t WHERE id = :id';
    await q.one({ id: 1 });
    expect(mockDb.query).toHaveBeenCalledWith('SELECT * FROM t WHERE id = :id', { id: 1 });
  });
});

/* ------------------------------------------------------------------ */
/*  Integration tests — Repo + autowireRepo against real Postgres     */
/* ------------------------------------------------------------------ */

describe('Repo + autowireRepo', () => {
  let knex: Knex;
  let db: Db;
  let tmpDir: string;

  interface Widget {
    id: number;
    label: string;
  }

  class WidgetRepo extends Repo {
    findAll = new RepoQuery<Widget>();
    findById = new RepoQuery<Widget>();

    constructor(db: Db, dir: string) {
      super(dir, db);
      this._autowire();
    }
  }

  beforeAll(async () => {
    knex = createKnex(pgOpts);
    db = new Db(knex);

    // Create test table + seed data
    await knex.schema.dropTableIfExists('repo_test_widgets');
    await knex.schema.createTable('repo_test_widgets', (t) => {
      t.increments('id');
      t.text('label').notNullable();
    });
    await knex('repo_test_widgets').insert([
      { label: 'alpha' },
      { label: 'beta' },
    ]);

    // Create temp dir with SQL files
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-test-'));
    const sqlDir = path.join(tmpDir, 'sql');
    await fs.mkdir(sqlDir);
    await fs.writeFile(
      path.join(sqlDir, 'findAll.sql'),
      'SELECT id, label FROM repo_test_widgets ORDER BY id',
    );
    await fs.writeFile(
      path.join(sqlDir, 'findById.sql'),
      'SELECT id, label FROM repo_test_widgets WHERE id = :id',
    );
  });

  afterAll(async () => {
    await knex.schema.dropTableIfExists('repo_test_widgets');
    await db.onDestroy();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('autowires SQL files into RepoQuery instances', () => {
    const repo = new WidgetRepo(db, tmpDir);
    expect(repo.findAll.sql).toContain('repo_test_widgets');
    expect(repo.findAll.db).toBe(db);
    expect(repo.findById.sql).toContain(':id');
    expect(repo.findById.db).toBe(db);
  });

  it('any() returns all rows', async () => {
    const repo = new WidgetRepo(db, tmpDir);
    const rows = await repo.findAll.any();
    expect(rows).toEqual([
      { id: 1, label: 'alpha' },
      { id: 2, label: 'beta' },
    ]);
  });

  it('one() returns a single row by param', async () => {
    const repo = new WidgetRepo(db, tmpDir);
    const row = await repo.findById.one({ id: 1 });
    expect(row).toEqual({ id: 1, label: 'alpha' });
  });

  it('one() throws when no matching row', async () => {
    const repo = new WidgetRepo(db, tmpDir);
    await expect(repo.findById.one({ id: 999 })).rejects.toThrow(
      'Expected exactly one row, got 0',
    );
  });

  it('many() returns rows', async () => {
    const repo = new WidgetRepo(db, tmpDir);
    const rows = await repo.findAll.many();
    expect(rows).toHaveLength(2);
  });
});
