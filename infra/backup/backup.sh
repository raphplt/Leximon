#!/bin/sh
# Nightly dump of the production database, kept KEEP_DAYS days (30 by default).
# Runs in the `backup` container of compose.yaml; DATABASE_URL comes from .env, never from git.
set -eu

: "${DATABASE_URL:?DATABASE_URL is not set (infra/backup/.env)}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"

stamp=$(date -u +%Y%m%d-%H%M%S)
target="$BACKUP_DIR/leximon-$stamp.dump"
partial="$target.partial"
trap 'rm -f "$partial"' EXIT

# Custom format: compressed, and restorable table by table with pg_restore.
pg_dump --format=custom --compress=9 --no-owner --no-privileges --file="$partial" "$DATABASE_URL"
# A dump that pg_restore cannot list is a failed backup, not a backup.
pg_restore --list "$partial" > /dev/null
mv "$partial" "$target"
trap - EXIT

# Rotation only after a good dump: a failing night never shortens the history.
find "$BACKUP_DIR" -maxdepth 1 -name 'leximon-*.dump' -type f -mtime +"$KEEP_DAYS" -delete

size=$(du -h "$target" | cut -f1)
echo "$(date -u +%FT%TZ) backup ok: $target ($size)"
