import type { FastifyInstance } from '@moribashi/web';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

type App = Awaited<ReturnType<typeof buildApp>>;

describe('examples/simple smoke test — HTTP + GraphQL', () => {
  let app: App;
  let fastify: FastifyInstance;

  beforeAll(async () => {
    // Use port 0 so the OS assigns a free port — avoids collisions in CI
    // and with any locally-running copy of the example.
    app = await buildApp({ port: 0, host: '127.0.0.1' });
    await app.start();
    fastify = app.resolve<FastifyInstance>('fastify');
  });

  afterAll(async () => {
    await app?.stop();
  });

  it('serves GET /books with seeded authors joined in', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/books' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    // Seed data has "Norwegian Wood" by Haruki Murakami
    const norwegianWood = body.find((b: { title: string }) => b.title === 'Norwegian Wood');
    expect(norwegianWood).toBeDefined();
    expect(norwegianWood.author).toMatchObject({ name: 'Haruki Murakami' });
  });

  it('serves GET /debug with diagnostics from every moribashi package', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/debug' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      common: expect.any(Object),
      core: expect.any(Object),
      cli: expect.any(Object),
      graphql: { module: '@moribashi/graphql' },
      pg: { module: '@moribashi/pg' },
      web: { module: '@moribashi/web' },
    });
  });

  it('answers a basic GraphQL query against POST /graphql', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/graphql',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        query: '{ authors { id name } books { id title author { name } } }',
      }),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.errors).toBeUndefined();
    expect(Array.isArray(body.data.authors)).toBe(true);
    expect(Array.isArray(body.data.books)).toBe(true);
    expect(body.data.authors.length).toBeGreaterThan(0);
    expect(body.data.books.length).toBeGreaterThan(0);
    // Resolver chains books -> authorsService.findById, so author must be populated
    expect(body.data.books[0].author).toMatchObject({ name: expect.any(String) });
  });

  it('resolves services registered via app.scan() from the root container', async () => {
    const booksService = app.resolve('booksService');
    expect(booksService).toBeDefined();
    expect(typeof (booksService as { findAllWithAuthors: unknown }).findAllWithAuthors).toBe(
      'function',
    );
  });
});

describe('examples/simple smoke test — shutdown', () => {
  it('stops cleanly and a second stop() is a no-op', async () => {
    const app = await buildApp({ port: 0, host: '127.0.0.1' });
    await app.start();

    await expect(app.stop()).resolves.toBeUndefined();
    await expect(app.stop()).resolves.toBeUndefined();
  });
});
