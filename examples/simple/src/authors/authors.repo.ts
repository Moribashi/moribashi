import type { Db } from '@moribashi/pg';
import type { Author } from './authors.domain.js';

export default class AuthorsRepo {
  private db: Db;

  constructor({ db }: { db: Db }) {
    this.db = db;
  }

  async findAll(): Promise<Author[]> {
    return this.db.query<Author>('SELECT id, name FROM authors ORDER BY id');
  }

  async findById(id: number): Promise<Author | undefined> {
    const rows = await this.db.query<Author>('SELECT id, name FROM authors WHERE id = :id', { id });
    return rows[0];
  }
}
