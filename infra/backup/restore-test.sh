#!/bin/sh
# Restores a dump (the latest by default) into a throwaway Postgres and counts a few tables.
# Proves that the backups can be restored; touches neither production nor the dumps.
# Usage, on the NAS: docker compose run --rm backup /scripts/restore-test.sh [file]
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
dump="${1:-$(ls -1t "$BACKUP_DIR"/leximon-*.dump 2>/dev/null | head -n 1)}"
[ -n "$dump" ] && [ -f "$dump" ] || { echo "No dump found in $BACKUP_DIR" >&2; exit 1; }

data=$(mktemp -d)
trap 'pg_ctl -D "$data" -m immediate stop > /dev/null 2>&1 || true; rm -rf "$data"' EXIT

# The postgres image runs as root here: the server itself must run as `postgres`.
chown postgres "$data"
su postgres -c "initdb -D '$data' --auth=trust --no-locale --encoding=UTF8" > /dev/null
su postgres -c "pg_ctl -D '$data' -o '-c listen_addresses= -k /tmp' -w start" > /dev/null
su postgres -c "createdb -h /tmp leximon_restore"

# The client stays root: the dumps folder may be closed to the `postgres` user.
pg_restore -h /tmp -U postgres --no-owner --no-privileges --exit-on-error -d leximon_restore "$dump"

echo "Restored $dump"
su postgres -c "psql -h /tmp -d leximon_restore -At -c \"
  select 'users: ' || count(*) from users
  union all select 'user_cards: ' || count(*) from user_cards
  union all select 'cards: ' || count(*) from cards
  union all select 'migrations: ' || count(*) from drizzle.__drizzle_migrations\""
