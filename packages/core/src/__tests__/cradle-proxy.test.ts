import { afterEach, describe, expect, it } from 'vitest';
import { asValue, createApp } from '../index.js';

let app: ReturnType<typeof createApp>;

afterEach(async () => {
  await app?.stop();
});

describe('container strict mode (PROXY injection)', () => {
  it('resolves a registered value', async () => {
    app = createApp();
    app.container.register({ answer: asValue(42) });
    await app.start();

    expect(app.resolve('answer')).toBe(42);
  });

  it('throws when resolving an unregistered name', async () => {
    app = createApp();
    await app.start();

    expect(() => app.resolve('doesNotExist')).toThrow();
  });

  it('cradle property access resolves a registered service', async () => {
    class Greeter {
      greet() {
        return 'hello';
      }
    }

    app = createApp();
    app.register({ greeter: Greeter });
    await app.start();

    const cradle = app.container.cradle as { greeter: Greeter };
    expect(cradle.greeter.greet()).toBe('hello');
  });

  it('constructor injection receives dependencies via cradle proxy', async () => {
    class Config {
      value = 'injected';
    }
    class Consumer {
      config: Config;
      constructor({ config }: { config: Config }) {
        this.config = config;
      }
    }

    app = createApp();
    app.register({ config: Config, consumer: Consumer });
    await app.start();

    const consumer = app.resolve<Consumer>('consumer');
    expect(consumer.config.value).toBe('injected');
  });

  it('singletons are resolved to the same instance', async () => {
    class SharedSvc {}

    app = createApp();
    app.register({ shared: SharedSvc });
    await app.start();

    expect(app.resolve('shared')).toBe(app.resolve('shared'));
  });
});

describe('scope strict mode', () => {
  it('throws on unregistered key in a scope', async () => {
    app = createApp();
    await app.start();

    const scope = app.createScope();
    expect(() => scope.resolve('missing')).toThrow();
    await scope.dispose();
  });

  it('scope can resolve services from the root container', async () => {
    class RootSvc {
      tag = 'root';
    }

    app = createApp();
    app.register({ rootSvc: RootSvc });
    await app.start();

    const scope = app.createScope();
    expect(scope.resolve<RootSvc>('rootSvc').tag).toBe('root');
    await scope.dispose();
  });
});
