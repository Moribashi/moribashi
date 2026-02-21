import type { Db } from '@moribashi/pg';
import type { Book } from './books.domain.js';

export default class BooksRepo {
  private db: Db;

  constructor({ db }: { db: Db }) {
    this.db = db;
  }

  async findAll(): Promise<Book[]> {
    return this.db.query<Book>('SELECT id, title, author_id FROM books ORDER BY id');
  }

  async findByAuthorId(authorId: number): Promise<Book[]> {
    return this.db.query<Book>('SELECT id, title, author_id FROM books WHERE author_id = :authorId ORDER BY id', { authorId });
  }
}
