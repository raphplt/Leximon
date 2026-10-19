-- Development fixtures only: a few real words so the game can be played locally.
-- Rarities here are placeholders: real rarities are computed by the content pipeline.
insert into collections (id, name, published_at) values
  ('fondateurs', 'Les Fondateurs', now()),
  ('noms-d-oiseaux', 'Noms d''oiseaux', now())
on conflict (id) do nothing;

insert into themes (id, name) values
  ('insultes', 'Insultes d''antan'),
  ('loufoque', 'Loufoque')
on conflict (id) do nothing;

insert into cards (id, lemma, rarity, collection_id) values
  ('vergogne', 'vergogne', 'common', 'fondateurs'),
  ('nonobstant', 'nonobstant', 'common', 'fondateurs'),
  ('vilipender', 'vilipender', 'common', 'fondateurs'),
  ('turlupiner', 'turlupiner', 'common', 'fondateurs'),
  ('escarcelle', 'escarcelle', 'uncommon', 'fondateurs'),
  ('billevesee', 'billevesée', 'rare', 'fondateurs'),
  ('galimatias', 'galimatias', 'precious', 'fondateurs'),
  ('coquecigrue', 'coquecigrue', 'precious', 'fondateurs'),
  ('mirliflore', 'mirliflore', 'epic', 'fondateurs'),
  ('chafouin', 'chafouin', 'uncommon', 'noms-d-oiseaux'),
  ('maraud', 'maraud', 'uncommon', 'noms-d-oiseaux'),
  ('faquin', 'faquin', 'rare', 'noms-d-oiseaux'),
  ('palsambleu', 'palsambleu', 'legendary', 'noms-d-oiseaux')
on conflict (id) do update set collection_id = excluded.collection_id;

insert into card_themes (card_id, theme_id) values
  ('chafouin', 'insultes'),
  ('maraud', 'insultes'),
  ('faquin', 'insultes'),
  ('coquecigrue', 'loufoque'),
  ('billevesee', 'loufoque'),
  ('palsambleu', 'loufoque')
on conflict do nothing;

-- The collection created by migration 0004 for older dev data is no longer needed.
delete from collections c
where c.id = 'non-classees' and not exists (select 1 from cards where collection_id = c.id);
