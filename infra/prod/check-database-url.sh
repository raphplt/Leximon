#!/bin/sh
# Guard of the `*:prod` scripts: DATABASE_URL must come from the shell, point at a remote host and
# require TLS. Without it, the scripts would quietly fall back to the local database of .env.
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set in this shell. Set it first (docs/mise-en-ligne.md):" >&2
  echo "  read -rs DATABASE_URL && export DATABASE_URL" >&2
  exit 1
fi

# Host only: never print the password.
host=$(printf '%s' "$DATABASE_URL" | sed -E 's#^[a-z]+://([^@/]*@)?([^:/?]+).*#\2#')
case "$host" in
  localhost | 127.0.0.1 | "[::1]" | "")
    echo "DATABASE_URL points at the local database ($host): refused for a production script." >&2
    exit 1
    ;;
esac
case "$DATABASE_URL" in
  *sslmode=require* | *sslmode=verify-full*) ;;
  *)
    echo "DATABASE_URL must require TLS (add ?sslmode=require)." >&2
    exit 1
    ;;
esac

echo "Production database: $host"
