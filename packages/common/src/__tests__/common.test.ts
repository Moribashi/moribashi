import { describe, expect, it } from 'vitest';
import { diagnostics, hasOnDestroy, hasOnInit } from '../index.js';

describe('hasOnInit', () => {
  it('returns true for objects with an onInit function', () => {
    expect(hasOnInit({ onInit: () => {} })).toBe(true);
    expect(hasOnInit({ onInit: async () => {} })).toBe(true);
  });

  it('returns false for objects without onInit', () => {
    expect(hasOnInit({})).toBe(false);
    expect(hasOnInit({ onInit: 'not a function' })).toBe(false);
  });

  it('returns false for null, undefined, and primitives', () => {
    expect(hasOnInit(null)).toBe(false);
    expect(hasOnInit(undefined)).toBe(false);
    expect(hasOnInit(42)).toBe(false);
    expect(hasOnInit('string')).toBe(false);
  });
});

describe('hasOnDestroy', () => {
  it('returns true for objects with an onDestroy function', () => {
    expect(hasOnDestroy({ onDestroy: () => {} })).toBe(true);
    expect(hasOnDestroy({ onDestroy: async () => {} })).toBe(true);
  });

  it('returns false for objects without onDestroy', () => {
    expect(hasOnDestroy({})).toBe(false);
    expect(hasOnDestroy({ onDestroy: 42 })).toBe(false);
  });

  it('returns false for null, undefined, and primitives', () => {
    expect(hasOnDestroy(null)).toBe(false);
    expect(hasOnDestroy(undefined)).toBe(false);
    expect(hasOnDestroy(false)).toBe(false);
  });
});

describe('diagnostics', () => {
  it('returns the module identifier', () => {
    expect(diagnostics()).toEqual({ module: '@moribashi/common' });
  });
});
