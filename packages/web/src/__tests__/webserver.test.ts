import { createApp } from '@moribashi/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from '../index.js';
import { webPlugin } from '../index.js';

let app: ReturnType<typeof createApp>;

afterEach(async () => {
  await app?.stop();
});

describe('webPlugin() — start lifecycle', () => {
  it('causes the fastify server to listen after app.start()', async () => {
    app = createApp();
    app.use(webPlugin({ port: 0, host: '127.0.0.1' }));
    await app.start();

    const fastify = app.resolve<FastifyInstance>('fastify');
    const address = fastify.server.address();
    expect(address).not.toBeNull();
    expect(typeof address).toBe('object');
    if (address && typeof address === 'object') {
      expect(address.port).toBeGreaterThan(0);
    }
  });

  it('registers fastify, webConfig, and webServer in the root container', async () => {
    app = createApp();
    app.use(webPlugin({ port: 0, host: '127.0.0.1' }));
    await app.start();

    expect(app.resolve('fastify')).toBeDefined();
    expect(app.resolve('webConfig')).toEqual({ port: 0, host: '127.0.0.1' });
    expect(app.resolve('webServer')).toBeDefined();
  });

  it('uses default port/host when no options are supplied', async () => {
    app = createApp();
    app.use(webPlugin({ port: 0 }));
    await app.start();

    const webConfig = app.resolve<{ port: number; host: string }>('webConfig');
    expect(webConfig.host).toBe('0.0.0.0');
  });
});

describe('webPlugin() — stop lifecycle', () => {
  it('closes the server cleanly on app.stop()', async () => {
    app = createApp();
    app.use(webPlugin({ port: 0, host: '127.0.0.1' }));
    await app.start();

    const fastify = app.resolve<FastifyInstance>('fastify');
    expect(fastify.server.listening).toBe(true);

    await app.stop();
    expect(fastify.server.listening).toBe(false);

    app = createApp();
  });

  it('invokes fastify.close() during stop', async () => {
    app = createApp();
    app.use(webPlugin({ port: 0, host: '127.0.0.1' }));
    await app.start();

    const fastify = app.resolve<FastifyInstance>('fastify');
    const closeSpy = vi.spyOn(fastify, 'close');

    await app.stop();
    expect(closeSpy).toHaveBeenCalledOnce();

    app = createApp();
  });
});

describe('webPlugin() — onInit / onDestroy symmetry', () => {
  it('listens during start and closes during stop', async () => {
    app = createApp();
    app.use(webPlugin({ port: 0, host: '127.0.0.1' }));

    await app.start();
    const fastify = app.resolve<FastifyInstance>('fastify');
    expect(fastify.server.listening).toBe(true);

    await app.stop();
    expect(fastify.server.listening).toBe(false);

    app = createApp();
  });
});
