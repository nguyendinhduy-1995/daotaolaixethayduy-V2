#!/bin/bash
# ======================================================
# Demo Reset Script
# One command to set up a clean demo environment
# ======================================================
set -e

echo "═══════════════════════════════════════"
echo "🚀 Demo Reset — thayduy-crm"
echo "═══════════════════════════════════════"
echo ""

# 1. Start DB services
echo "1️⃣  Starting database services..."
docker compose up -d postgres redis
echo "   Waiting for DB to be healthy..."
sleep 3

# 2. Run migrations
echo ""
echo "2️⃣  Running database migrations..."
npx prisma migrate deploy
echo "   ✅ Migrations applied"

# 3. Generate Prisma client
echo ""
echo "3️⃣  Generating Prisma client..."
npx prisma generate
echo "   ✅ Client generated"

# 4. Seed demo data
echo ""
echo "4️⃣  Seeding demo data..."
npm run seed:demo

echo ""
echo "═══════════════════════════════════════"
echo "✅ Demo environment ready!"
echo "═══════════════════════════════════════"
echo ""
echo "Start the app:  npm run dev"
echo ""
echo "Demo accounts:"
echo "  admin:     admin@thayduy.local     / Admin@123456"
echo "  page1:     page1@thayduy.local     / Admin@123456"
echo "  telesale1: telesale1@thayduy.local / Admin@123456"
echo "  finance1:  finance1@thayduy.local  / Admin@123456"
echo ""
