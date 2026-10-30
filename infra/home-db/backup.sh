#!/bin/sh
# Hourly dump of the database to R2: the copy that survives a dead home server.
# Runs as `postgres` from leximon-backup.timer; the R2 keys come from /etc/leximon/backup.env.
# The bucket's lifecycle rules do the rotation (hourly/ 3 days, daily/ 30 days), so this key never
# needs to delete anything.
set -eu

DATABASE="${DATABASE:-leximon}"
remote="r2:${R2_BUCKET:?R2_BUCKET is not set (/etc/leximon/backup.env)}"

stamp=$(date -u +%Y%m%d-%H%M%S)
dump=$(mktemp)
trap 'rm -f "$dump"' EXIT

# Custom format: compressed, and restorable table by table with pg_restore.
pg_dump --format=custom --compress=9 --no-owner --no-privileges --file="$dump" "$DATABASE"
# A dump that pg_restore cannot list is a failed backup, not a backup.
pg_restore --list "$dump" > /dev/null

rclone copyto "$dump" "$remote/hourly/leximon-$stamp.dump"
# The quietest hour gives the copy kept for 30 days.
if [ "$(date -u +%H)" = "03" ]; then
  rclone copyto "$dump" "$remote/daily/leximon-$stamp.dump"
fi

size=$(du -h "$dump" | cut -f1)
echo "$(date -u +%FT%TZ) backup ok: leximon-$stamp.dump ($size)"
