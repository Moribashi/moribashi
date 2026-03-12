import type { Knex } from 'knex';
import camelcaseKeys, { type Options as CamelCaseOptions } from 'camelcase-keys';
import path from 'path';
import fs from 'fs';

/**
 * Thin wrapper around a Knex instance that provides a `query()` helper
 * returning camelCase'd rows. Registered as a singleton by `pgPlugin`.
 *
 * Implements `onDestroy` so the connection pool is cleaned up when the
 * Moribashi app stops.
 */
export class Db {
  constructor(public knex: Knex) {}

  /** Run a raw SQL query with named params, returning camelCase'd rows. */
  async query<T extends object>(
    sql: string,
    params?: Record<string, unknown>,
    camelCaseOpts?: CamelCaseOptions,
  ): Promise<T[]> {
    const { rows } = (await this.knex.raw(sql, params ?? {})) as { rows: T[] };
    return rows.map((r) => camelcaseKeys<T>(r, { deep: true, ...camelCaseOpts }) as T);
  }

  async onDestroy(): Promise<void> {
    await this.knex.destroy();
  }
}




export class RepoQuery<E extends object> {
  public sql?: string
  public db?: Db

  private _ensureInit(){
    if( !this.sql ){
      throw new Error('Missing SQL')
    }
    if( !this.db ){
      throw new Error('Missing DB')
    }
  }

  private _query(params?: Record<string, unknown>): Promise<E[]> {
    this._ensureInit()
    return this.db!.query<E>(this.sql!, params ?? {})
  }

  /** Returns exactly one row. Throws if 0 or more than 1. */
  async one(params?: Record<string, unknown>): Promise<E> {
    const rows = await this._query(params)
    if (rows.length !== 1) {
      throw new Error(`Expected exactly one row, got ${rows.length}`)
    }
    return rows[0]
  }

  /** Returns 0 or more rows. Never throws on count. */
  async any(params?: Record<string, unknown>): Promise<E[]> {
    return this._query(params)
  }

  /** Returns 1 or more rows. Throws if 0. */
  async many(params?: Record<string, unknown>): Promise<E[]> {
    const rows = await this._query(params)
    if (rows.length === 0) {
      throw new Error('Expected one or more rows, got 0')
    }
    return rows
  }

  /** Expects 0 rows. Throws if any rows are returned. */
  async none(params?: Record<string, unknown>): Promise<void> {
    const rows = await this._query(params)
    if (rows.length > 0) {
      throw new Error(`Expected no rows, got ${rows.length}`)
    }
  }
}


export abstract class Repo {
  /**
   * @param dirname The directory where the implementation is located
   * @param db The Db instance to inject into each RepoQuery
   * @param sqlDir The directory, relative to `dirname`, where the sql files are located.
   *
   * Subclasses must call `this._autowire()` at the end of their own constructor
   * (after class field initializers have run — calling it in `super()` is too early).
   */
  constructor(protected dirname: string, public db: Db, protected sqlDir = `sql`){}

  protected _autowire(){
    const dir = path.join(this.dirname, this.sqlDir)
    autowireRepo(this, dir)
  }

}

export function autowireRepo(repo: Repo, dir: string){
  for(const [key, prop] of Object.entries(repo)){
    if( prop  instanceof RepoQuery ){
      prop.db = repo.db
      prop.sql = fs.readFileSync(path.join(dir, `${key}.sql`), 'utf8')
    }
  }
}
