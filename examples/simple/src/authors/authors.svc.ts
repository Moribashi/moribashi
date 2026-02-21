import type { Author } from './authors.domain.js';
import type AuthorsRepo from './authors.repo.js';

export default class AuthorsService {
  private authorsRepo: AuthorsRepo;

  constructor({ authorsRepo }: { authorsRepo: AuthorsRepo }) {
    this.authorsRepo = authorsRepo;
  }

  findAll(): Promise<Author[]> {
    return this.authorsRepo.findAll();
  }

  findById(id: number): Promise<Author | undefined> {
    return this.authorsRepo.findById(id);
  }
}
