import { describe, it, expect, vi, afterEach } from 'vitest';
import { createKnex, type PgConfig } from '../knex.js';

// Mock the knex module — we don't want real pg connections
vi.mock('knex', () => ({
  default: vi.fn((config: unknown) => ({ __knexConfig: config, destroy: vi.fn() })),
}));

import knex from 'knex';
const knexMock = vi.mocked(knex);

afterEach(() => {
  knexMock.mockClear();
});

describe('createKnex', () => {
  it('uses connectionString when provided', () => {
    const config: PgConfig = { connectionString: 'postgres://u:p@host:1234/db' };
    createKnex(config);

    expect(knexMock).toHaveBeenCalledOnce();
    const call = knexMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.client).toBe('pg');
    expect(call.connection).toBe('postgres://u:p@host:1234/db');
  });

  it('builds connection object from individual params', () => {
    const config: PgConfig = {
      host: 'myhost',
      port: 9999,
      user: 'admin',
      password: 'secret',
      database: 'mydb',
    };
    createKnex(config);

    const call = knexMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.connection).toEqual({
      host: 'myhost',
      port: 9999,
      user: 'admin',
      password: 'secret',
      database: 'mydb',
    });
  });

  it('uses defaults for omitted individual params', () => {
    createKnex({});

    const call = knexMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.connection).toEqual({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: '',
      database: 'postgres',
    });
  });

  it('passes pool config through', () => {
    createKnex({ pool: { min: 1, max: 5 } });

    const call = knexMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.pool).toEqual({ min: 1, max: 5 });
  });

  it('uses default pool when not specified', () => {
    createKnex({});

    const call = knexMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.pool).toEqual({ min: 2, max: 10 });
  });

  it('passes debug flag', () => {
    createKnex({ debug: true });

    const call = knexMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.debug).toBe(true);
  });

  it('defaults debug to false', () => {
    createKnex({});

    const call = knexMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.debug).toBe(false);
  });

  it('passes searchPath through', () => {
    createKnex({ searchPath: ['public', 'app'] });

    const call = knexMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.searchPath).toEqual(['public', 'app']);
  });

  it('connectionString takes precedence over individual params', () => {
    createKnex({
      connectionString: 'postgres://override:pw@h:5/d',
      host: 'ignored',
      port: 1111,
    });

    const call = knexMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.connection).toBe('postgres://override:pw@h:5/d');
  });
});
