#!/usr/bin/env bash
# Starts a throwaway local Postgres for development and prints DATABASE_URL.
# Uses Docker when available, otherwise a local postgres install (initdb/pg_ctl).
set -euo pipefail

PORT="${PGPORT:-54329}"
DB=turbo_start_paystack

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  docker run -d --rm --name tsp-postgres -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB="$DB" -p "$PORT:5432" postgres:17 >/dev/null
  echo "DATABASE_URL=postgres://postgres:postgres@localhost:$PORT/$DB"
  exit 0
fi

DATA_DIR="$(cd "$(dirname "$0")/.." && pwd)/.pgdata"
if [ ! -d "$DATA_DIR" ]; then
  initdb -D "$DATA_DIR" -U postgres --auth=trust >/dev/null
fi
pg_ctl -D "$DATA_DIR" -o "-p $PORT -k '' -c listen_addresses=127.0.0.1" \
  -l "$DATA_DIR/postgres.log" start >/dev/null
until pg_isready -h 127.0.0.1 -p "$PORT" >/dev/null 2>&1; do sleep 0.5; done
createdb -h 127.0.0.1 -p "$PORT" -U postgres "$DB" 2>/dev/null || true
echo "DATABASE_URL=postgres://postgres@127.0.0.1:$PORT/$DB"
echo "Stop it with: pg_ctl -D $DATA_DIR stop"
