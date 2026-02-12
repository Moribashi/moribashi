import type { Author } from './authors.domain.js';

const DB: Author[] = [
  { id: 1, name: 'Haruki Murakami' },
  { id: 2, name: 'Banana Yoshimoto' },
  { id: 3, name: 'Yukio Mishima' },
];

export default class AuthorsRepo {
  findAll(): Author[] {
    return DB;
  }

  findById(id: number): Author | undefined {
    return DB.find((a) => a.id === id);
  }
}
