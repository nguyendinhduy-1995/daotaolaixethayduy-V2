#!/bin/bash
# n8n daily backup script
# Schedule: crontab -e → 0 3 * * * /opt/n8n/backup.sh

BACKUP_DIR=/opt/n8n/backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# 1. Postgres dump
docker exec n8n-postgres pg_dump -U n8n -d n8n --no-owner | gzip > "$BACKUP_DIR/n8n_db_${TIMESTAMP}.sql.gz"
echo "[backup] DB dump: n8n_db_${TIMESTAMP}.sql.gz"

# 2. n8n data volume (encryption keys, custom nodes, etc.)
docker run --rm -v n8n_n8n_data:/data -v "$BACKUP_DIR":/backup alpine tar czf "/backup/n8n_data_${TIMESTAMP}.tar.gz" -C /data .
echo "[backup] Data volume: n8n_data_${TIMESTAMP}.tar.gz"

# 3. Cleanup older than 14 days
find "$BACKUP_DIR" -name "*.gz" -mtime +14 -delete
echo "[backup] Cleaned backups older than 14 days"
echo "[backup] Done at $(date)"
