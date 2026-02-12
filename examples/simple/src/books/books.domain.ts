export interface Book {
  id: number;
  title: string;
  authorId: number;
}

export interface BookWithAuthor extends Book {
  author: { id: number; name: string } | undefined;
}
