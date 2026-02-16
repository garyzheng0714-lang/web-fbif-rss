#!/bin/sh
set -e

MODE="${1:-web}"

if [ "$MODE" = "web" ]; then
  npx prisma migrate deploy
  exec npm run start
fi

if [ "$MODE" = "worker" ]; then
  npx prisma migrate deploy
  exec npm run worker
fi

exec "$@"
