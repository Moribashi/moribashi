import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

// Mock knex — we don't want real pg connections
const mockDestroy = vi.fn().mockResolvedValue(undefined);
const mockMigrateLatest = vi.fn().mockResolvedValue([1, ['V1.0.0__init.sql']]);

vi.mock('knex', () => ({
  default: vi.fn(() => ({
    destroy: mockDestroy,
    migrate: { latest: mockMigrateLatest },
  })),
}));

// Mock fs for migration source
vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return {
    ...actual,
    default: {
      ...actual,
      readdir: vi.fn().mockResolvedValue(['V1.0.0__init.sql']),
      readFile: vi.fn().mockResolvedValue('CREATE TABLE test (id int);'),
    },
  };
});

import { fastifyKnex } from '../knex.fastify.js';

let app: FastifyInstance;

beforeEach(() => {
  app = Fastify();
  mockDestroy.mockClear();
  mockMigrateLatest.mockClear();
});

afterEach(async () => {
  await app.close();
});

describe('fastifyKnex plugin', () => {
  it('decorates fastify with knex under default id', async () => {
    await app.register(fastifyKnex, { connectionString: 'postgres://localhost/test' });
    await app.ready();

    expect(app.hasDecorator('knex')).toBe(true);
  });

  it('decorates fastify with custom decorator id', async () => {
    await app.register(fastifyKnex, {
      connectionString: 'postgres://localhost/test',
      decoratorId: 'db',
    });
    await app.ready();

    expect(app.hasDecorator('db')).toBe(true);
  });

  it('destroys knex on server close', async () => {
    await app.register(fastifyKnex, { connectionString: 'postgres://localhost/test' });
    await app.ready();
    await app.close();

    expect(mockDestroy).toHaveBeenCalledOnce();
  });

  it('runs migrations on ready when migrationsDir is set', async () => {
    await app.register(fastifyKnex, {
      connectionString: 'postgres://localhost/test',
      migrationsDir: '/fake/migrations',
    });
    await app.ready();

    expect(mockMigrateLatest).toHaveBeenCalledOnce();
  });

  it('does not run migrations when migrationsDir is not set', async () => {
    await app.register(fastifyKnex, { connectionString: 'postgres://localhost/test' });
    await app.ready();

    expect(mockMigrateLatest).not.toHaveBeenCalled();
  });
});
