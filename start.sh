#!/bin/sh
set -e
# Run migrations in background so the Next.js server starts immediately.
# startup.js retries DB connection up to 2 min; the server can serve requests
# during that window (all DB-dependent routes gracefully handle connection errors).
node database/dist/database/src/startup.js &
exec node server.js
