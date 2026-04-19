import { createApp } from '@moribashi/core';
import { afterEach, describe, expect, it } from 'vitest';
import { scopeContext } from '../index.js';

let app: ReturnType<typeof createApp>;

afterEach(async () => {
  await app?.stop();
});

const GQL_SCOPE = Symbol.for('moribashi.scope.test.scope-context');

describe('scopeContext()', () => {
  it('returns a context object exposing the request scope under `scope`', async () => {
    app = createApp();
    await app.start();

    const scope = app.createScope();
    const context = await scopeContext({ scope });

    expect(context).toEqual({ scope });
    expect(context.scope).toBe(scope);

    await scope.dispose();
  });

  it('threads distinct scope instances per request', async () => {
    app = createApp();
    await app.start();

    const scopeA = app.createScope();
    const scopeB = app.createScope();

    const ctxA = await scopeContext({ scope: scopeA });
    const ctxB = await scopeContext({ scope: scopeB });

    expect(ctxA.scope).toBe(scopeA);
    expect(ctxB.scope).toBe(scopeB);
    expect(ctxA.scope).not.toBe(ctxB.scope);

    await scopeA.dispose();
    await scopeB.dispose();
  });

  it('resolves scoped services via the produced context cradle', async () => {
    class Greeter {
      hello() {
        return 'hi';
      }
    }

    app = createApp();
    app.registerInScope(GQL_SCOPE, { greeter: Greeter });
    await app.start();

    const scope = app.createScope<{ greeter: Greeter }>(GQL_SCOPE);
    const context = await scopeContext({ scope });

    expect(context.scope.resolve<Greeter>('greeter').hello()).toBe('hi');

    await scope.dispose();
  });

  it('allows the scope it returned to be disposed via its normal lifecycle', async () => {
    let destroyed = false;

    class ScopedSvc {
      async onDestroy() {
        destroyed = true;
      }
    }

    app = createApp();
    app.registerInScope(GQL_SCOPE, { scopedSvc: ScopedSvc });
    await app.start();

    const scope = app.createScope(GQL_SCOPE);
    const context = await scopeContext({ scope });
    context.scope.resolve('scopedSvc');

    await context.scope.dispose();
    expect(destroyed).toBe(true);
  });

  it('throws when the request has no scope (web plugin not registered)', async () => {
    await expect(scopeContext({})).rejects.toThrow(
      '@moribashi/graphql requires @moribashi/web to be registered first',
    );
  });

  it('throws when the request scope is explicitly undefined', async () => {
    await expect(scopeContext({ scope: undefined })).rejects.toThrow(
      '@moribashi/graphql requires @moribashi/web to be registered first',
    );
  });
});
