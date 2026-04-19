import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '@moribashi/core';
import { graphqlPlugin } from '@moribashi/graphql';
import { pgPlugin } from '@moribashi/pg';
import type { FastifyInstance } from '@moribashi/web';
import { webPlugin } from '@moribashi/web';
import type BooksService from './books/books.svc.js';
import { resolvers } from './graphql/resolvers.js';
import { schema } from './graphql/schema.js';
import debugRoutes from './misc/debug.router.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface BuildAppOptions {
  /** Override the HTTP port. Defaults to 3000; pass 0 in tests to pick a random free port. */
  port?: number;
  /** Override the bind host. Defaults to webPlugin default (0.0.0.0). */
  host?: string;
}

/**
 * Wire up the example app (plugins, scan, routes) without starting it.
 *
 * Split out from `main.ts` so tests can import and drive the app without
 * triggering the top-level `await app.start()` in `main.ts`.
 */
export async function buildApp(opts: BuildAppOptions = {}) {
  const app = createApp();

  app.use(
    pgPlugin({
      host: 'postgres',
      user: 'moribashi',
      password: 'password',
      database: 'moribashi',
      migrationsDir: path.join(__dirname, '..', 'data', 'migrations'),
    }),
  );
  app.use(webPlugin({ port: opts.port ?? 3000, host: opts.host }));
  app.use(graphqlPlugin({ schema, resolvers, graphiql: true }));

  await app.scan(['**/*.repo.ts', '**/*.svc.ts'], { cwd: __dirname });

  // --- Routes ---

  const fastify = app.resolve<FastifyInstance>('fastify');

  debugRoutes(fastify);

  fastify.get('/books', async (request) => {
    const booksService = request.scope.resolve<BooksService>('booksService');
    return booksService.findAllWithAuthors();
  });

  return app;
}
