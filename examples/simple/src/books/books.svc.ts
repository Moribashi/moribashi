import type { OnInit, OnDestroy } from '@moribashi/common';
import type { BookWithAuthor } from './books.domain.js';
import type BooksRepo from './books.repo.js';
import type AuthorsService from '../authors/authors.svc.js';

export default class BooksService implements OnInit, OnDestroy {
  private booksRepo: BooksRepo;
  private authorsService: AuthorsService;

  constructor({ booksRepo, authorsService }: { booksRepo: BooksRepo; authorsService: AuthorsService }) {
    this.booksRepo = booksRepo;
    this.authorsService = authorsService;
  }

  onInit() {
    console.log('[BooksService] initialized');
  }

  onDestroy() {
    console.log('[BooksService] destroyed');
  }

  async findAllWithAuthors(): Promise<BookWithAuthor[]> {
    const books = await this.booksRepo.findAll();
    return Promise.all(
      books.map(async (book) => ({
        ...book,
        author: await this.authorsService.findById(book.authorId),
      })),
    );
  }
}
