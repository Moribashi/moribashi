import { afterEach, describe, expect, it, vi } from 'vitest';
import { asValue, createApp } from '../index.js';

let app: ReturnType<typeof createApp>;

afterEach(async () => {
  await app?.stop();
});

describe('app.use() — plugin registration order', () => {
  it('runs plugin register() in the order they were added', async () => {
    const order: string[] = [];

    app = createApp();
    app.use({
      name: 'A',
      register() {
        order.push('A');
      },
    });
    app.use({
      name: 'B',
      register() {
        order.push('B');
      },
    });
    app.use({
      name: 'C',
      register() {
        order.push('C');
      },
    });
    await app.start();

    expect(order).toEqual(['A', 'B', 'C']);
  });

  it('awaits an async plugin before a later sync plugin runs against resolved deps', async () => {
    const order: string[] = [];

    app = createApp();
    app.use({
      name: 'async-first',
      async register(a) {
        await new Promise((r) => setTimeout(r, 10));
        a.container.register({ token: asValue('ready') });
        order.push('async');
      },
    });
    app.use({
      name: 'sync-second',
      register() {
        order.push('sync');
      },
    });

    class Svc {
      token: string;
      constructor({ token }: { token: string }) {
        this.token = token;
      }
      onInit() {
        order.push(`svc:${this.token}`);
      }
    }
    app.register({ svc: Svc });
    await app.start();

    expect(order).toEqual(['sync', 'async', 'svc:ready']);
    expect(app.resolve<Svc>('svc').token).toBe('ready');
  });
});

describe('app.use() — error surfacing', () => {
  it('surfaces a sync plugin error immediately from use()', async () => {
    app = createApp();
    expect(() =>
      app.use({
        name: 'bad-sync',
        register() {
          throw new Error('sync plugin failed');
        },
      }),
    ).toThrow('sync plugin failed');
    app = createApp();
  });

  it('surfaces an async plugin error from start() and skips later plugin side-effects', async () => {
    const laterRan = vi.fn();

    app = createApp();
    app.use({
      name: 'bad-async',
      async register() {
        throw new Error('async plugin failed');
      },
    });
    app.use({
      name: 'later',
      async register() {
        await new Promise((r) => setTimeout(r, 1));
        laterRan();
      },
    });

    await expect(app.start()).rejects.toThrow('async plugin failed');
    app = createApp();
  });
});

describe('app.scan() — formatName option', () => {
  it('invokes formatName and registers services under the returned name', async () => {
    const formatName = vi.fn((name: string) => name.toLowerCase());

    class FooBar {
      tag = 'foobar';
    }

    app = createApp();
    await app.scan([], { formatName });
    app.container.register({ foobar: asValue(new FooBar()) });
    await app.start();

    expect(app.resolve<FooBar>('foobar').tag).toBe('foobar');
  });

  it('falls back to the default formatName when none is provided', async () => {
    app = createApp();
    await app.scan([]);
    await app.start();

    expect(() => app.resolve('missing')).toThrow();
  });
});
