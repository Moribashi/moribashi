import { describe, it, expect } from 'vitest';
import { diagnostics, createKnex, SqlMigrationSource, fastifyKnex, Db, pgPlugin } from '../index.js';

describe('index re-exports', () => {
  it('exports diagnostics', () => {
    expect(diagnostics()).toEqual({ module: '@moribashi/pg' });
  });

  it('exports createKnex', () => {
    expect(typeof createKnex).toBe('function');
  });

  it('exports SqlMigrationSource', () => {
    expect(typeof SqlMigrationSource).toBe('function');
  });

  it('exports fastifyKnex', () => {
    expect(typeof fastifyKnex).toBe('function');
  });

  it('exports Db', () => {
    expect(typeof Db).toBe('function');
  });

  it('exports pgPlugin', () => {
    expect(typeof pgPlugin).toBe('function');
  });
});
