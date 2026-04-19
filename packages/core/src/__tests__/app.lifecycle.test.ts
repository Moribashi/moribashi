import { afterEach, describe, expect, it, vi } from 'vitest';
import { asValue, createApp } from '../index.js';

let app: ReturnType<typeof createApp>;

afterEach(async () => {
  await app?.stop();
});

describe('app.start()', () => {
  it('eagerly resolves singletons and calls onInit in registration order', async () => {
    const order: string[] = [];

    class ServiceA {
      async onInit() {
        order.push('A');
      }
    }
    class ServiceB {
      async onInit() {
        order.push('B');
      }
    }

    app = createApp();
    app.register({ serviceA: ServiceA, serviceB: ServiceB });
    await app.start();

    expect(order).toEqual(['A', 'B']);
  });

  it('throws if started a second time', async () => {
    app = createApp();
    await app.start();
    await expect(app.start()).rejects.toThrow('App already started');
  });

  it('awaits async plugin registrations before resolving singletons', async () => {
    const order: string[] = [];

    app = createApp();
    app.use({
      name: 'async-plugin',
      async register(a) {
        await new Promise((r) => setTimeout(r, 10));
        a.container.register({ asyncVal: asValue('registered-async') });
        order.push('plugin');
      },
    });

    class Svc {
      onInit() {
        order.push('svc');
      }
    }
    app.register({ svc: Svc });
    await app.start();

    expect(order).toEqual(['plugin', 'svc']);
  });

  it('propagates async plugin registration errors', async () => {
    app = createApp();
    app.use({
      name: 'bad-plugin',
      async register() {
        throw new Error('plugin failed');
      },
    });
    await expect(app.start()).rejects.toThrow('plugin failed');
    // reset so afterEach stop() is safe
    app = createApp();
  });

  it('propagates onInit errors', async () => {
    class BoomService {
      async onInit() {
        throw new Error('init exploded');
      }
    }

    app = createApp();
    app.register({ boom: BoomService });
    await expect(app.start()).rejects.toThrow('init exploded');
    app = createApp();
  });
});

describe('app.stop()', () => {
  it('calls onDestroy in reverse initialization order', async () => {
    const order: string[] = [];

    class ServiceA {
      async onDestroy() {
        order.push('A');
      }
    }
    class ServiceB {
      async onDestroy() {
        order.push('B');
      }
    }

    app = createApp();
    app.register({ serviceA: ServiceA, serviceB: ServiceB });
    await app.start();
    await app.stop();

    expect(order).toEqual(['B', 'A']);
  });

  it('is a no-op when called before start', async () => {
    app = createApp();
    await expect(app.stop()).resolves.toBeUndefined();
  });

  it('sets started=false so the app can be stopped cleanly after errors', async () => {
    app = createApp();
    await app.start();
    await app.stop();
    // second stop should be a no-op, not throw
    await expect(app.stop()).resolves.toBeUndefined();
  });
});

describe('app.resolve()', () => {
  it('resolves a registered value after start', async () => {
    app = createApp();
    app.container.register({ greeting: asValue('hello') });
    await app.start();
    expect(app.resolve('greeting')).toBe('hello');
  });
});

describe('onInit + onDestroy symmetry', () => {
  it('only destroys services that were initialized', async () => {
    const destroyed = vi.fn();

    class ServiceA {
      async onInit() {}
      async onDestroy() {
        destroyed();
      }
    }

    app = createApp();
    app.register({ serviceA: ServiceA });
    await app.start();
    await app.stop();

    expect(destroyed).toHaveBeenCalledOnce();
  });
});
