#!/usr/bin/env bash
# Bring up the local dev stack (Postgres + Redis) and apply Prisma migrations.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose -f docker-compose.dev.yml up -d
echo "Waiting for Postgres..."
for i in {1..30}; do
  docker compose -f docker-compose.dev.yml exec -T postgres pg_isready -U openlend && break
  sleep 1
done

echo "Applying Prisma migrations..."
for d in ../bridge ../relayer ../indexer ../api; do
  pushd "$d" >/dev/null
  [ -d prisma ] && npx prisma migrate deploy || true
  popd >/dev/null
done

echo "✔ Dev stack is up."
echo "  Postgres:  localhost:5432  (openlend / openlend)"
echo "  Redis:     localhost:6379"
