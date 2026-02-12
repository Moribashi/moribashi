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

  findAllWithAuthors(): BookWithAuthor[] {
    return this.booksRepo.findAll().map((book) => ({
      ...book,
      author: this.authorsService.findById(book.authorId),
    }));
  }
}
