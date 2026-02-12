import { createApp, diagnostics as coreDiagnostics } from '@moribashi/core';
import { diagnostics as commonDiagnostics } from '@moribashi/common';
import { diagnostics as cliDiagnostics } from '@moribashi/cli';
import { diagnostics as webDiagnostics } from '@moribashi/web';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type BooksService from './books/books.svc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Diagnostics ---

console.log('Moribashi Diagnostics:');
console.log(JSON.stringify([
  commonDiagnostics(),
  coreDiagnostics(),
  cliDiagnostics(),
  webDiagnostics(),
], null, 2));

// --- IoC Container Demo ---

const app = createApp();
await app.scan(['**/*.repo.ts', '**/*.svc.ts'], { cwd: __dirname });
await app.start();

const booksService = app.resolve<BooksService>('booksService');

console.log('\nBooks with authors:');
console.log(JSON.stringify(booksService.findAllWithAuthors(), null, 2));

await app.stop();
