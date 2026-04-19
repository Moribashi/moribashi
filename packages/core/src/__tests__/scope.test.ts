import { afterEach, describe, expect, it, vi } from 'vitest';
import { asValue, createApp } from '../index.js';

let app: ReturnType<typeof createApp>;

afterEach(async () => {
  await app?.stop();
});

const MY_SCOPE = Symbol.for('moribashi.scope.test');

describe('createScope()', () => {
  it('creates an isolated child scope', async () => {
    app = createApp();
    app.container.register({ rootVal: asValue('root') });
    await app.start();

    const scope = app.createScope();
    expect(scope.resolve('rootVal')).toBe('root');
    await scope.dispose();
  });

  it('applies registerInScope registrations when key matches', async () => {
    class ScopedSvc {
      greet() {
        return 'scoped';
      }
    }

    app = createApp();
    app.registerInScope(MY_SCOPE, { scopedSvc: ScopedSvc });
    await app.start();

    const scope = app.createScope(MY_SCOPE);
    const svc = scope.resolve<ScopedSvc>('scopedSvc');
    expect(svc.greet()).toBe('scoped');
    await scope.dispose();
  });

  it('does not apply scope registrations when key does not match', async () => {
    class ScopedSvc {}

    app = createApp();
    app.registerInScope(MY_SCOPE, { scopedSvc: ScopedSvc });
    await app.start();

    const OTHER = Symbol.for('moribashi.scope.other');
    const scope = app.createScope(OTHER);
    expect(() => scope.resolve('scopedSvc')).toThrow();
    await scope.dispose();
  });

  it('scoped services use SCOPED lifetime, not SINGLETON', async () => {
    class Counter {
      value = Math.random();
    }

    app = createApp();
    app.registerInScope(MY_SCOPE, { counter: Counter });
    await app.start();

    const scopeA = app.createScope(MY_SCOPE);
    const scopeB = app.createScope(MY_SCOPE);

    // Each scope gets its own instance
    expect(scopeA.resolve<Counter>('counter').value).not.toBe(
      scopeB.resolve<Counter>('counter').value,
    );

    await scopeA.dispose();
    await scopeB.dispose();
  });
});

describe('scope.register()', () => {
  it('registers additional services into the scope at runtime', async () => {
    class Extra {
      tag = 'extra';
    }

    app = createApp();
    await app.start();

    const scope = app.createScope();
    scope.register({ extra: Extra });
    expect(scope.resolve<Extra>('extra').tag).toBe('extra');
    await scope.dispose();
  });
});

describe('scope.dispose()', () => {
  it('calls onDestroy on resolved scoped services', async () => {
    const destroyed = vi.fn();

    class ScopedSvc {
      async onDestroy() {
        destroyed();
      }
    }

    app = createApp();
    app.registerInScope(MY_SCOPE, { scopedSvc: ScopedSvc });
    await app.start();

    const scope = app.createScope(MY_SCOPE);
    scope.resolve('scopedSvc'); // must resolve to populate cache
    await scope.dispose();

    expect(destroyed).toHaveBeenCalledOnce();
  });

  it('does not call onDestroy on unresolved scoped services', async () => {
    const destroyed = vi.fn();

    class ScopedSvc {
      async onDestroy() {
        destroyed();
      }
    }

    app = createApp();
    app.registerInScope(MY_SCOPE, { scopedSvc: ScopedSvc });
    await app.start();

    const scope = app.createScope(MY_SCOPE);
    // never resolved — nothing in cache
    await scope.dispose();

    expect(destroyed).not.toHaveBeenCalled();
  });

  it('removes scope from active scopes so app.stop() skips it', async () => {
    const destroyed = vi.fn();

    class ScopedSvc {
      async onDestroy() {
        destroyed();
      }
    }

    app = createApp();
    app.registerInScope(MY_SCOPE, { scopedSvc: ScopedSvc });
    await app.start();

    const scope = app.createScope(MY_SCOPE);
    scope.resolve('scopedSvc');
    await scope.dispose();

    expect(destroyed).toHaveBeenCalledOnce();
    destroyed.mockClear();

    // app.stop() should not dispose the already-disposed scope again
    await app.stop();
    expect(destroyed).not.toHaveBeenCalled();
  });
});

describe('app.stop() with active scopes', () => {
  it('disposes open scopes before root service onDestroy', async () => {
    const order: string[] = [];

    class ScopedSvc {
      async onDestroy() {
        order.push('scoped');
      }
    }
    class RootSvc {
      async onDestroy() {
        order.push('root');
      }
    }

    app = createApp();
    app.register({ rootSvc: RootSvc });
    app.registerInScope(MY_SCOPE, { scopedSvc: ScopedSvc });
    await app.start();

    const scope = app.createScope(MY_SCOPE);
    scope.resolve('scopedSvc');

    await app.stop();
    expect(order).toEqual(['scoped', 'root']);
  });
});

describe('scope.cradle', () => {
  it('exposes resolved services via proxy property access', async () => {
    class Greeter {
      hello() {
        return 'hi';
      }
    }

    app = createApp();
    app.registerInScope(MY_SCOPE, { greeter: Greeter });
    await app.start();

    const scope = app.createScope<{ greeter: Greeter }>(MY_SCOPE);
    expect(scope.cradle.greeter.hello()).toBe('hi');
    await scope.dispose();
  });
});

describe('registerInScope — multiple keys', () => {
  it('keeps registrations isolated per symbol key', async () => {
    const KEY_A = Symbol.for('moribashi.scope.a');
    const KEY_B = Symbol.for('moribashi.scope.b');

    class SvcA {
      tag = 'a';
    }
    class SvcB {
      tag = 'b';
    }

    app = createApp();
    app.registerInScope(KEY_A, { svcA: SvcA });
    app.registerInScope(KEY_B, { svcB: SvcB });
    await app.start();

    const scopeA = app.createScope(KEY_A);
    const scopeB = app.createScope(KEY_B);

    expect(scopeA.resolve<SvcA>('svcA').tag).toBe('a');
    expect(() => scopeA.resolve('svcB')).toThrow();

    expect(scopeB.resolve<SvcB>('svcB').tag).toBe('b');
    expect(() => scopeB.resolve('svcA')).toThrow();

    await scopeA.dispose();
    await scopeB.dispose();
  });
});
