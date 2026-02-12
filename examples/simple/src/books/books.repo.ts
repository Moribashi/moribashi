import type { Book } from './books.domain.js';

const DB: Book[] = [
  { id: 1, title: 'Norwegian Wood', authorId: 1 },
  { id: 2, title: 'Kitchen', authorId: 2 },
  { id: 3, title: 'The Temple of the Golden Pavilion', authorId: 3 },
  { id: 4, title: 'Kafka on the Shore', authorId: 1 },
];

export default class BooksRepo {
  findAll(): Book[] {
    return DB;
  }

  findByAuthorId(authorId: number): Book[] {
    return DB.filter((b) => b.authorId === authorId);
  }
}
