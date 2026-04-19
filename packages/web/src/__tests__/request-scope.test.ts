import { createApp, type MoribashiApp } from '@moribashi/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from '../index.js';
import { WEB_REQUEST_SCOPE, webPlugin } from '../index.js';

let app: ReturnType<typeof createApp>;

afterEach(async () => {
  await app?.stop();
});

function routesPlugin(register: (fastify: FastifyInstance) => void) {
  return {
    name: 'test-routes',
    register(a: MoribashiApp) {
      const fastify = a.resolve<FastifyInstance>('fastify');
      register(fastify);
    },
  };
}

describe('WEB_REQUEST_SCOPE — per-request isolation', () => {
  it('gives each incoming request its own scoped service instance', async () => {
    class Counter {
      id = Math.random();
    }

    const seen: number[] = [];

    app = createApp();
    app.use(webPlugin({ port: 0, host: '127.0.0.1' }));
    app.use(
      routesPlugin((fastify) => {
        fastify.get('/ping', async (request) => {
          seen.push(request.scope.resolve<Counter>('counter').id);
          return { ok: true };
        });
      }),
    );
    app.registerInScope(WEB_REQUEST_SCOPE, { counter: Counter });
    await app.start();

    const fastify = app.resolve<FastifyInstance>('fastify');
    const r1 = await fastify.inject({ method: 'GET', url: '/ping' });
    const r2 = await fastify.inject({ method: 'GET', url: '/ping' });

    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(seen).toHaveLength(2);
    expect(seen[0]).not.toBe(seen[1]);
  });
});

describe('WEB_REQUEST_SCOPE — disposal on response', () => {
  it('fires onDestroy on scoped services after a successful response', async () => {
    const destroyed = vi.fn();

    class ScopedSvc {
      async onDestroy() {
        destroyed();
      }
    }

    app = createApp();
    app.use(webPlugin({ port: 0, host: '127.0.0.1' }));
    app.use(
      routesPlugin((fastify) => {
        fastify.get('/hello', async (request) => {
          request.scope.resolve('scopedSvc');
          return { ok: true };
        });
      }),
    );
    app.registerInScope(WEB_REQUEST_SCOPE, { scopedSvc: ScopedSvc });
    await app.start();

    const fastify = app.resolve<FastifyInstance>('fastify');
    const res = await fastify.inject({ method: 'GET', url: '/hello' });
    expect(res.statusCode).toBe(200);
    expect(destroyed).toHaveBeenCalledOnce();
  });

  it('does not fire onDestroy on scoped services that were never resolved', async () => {
    const destroyed = vi.fn();

    class ScopedSvc {
      async onDestroy() {
        destroyed();
      }
    }

    app = createApp();
    app.use(webPlugin({ port: 0, host: '127.0.0.1' }));
    app.use(
      routesPlugin((fastify) => {
        fastify.get('/noop', async () => ({ ok: true }));
      }),
    );
    app.registerInScope(WEB_REQUEST_SCOPE, { scopedSvc: ScopedSvc });
    await app.start();

    const fastify = app.resolve<FastifyInstance>('fastify');
    const res = await fastify.inject({ method: 'GET', url: '/noop' });
    expect(res.statusCode).toBe(200);
    expect(destroyed).not.toHaveBeenCalled();
  });
});

describe('WEB_REQUEST_SCOPE — disposal on request abort', () => {
  // TODO: fastify's `onRequestAbort` hook only fires on real client disconnects
  // mid-request. It cannot be triggered reliably via `fastify.inject()` (which
  // fully buffers the request), so we rely on the onResponse path for cache
  // disposal coverage and leave abort-path testing for an integration suite.
  it.todo('disposes the request scope when the client aborts mid-request');
});

describe('WEB_REQUEST_SCOPE — concurrent requests', () => {
  it('resolves independent scope instances for concurrent requests', async () => {
    class Counter {
      id = Math.random();
    }

    app = createApp();
    app.use(webPlugin({ port: 0, host: '127.0.0.1' }));
    app.use(
      routesPlugin((fastify) => {
        fastify.get('/id', async (request) => {
          await new Promise((r) => setTimeout(r, 5));
          return { id: request.scope.resolve<Counter>('counter').id };
        });
      }),
    );
    app.registerInScope(WEB_REQUEST_SCOPE, { counter: Counter });
    await app.start();

    const fastify = app.resolve<FastifyInstance>('fastify');
    const [r1, r2] = await Promise.all([
      fastify.inject({ method: 'GET', url: '/id' }),
      fastify.inject({ method: 'GET', url: '/id' }),
    ]);

    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    const id1 = r1.json<{ id: number }>().id;
    const id2 = r2.json<{ id: number }>().id;
    expect(id1).not.toBe(id2);
  });
});
