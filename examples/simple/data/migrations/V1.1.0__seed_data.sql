INSERT INTO authors (id, name) VALUES
  (1, 'Haruki Murakami'),
  (2, 'Banana Yoshimoto'),
  (3, 'Yukio Mishima')
ON CONFLICT (id) DO NOTHING;

INSERT INTO books (id, title, author_id) VALUES
  (1, 'Norwegian Wood', 1),
  (2, 'Kitchen', 2),
  (3, 'The Temple of the Golden Pavilion', 3),
  (4, 'Kafka on the Shore', 1)
ON CONFLICT (id) DO NOTHING;
