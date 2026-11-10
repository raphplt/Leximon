#!/bin/sh
# Hourly dump of the database to R2: the copy that survives a dead home server.
# Runs as `postgres` from leximon-backup.timer; the R2 keys come from /etc/leximon/backup.env.
# The dump leaves encrypted for the public keys of /etc/leximon/backup-recipients. Their private
# keys are not on this server: neither it nor the R2 keys can read a dump back.
# The bucket's lifecycle rules do the rotation (hourly/ 3 days, daily/ 30 days), so this key never
# needs to delete anything.
set -eu

DATABASE="${DATABASE:-leximon}"
remote="r2:${R2_BUCKET:?R2_BUCKET is not set (/etc/leximon/backup.env)}"
recipients="${BACKUP_RECIPIENTS:-/etc/leximon/backup-recipients}"
# No key, no backup: the alert of a missing dump is better than a readable one on R2.
[ -s "$recipients" ] || { echo "no public key in $recipients" >&2; exit 1; }

stamp=$(date -u +%Y%m%d-%H%M%S)
dump=$(mktemp)
sealed="$dump.age"
trap 'rm -f "$dump" "$sealed"' EXIT

# Custom format: compressed, and restorable table by table with pg_restore.
pg_dump --format=custom --compress=9 --no-owner --no-privileges --file="$dump" "$DATABASE"
# A dump that pg_restore cannot list is a failed backup, not a backup.
pg_restore --list "$dump" > /dev/null
age --recipients-file "$recipients" --output "$sealed" "$dump"

# R2 answers 501 to the HEAD with a versionId that rclone sends after a successful PUT.
upload="rclone copyto --s3-no-head $sealed"
$upload "$remote/hourly/leximon-$stamp.dump.age"
# The quietest hour gives the copy kept for 30 days.
if [ "$(date -u +%H)" = "03" ]; then
  $upload "$remote/daily/leximon-$stamp.dump.age"
fi

size=$(du -h "$sealed" | cut -f1)
echo "$(date -u +%FT%TZ) backup ok: leximon-$stamp.dump.age ($size)"
