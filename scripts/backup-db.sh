#!/usr/bin/env bash
# Nightly MSSQL backup + data/ tarball -> S3. Run from cron on the EC2 host.
# Usage: backup-db.sh [/path/to/repo]  (default: script's parent dir)
# Requires: BACKUP_S3_BUCKET in the repo .env (BACKUP_S3_PREFIX optional, default "mssql";
# BACKUP_S3_DATA_PREFIX optional, default "data"); aws cli with an instance role, or
# AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY in .env.
set -euo pipefail

REPO_DIR="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
ENV_FILE="$REPO_DIR/.env"
CONTAINER=testing-dashboard-db
SQLCMD=/opt/mssql-tools18/bin/sqlcmd

# Load DB_PASSWORD / DB_NAME / BACKUP_* (and optional AWS key fallback)
set -a; . "$ENV_FILE"; set +a
DB_NAME="${DB_NAME:-TestingDashboard}"
S3_BUCKET="${BACKUP_S3_BUCKET:?set BACKUP_S3_BUCKET in $ENV_FILE}"
S3_PREFIX="${BACKUP_S3_PREFIX:-mssql}"
S3_DATA_PREFIX="${BACKUP_S3_DATA_PREFIX:-data}"

STAMP=$(date -u +%Y%m%d_%H%M%S)
BAK="${DB_NAME}_${STAMP}.bak"
IN_CONTAINER="/var/opt/mssql/backups/$BAK"
ON_HOST="$REPO_DIR/backups/$BAK"
DATA_TGZ="data_${STAMP}.tar.gz"
DATA_ON_HOST="$REPO_DIR/backups/$DATA_TGZ"

run_sql() {
  # -b: exit non-zero on SQL errors so set -e catches failures
  docker exec "$CONTAINER" "$SQLCMD" -S localhost -U sa -P "$DB_PASSWORD" -C -b -Q "$1"
}

echo "[backup] BACKUP DATABASE $DB_NAME -> $BAK"
run_sql "BACKUP DATABASE [$DB_NAME] TO DISK = N'$IN_CONTAINER' WITH INIT, FORMAT, COMPRESSION, CHECKSUM, STATS = 10"

echo "[backup] RESTORE VERIFYONLY"
run_sql "RESTORE VERIFYONLY FROM DISK = N'$IN_CONTAINER' WITH CHECKSUM"

echo "[backup] upload to s3://$S3_BUCKET/$S3_PREFIX/$BAK"
aws s3 cp "$ON_HOST" "s3://$S3_BUCKET/$S3_PREFIX/$BAK" --only-show-errors

# Local prune: keep 2 days on disk (S3 lifecycle owns long-term retention)
find "$REPO_DIR/backups" -name '*.bak' -mtime +2 -delete
echo "[backup] done: $BAK"

echo "[backup] tar data/ -> $DATA_TGZ"
tar -czf "$DATA_ON_HOST" -C "$REPO_DIR" data

echo "[backup] upload to s3://$S3_BUCKET/$S3_DATA_PREFIX/$DATA_TGZ"
aws s3 cp "$DATA_ON_HOST" "s3://$S3_BUCKET/$S3_DATA_PREFIX/$DATA_TGZ" --only-show-errors

# Local prune: keep 2 days on disk (S3 lifecycle owns long-term retention)
find "$REPO_DIR/backups" -name 'data_*.tar.gz' -mtime +2 -delete
echo "[backup] done: $DATA_TGZ"
