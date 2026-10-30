#!/bin/sh
# Puts main in production in one go: checks, migrations, catalogue if a newer release exists,
# API, then web. Order matters: migrations are additive, so the running API keeps working while
# they apply, and the web goes last so it never calls an API that does not exist yet.
#
# The connection string comes from DATABASE_URL, or else from ~/.config/leximon/home-db-url.
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

if [ -z "${DATABASE_URL:-}" ]; then
  url_file="$HOME/.config/leximon/home-db-url"
  [ -s "$url_file" ] || fail "Ni DATABASE_URL ni $url_file : la base de production est introuvable."
  DATABASE_URL=$(cat "$url_file")
fi
export DATABASE_URL

# The home database has no public address: the scripts reach it through an SSH tunnel.
case "$DATABASE_URL" in
  *127.0.0.1:54330*)
    ssh -o BatchMode=yes -o ExitOnForwardFailure=yes -N -L 54330:192.168.0.53:5432 pve &
    tunnel=$!
    trap 'kill "$tunnel" 2>/dev/null || true' EXIT
    sleep 2
    ;;
esac

step "Migrations"
pnpm db:migrate:prod

step "Catalogue"
latest=$(ls content/releases | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.[0-9]+$' | sort -V | tail -1)
live=$(curl -fsS --max-time 20 https://leximon.fr/catalog/manifest.json |
  sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' | head -1 || true)
if [ "$latest" = "$live" ]; then
  echo "En ligne : $live, déjà la dernière version."
else
  echo "En ligne : ${live:-inconnue}, dernière version : $latest. Publication."
  pnpm catalog:publish:prod
fi
# The web ships whatever sits in public/catalog: it must be the latest release, not a dev one,
# with the engraving index that publications write since 2026-10-23.
shipped=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' apps/web/public/catalog/manifest.json | head -1)
[ "$shipped" = "$latest" ] && [ -f apps/web/public/catalog/engravings.json ] || {
  echo "public/catalog contient ${shipped:-rien} (dernière version : $latest, ou sans engravings.json) : republication."
  pnpm catalog:publish:prod
}

step "API"
pnpm deploy:api

step "Web"
pnpm deploy:web

step "Contrôle"
sleep 10
curl -fsS --max-time 20 https://api.leximon.fr/health >/dev/null || fail "L'API ne répond pas."
curl -fsS --max-time 30 -o /dev/null https://leximon.fr/ || fail "Le site ne répond pas."
printf '\n\033[32mEn ligne : %s\033[0m\n' "$(git log --oneline -1)"
