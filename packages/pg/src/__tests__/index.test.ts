import { describe, expect, it } from 'vitest';
import {
  createKnex,
  Db,
  diagnostics,
  fastifyKnex,
  pgPlugin,
  SqlMigrationSource,
} from '../index.js';

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
