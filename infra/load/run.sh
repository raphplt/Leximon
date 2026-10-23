#!/bin/sh
# Runs infra/load/scenarios.js with the pinned k6 image (D-047). Settings pass through:
#   BASE_URL, ORIGIN, SCENARIOS (open,answer,collection,arrival), RATE, HOLD, PLAYERS.
# Extra arguments go to `k6 run`, e.g. `--summary-export /load/results/run.json`.
# Never against the production API without the owner's explicit consent.
set -eu

case "${BASE_URL:-}" in
  *api.leximon.fr* | *//leximon.fr*)
    echo "Refused: BASE_URL is the production API." >&2
    exit 1
    ;;
esac

here=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$here/results"
# As the current user: players.json is readable by its owner only.
exec docker run --rm -i --network host --user "$(id -u):$(id -g)" \
  -v "$here:/load" -w /load \
  -e BASE_URL -e ORIGIN -e SCENARIOS -e RATE -e HOLD -e PLAYERS \
  grafana/k6:2.3.0 run "$@" scenarios.js
