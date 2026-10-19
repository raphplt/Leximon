-- Development fixtures only: a few real words so the game can be played locally.
-- Rarities here are placeholders: real rarities are computed by the content pipeline.
insert into cards (id, lemma, rarity) values
  ('vergogne', 'vergogne', 'common'),
  ('nonobstant', 'nonobstant', 'common'),
  ('vilipender', 'vilipender', 'common'),
  ('turlupiner', 'turlupiner', 'common'),
  ('chafouin', 'chafouin', 'uncommon'),
  ('escarcelle', 'escarcelle', 'uncommon'),
  ('maraud', 'maraud', 'uncommon'),
  ('faquin', 'faquin', 'rare'),
  ('billevesee', 'billevesée', 'rare'),
  ('galimatias', 'galimatias', 'precious'),
  ('coquecigrue', 'coquecigrue', 'precious'),
  ('mirliflore', 'mirliflore', 'epic'),
  ('palsambleu', 'palsambleu', 'legendary')
on conflict (id) do nothing;
