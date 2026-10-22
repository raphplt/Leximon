ALTER TABLE "user_level_rewards" DROP CONSTRAINT "user_level_rewards_choice_check";--> statement-breakpoint
ALTER TABLE "user_level_rewards" DROP CONSTRAINT "user_level_rewards_chosen_card_id_cards_id_fk";
--> statement-breakpoint
ALTER TABLE "user_level_rewards" DROP COLUMN "chosen_card_id";--> statement-breakpoint
ALTER TABLE "user_level_rewards" DROP COLUMN "chosen_at";--> statement-breakpoint
-- Coffrets opened before the card of the choice became a garni booster read as one (before launch).
UPDATE "user_level_rewards" SET "rewards" = (SELECT jsonb_agg(CASE WHEN r->>'kind' = 'card_choice' THEN '{"kind":"garni_booster"}'::jsonb ELSE r END ORDER BY o) FROM jsonb_array_elements("rewards") WITH ORDINALITY AS t(r, o)) WHERE "rewards" @> '[{"kind":"card_choice"}]';
