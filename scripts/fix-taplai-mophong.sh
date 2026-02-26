#!/bin/bash
# ================================================================
# Fix SSL & Deploy: taplai + mophong subdomains
# Chạy trên server với quyền root/sudo
# ================================================================
set -e

echo "=========================================="
echo " Fix taplai & mophong subdomains"
echo "=========================================="

# ── Step 0: Kiểm tra Docker network ──
echo ""
echo "▶ [1/6] Kiểm tra Docker network thayduy_default..."
if ! docker network inspect thayduy_default >/dev/null 2>&1; then
    echo "  → Tạo network thayduy_default..."
    docker network create thayduy_default
else
    echo "  ✓ Network thayduy_default đã tồn tại"
fi

# ── Step 1: Khởi động taplai-app ──
echo ""
echo "▶ [2/6] Khởi động taplai-app..."
cd /Volumes/Data\ -\ 3/hoclythuyetcungthayduy
if docker ps --format '{{.Names}}' | grep -q '^taplai-app$'; then
    echo "  ✓ taplai-app đang chạy"
else
    echo "  → Build & start taplai-app..."
    docker compose up -d --build
fi

# ── Step 2: Khởi động mophong-app ──
echo ""
echo "▶ [3/6] Khởi động mophong-app..."
cd /Volumes/Data\ -\ 3/Mophong
if docker ps --format '{{.Names}}' | grep -q '^mophong-app$'; then
    echo "  ✓ mophong-app đang chạy"
else
    echo "  → Start mophong-app..."
    docker compose up -d
fi

# ── Step 3: Cấp SSL cho mophong (nếu chưa có) ──
echo ""
echo "▶ [4/6] Kiểm tra & cấp SSL certificate..."

# Tạm thời comment SSL trong nginx config để certbot có thể xác thực qua HTTP
# Certbot sử dụng webroot challenge qua port 80

CERTBOT_DIR="/Volumes/Data - 3/thayduy-crm/certbot"

# Kiểm tra cert mophong
if [ ! -f "${CERTBOT_DIR}/conf/live/mophong.thayduydaotaolaixe.com/fullchain.pem" ]; then
    echo "  → Cấp cert cho mophong.thayduydaotaolaixe.com..."
    docker run --rm \
        -v "${CERTBOT_DIR}/conf:/etc/letsencrypt" \
        -v "${CERTBOT_DIR}/www:/var/www/certbot" \
        certbot/certbot certonly --webroot \
        -w /var/www/certbot \
        -d mophong.thayduydaotaolaixe.com \
        --non-interactive --agree-tos \
        --email admin@thayduydaotaolaixe.com
    echo "  ✓ Cert mophong đã cấp"
else
    echo "  ✓ Cert mophong đã tồn tại"
fi

# Kiểm tra cert taplai  
if [ ! -f "${CERTBOT_DIR}/conf/live/taplai.thayduydaotaolaixe.com/fullchain.pem" ]; then
    echo "  → Cấp cert cho taplai.thayduydaotaolaixe.com..."
    docker run --rm \
        -v "${CERTBOT_DIR}/conf:/etc/letsencrypt" \
        -v "${CERTBOT_DIR}/www:/var/www/certbot" \
        certbot/certbot certonly --webroot \
        -w /var/www/certbot \
        -d taplai.thayduydaotaolaixe.com \
        --non-interactive --agree-tos \
        --email admin@thayduydaotaolaixe.com
    echo "  ✓ Cert taplai đã cấp"
else
    echo "  ✓ Cert taplai đã tồn tại"
fi

# ── Step 4: Reload nginx ──
echo ""
echo "▶ [5/6] Reload nginx..."
cd /Volumes/Data\ -\ 3/thayduy-crm

# Copy nginx config đã update
docker exec thayduy-nginx nginx -t && \
    docker exec thayduy-nginx nginx -s reload
echo "  ✓ Nginx đã reload"

# ── Step 5: Xác minh ──
echo ""
echo "▶ [6/6] Xác minh..."
echo ""

# Kiểm tra containers
echo "📦 Docker containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(taplai|mophong|nginx)"

echo ""
echo "🔐 SSL Certificates:"
echo "  taplai:"
openssl s_client -connect taplai.thayduydaotaolaixe.com:443 -servername taplai.thayduydaotaolaixe.com </dev/null 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null || echo "  ⚠ Không thể kiểm tra cert taplai"
echo "  mophong:"
openssl s_client -connect mophong.thayduydaotaolaixe.com:443 -servername mophong.thayduydaotaolaixe.com </dev/null 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null || echo "  ⚠ Không thể kiểm tra cert mophong"

echo ""
echo "🌐 HTTP Status:"
curl -so /dev/null -w "  taplai: %{http_code} (redirect→%{redirect_url})\n" http://taplai.thayduydaotaolaixe.com/ || true
curl -sk -o /dev/null -w "  mophong: %{http_code}\n" https://mophong.thayduydaotaolaixe.com/ || true

echo ""
echo "=========================================="
echo " ✅ Hoàn tất! Kiểm tra lại trên trình duyệt:"
echo "   https://taplai.thayduydaotaolaixe.com"
echo "   https://mophong.thayduydaotaolaixe.com"
echo "=========================================="
