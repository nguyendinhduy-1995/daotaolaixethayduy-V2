#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# Postgres Daily Backup Script
#
# Usage:
#   bash scripts/backup-postgres.sh
#   bash scripts/backup-postgres.sh --verify
#
# Environment:
#   DATABASE_URL     — PostgreSQL connection string
#   BACKUP_DIR       — Backup directory (default: /backups)
#   BACKUP_RETENTION — Days to keep backups (default: 30)
# ──────────────────────────────────────────────────────────────────
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION="${BACKUP_RETENTION:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="crm_backup_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${FILENAME}"

# ─── Parse DATABASE_URL ──────────────────────────────────────────
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL not set"
  exit 1
fi

# Extract components from postgresql://user:pass@host:port/dbname
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')

echo "📦 Backup: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo "📁 Target: ${BACKUP_PATH}"

# ─── Create backup directory ────────────────────────────────────
mkdir -p "$BACKUP_DIR"

# ─── Dump + compress ────────────────────────────────────────────
export PGPASSWORD="$DB_PASS"
pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-privileges \
  --format=plain \
  | gzip > "$BACKUP_PATH"

# ─── Verify ─────────────────────────────────────────────────────
FILESIZE=$(stat -f%z "$BACKUP_PATH" 2>/dev/null || stat --format=%s "$BACKUP_PATH" 2>/dev/null || echo "0")

if [ "$FILESIZE" -lt 1000 ]; then
  echo "❌ Backup file too small (${FILESIZE} bytes). Likely failed."
  rm -f "$BACKUP_PATH"
  exit 1
fi

echo "✅ Backup complete: ${FILENAME} ($(( FILESIZE / 1024 )) KB)"

# ─── Verify integrity (optional flag) ───────────────────────────
if [[ "${1:-}" == "--verify" ]]; then
  echo "🔍 Verifying backup integrity..."
  TABLE_COUNT=$(gunzip -c "$BACKUP_PATH" | grep -c "CREATE TABLE" || true)
  echo "   Tables found: ${TABLE_COUNT}"
  if [ "$TABLE_COUNT" -lt 5 ]; then
    echo "⚠️  Warning: Very few tables in backup."
  else
    echo "✅ Backup integrity looks good."
  fi
fi

# ─── Cleanup old backups ────────────────────────────────────────
DELETED=$(find "$BACKUP_DIR" -name "crm_backup_*.sql.gz" -mtime "+${RETENTION}" -delete -print | wc -l || true)
if [ "$DELETED" -gt 0 ]; then
  echo "🗑️  Cleaned up ${DELETED} backup(s) older than ${RETENTION} days"
fi

# ─── Summary ────────────────────────────────────────────────────
TOTAL=$(find "$BACKUP_DIR" -name "crm_backup_*.sql.gz" | wc -l || true)
echo "📊 Total backups: ${TOTAL}"
echo "📅 Retention: ${RETENTION} days"
echo ""
echo "To restore:"
echo "  gunzip -c ${BACKUP_PATH} | psql -h HOST -U USER -d DB"
