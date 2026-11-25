#!/bin/sh
# Puts the web front of main in production, alone: no migration, no catalogue publication, no API.
# For a change of the site only, from any computer: the catalogue shipped with the site is the one
# online, copied from leximon.fr, so the content pipeline's data and the database are not needed.
# A change that touches the API, the database or the catalogue goes through `pnpm deploy:prod`.
set -eu

cd "$(dirname "$0")/../.."

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

step "Arbre de travail"
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || fail "Pas sur main : on ne déploie que main."
[ -z "$(git status --porcelain)" ] || {
  git status --short >&2
  fail "Des fichiers ne sont pas commités : ils partiraient en ligne. Commite ou mets-les de côté."
}
git fetch --quiet origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] ||
  echo "Attention : main local et origin/main diffèrent (pense à pousser)."
echo "Commit déployé : $(git log --oneline -1)"

step "Vérifications"
pnpm check

step "Catalogue en ligne"
node infra/prod/mirror-catalog.mjs
latest=$(ls content/releases | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.[0-9]+$' | sort -V | tail -1)
shipped=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' apps/web/public/catalog/manifest.json | head -1)
[ "$shipped" = "$latest" ] ||
  echo "Attention : le catalogue $latest n'est pas encore en ligne ($shipped l'est). Il partira avec pnpm deploy:prod."

step "Web"
pnpm deploy:web

step "Contrôle"
sleep 10
curl -fsS --max-time 30 -o /dev/null https://leximon.fr/ || fail "Le site ne répond pas."
curl -fsS --max-time 30 -o /dev/null https://leximon.fr/catalog/manifest.json || fail "Le catalogue ne répond pas."
printf '\n\033[32mFront en ligne : %s\033[0m\n' "$(git log --oneline -1)"
