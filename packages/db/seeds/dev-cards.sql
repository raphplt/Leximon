-- Development fixtures only: cards drafted by the content pipeline (run lot-1), so the game can be
-- played locally. Their text is in apps/web/src/cards/demo-catalog.ts: keep both lists in sync.
insert into collections (id, name, published_at) values
  ('fondateurs', 'Les Fondateurs', now())
on conflict (id) do nothing;

insert into cards (id, lemma, rarity, collection_id) values
  ('sauvagesse', 'sauvagesse', 'common', 'fondateurs'),
  ('sapiniere', 'sapinière', 'common', 'fondateurs'),
  ('tripaille', 'tripaille', 'common', 'fondateurs'),
  ('raclure', 'raclure', 'common', 'fondateurs'),
  ('marniere', 'marnière', 'common', 'fondateurs'),
  ('septenaire', 'septénaire', 'common', 'fondateurs'),
  ('glanure', 'glanure', 'uncommon', 'fondateurs'),
  ('defourner', 'défourner', 'uncommon', 'fondateurs'),
  ('poue', 'poue', 'uncommon', 'fondateurs'),
  ('odorer', 'odorer', 'uncommon', 'fondateurs'),
  ('ensafraner', 'ensafraner', 'rare', 'fondateurs'),
  ('coquefredouille', 'coquefredouille', 'rare', 'fondateurs'),
  ('pyromancien', 'pyromancien', 'rare', 'fondateurs'),
  ('vacillatoire', 'vacillatoire', 'precious', 'fondateurs'),
  ('poelonnee', 'poêlonnée', 'precious', 'fondateurs'),
  ('ramoindrir', 'ramoindrir', 'precious', 'fondateurs'),
  ('hematophobe', 'hématophobe', 'precious', 'fondateurs'),
  ('francatu', 'francatu', 'epic', 'fondateurs'),
  ('matrimonion', 'matrimonion', 'epic', 'fondateurs'),
  ('affolage', 'affolage', 'epic', 'fondateurs'),
  ('enlarme', 'enlarme', 'epic', 'fondateurs'),
  ('barbouquine', 'barbouquine', 'legendary', 'fondateurs'),
  ('chagnot', 'chagnot', 'legendary', 'fondateurs')
on conflict (id) do update set collection_id = excluded.collection_id, retired_at = null;

-- Cards of earlier fixtures leave the boosters; copies already owned stay.
update cards set retired_at = now()
where retired_at is null and id not in ('sauvagesse', 'sapiniere', 'tripaille', 'raclure', 'marniere', 'septenaire', 'glanure', 'defourner', 'poue', 'odorer', 'ensafraner', 'coquefredouille', 'pyromancien', 'vacillatoire', 'poelonnee', 'ramoindrir', 'hematophobe', 'francatu', 'matrimonion', 'affolage', 'enlarme', 'barbouquine', 'chagnot');
