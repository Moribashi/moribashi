import { createApp } from '@moribashi/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindResolvers } from '../index.js';

let app: ReturnType<typeof createApp>;

afterEach(async () => {
  await app?.stop();
});

const GQL_SCOPE = Symbol.for('moribashi.scope.test.graphql');

describe('bindResolvers()', () => {
  it('binds `this` inside resolvers to the scope cradle', async () => {
    class Greeter {
      hello() {
        return 'hi from greeter';
      }
    }

    type Cradle = { greeter: Greeter };

    const resolvers = {
      Query: {
        hello(this: Cradle) {
          return this.greeter.hello();
        },
      },
    };

    app = createApp();
    app.registerInScope(GQL_SCOPE, { greeter: Greeter });
    await app.start();

    const scope = app.createScope<Cradle>(GQL_SCOPE);
    const wrapped = bindResolvers<Cradle>(resolvers);

    const result = wrapped.Query!.hello!(null, {}, { scope }, {});
    expect(result).toBe('hi from greeter');

    await scope.dispose();
  });

  it('does not instantiate scoped services until the resolver reads them', async () => {
    const ctor = vi.fn();

    class Greeter {
      constructor() {
        ctor();
      }
      hello() {
        return 'lazy hi';
      }
    }

    type Cradle = { greeter: Greeter };

    const resolvers = {
      Query: {
        untouched() {
          return 'constant';
        },
        greet(this: Cradle) {
          return this.greeter.hello();
        },
      },
    };

    app = createApp();
    app.registerInScope(GQL_SCOPE, { greeter: Greeter });
    await app.start();

    const scope = app.createScope<Cradle>(GQL_SCOPE);
    const wrapped = bindResolvers<Cradle>(resolvers);

    expect(ctor).not.toHaveBeenCalled();

    const untouched = wrapped.Query!.untouched!(null, {}, { scope }, {});
    expect(untouched).toBe('constant');
    expect(ctor).not.toHaveBeenCalled();

    const greeting = wrapped.Query!.greet!(null, {}, { scope }, {});
    expect(greeting).toBe('lazy hi');
    expect(ctor).toHaveBeenCalledOnce();

    await scope.dispose();
  });

  it('wraps multiple resolvers on the same type', async () => {
    class Svc {
      a() {
        return 'A';
      }
      b() {
        return 'B';
      }
    }

    type Cradle = { svc: Svc };

    const resolvers = {
      Query: {
        first(this: Cradle) {
          return this.svc.a();
        },
        second(this: Cradle) {
          return this.svc.b();
        },
      },
    };

    app = createApp();
    app.registerInScope(GQL_SCOPE, { svc: Svc });
    await app.start();

    const scope = app.createScope<Cradle>(GQL_SCOPE);
    const wrapped = bindResolvers<Cradle>(resolvers);

    expect(wrapped.Query!.first!(null, {}, { scope }, {})).toBe('A');
    expect(wrapped.Query!.second!(null, {}, { scope }, {})).toBe('B');

    await scope.dispose();
  });

  it('wraps resolvers across nested type maps (Query and Mutation)', async () => {
    class Books {
      list() {
        return ['a', 'b'];
      }
      add(title: string) {
        return `added:${title}`;
      }
    }

    type Cradle = { books: Books };

    const resolvers = {
      Query: {
        books(this: Cradle) {
          return this.books.list();
        },
      },
      Mutation: {
        addBook(this: Cradle, _parent: any, args: { title: string }) {
          return this.books.add(args.title);
        },
      },
    };

    app = createApp();
    app.registerInScope(GQL_SCOPE, { books: Books });
    await app.start();

    const scope = app.createScope<Cradle>(GQL_SCOPE);
    const wrapped = bindResolvers<Cradle>(resolvers);

    expect(Object.keys(wrapped)).toEqual(['Query', 'Mutation']);
    expect(typeof wrapped.Query!.books).toBe('function');
    expect(typeof wrapped.Mutation!.addBook).toBe('function');

    expect(wrapped.Query!.books!(null, {}, { scope }, {})).toEqual(['a', 'b']);
    expect(wrapped.Mutation!.addBook!(null, { title: 'x' }, { scope }, {})).toBe('added:x');

    await scope.dispose();
  });

  it('forwards parent, args, context and info to the underlying resolver', async () => {
    const seen = vi.fn();

    class Svc {
      tag = 'svc';
    }

    type Cradle = { svc: Svc };

    const resolvers = {
      Query: {
        echo(this: Cradle, parent: any, args: any, context: any, info: any) {
          seen({ self: this, parent, args, context, info });
          return this.svc.tag;
        },
      },
    };

    app = createApp();
    app.registerInScope(GQL_SCOPE, { svc: Svc });
    await app.start();

    const scope = app.createScope<Cradle>(GQL_SCOPE);
    const wrapped = bindResolvers<Cradle>(resolvers);

    const parent = { p: 1 };
    const args = { a: 2 };
    const context = { scope, extra: 'c' };
    const info = { i: 3 };

    const out = wrapped.Query!.echo!(parent, args, context, info);
    expect(out).toBe('svc');

    const call = seen.mock.calls[0]![0];
    expect(call.parent).toBe(parent);
    expect(call.args).toBe(args);
    expect(call.context).toBe(context);
    expect(call.info).toBe(info);
    expect(call.self).toBe(scope.cradle);

    await scope.dispose();
  });
});
