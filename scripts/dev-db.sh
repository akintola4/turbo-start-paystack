#!/usr/bin/env bash
# Starts (or reuses) a local Postgres for development and prints DATABASE_URL.
# Uses Docker when its daemon is running, otherwise a local postgres install
# (initdb/pg_ctl) with its data in .pgdata/. Safe to run again: a running
# server is reused, a stopped one is started, and data is kept.
#
#   PGPORT      port to use for a new server (default 54329)
#   PGDATABASE  database to create if missing (default turbo_start_paystack)
#   TSP_PG      docker | local, to pick one explicitly
set -euo pipefail

PORT="${PGPORT:-54329}"
DB="${PGDATABASE:-turbo_start_paystack}"
CONTAINER=tsp-postgres
MODE="${TSP_PG:-}"

if [ -z "$MODE" ]; then
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    MODE=docker
  elif command -v pg_ctl >/dev/null 2>&1 && command -v initdb >/dev/null 2>&1; then
    MODE=local
  else
    echo "Neither Docker (running) nor a local Postgres (initdb, pg_ctl) was found." >&2
    echo "Install one: Docker Desktop, or 'brew install postgresql@17' / 'sudo apt install postgresql'." >&2
    exit 1
  fi
fi

if [ "$MODE" = docker ]; then
  if docker container inspect "$CONTAINER" >/dev/null 2>&1; then
    if [ "$(docker container inspect -f '{{.State.Running}}' "$CONTAINER")" != true ]; then
      docker start "$CONTAINER" >/dev/null
    fi
    PORT="$(docker port "$CONTAINER" 5432/tcp | head -n1 | sed 's/.*://')"
  else
    docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=postgres \
      -v tsp-pgdata:/var/lib/postgresql/data \
      -p "127.0.0.1:$PORT:5432" postgres:17 >/dev/null
  fi
  until docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; do sleep 0.5; done
  docker exec "$CONTAINER" createdb -U postgres "$DB" 2>/dev/null || true
  echo "DATABASE_URL=postgres://postgres:postgres@127.0.0.1:$PORT/$DB"
  echo "Stop it with: docker stop $CONTAINER"
  exit 0
fi

DATA_DIR="$(cd "$(dirname "$0")/.." && pwd)/.pgdata"
if [ ! -d "$DATA_DIR" ]; then
  initdb -D "$DATA_DIR" -U postgres --auth=trust >/dev/null
fi
if pg_ctl -D "$DATA_DIR" status >/dev/null 2>&1; then
  # Already running: use the port it was started on.
  PORT="$(sed -n 4p "$DATA_DIR/postmaster.pid")"
else
  pg_ctl -D "$DATA_DIR" -o "-p $PORT -k '' -c listen_addresses=127.0.0.1" \
    -l "$DATA_DIR/postgres.log" start >/dev/null
fi
until pg_isready -h 127.0.0.1 -p "$PORT" >/dev/null 2>&1; do sleep 0.5; done
createdb -h 127.0.0.1 -p "$PORT" -U postgres "$DB" 2>/dev/null || true
echo "DATABASE_URL=postgres://postgres@127.0.0.1:$PORT/$DB"
echo "Stop it with: pg_ctl -D $DATA_DIR stop"
