#!/bin/bash

# Quick start script for development
# Starts Docker services and Next.js dev server

set -e

echo "🚀 Starting development environment..."

# Check if port 3123 is in use and offer to kill it
if lsof -Pi :3123 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port 3123 is already in use"
    echo "💡 Kill existing process? (y/n)"
    read -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔪 Killing process on port 3123..."
        lsof -ti:3123 | xargs kill -9 2>/dev/null || true
        sleep 1
    else
        echo "⚠️  Next.js will use the next available port"
    fi
fi

# Check if Docker containers are running
if ! docker compose ps | grep -q "postgres.*running" || ! docker compose ps | grep -q "redis.*running"; then
    echo "⚠️  Docker containers not running. Starting them..."
    docker compose up -d postgres redis

    # Wait for services
    echo "⏳ Waiting for services to be ready..."
    sleep 3

    # Wait for PostgreSQL
    until docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
        echo "   Waiting for PostgreSQL..."
        sleep 1
    done

    # Wait for Redis
    until docker compose exec -T redis redis-cli ping > /dev/null 2>&1; do
        echo "   Waiting for Redis..."
        sleep 1
    done

    echo "✅ Services are ready"
fi

echo "✅ Docker services running"
echo ""
echo "📊 Service URLs:"
echo "   - App: http://localhost:3123"
echo "   - PostgreSQL: localhost:5434 (user: postgres, pass: postgres, db: b0t_dev)"
echo "   - Redis: localhost:6380"
echo "   - pgAdmin (optional): http://localhost:5050 (admin@b0t.dev/admin)"
echo "   - Redis Commander (optional): http://localhost:8081"
echo ""
echo "💡 Tips:"
echo "   - Run 'docker compose --profile debug up -d' to start pgAdmin & Redis Commander"
echo "   - Run 'npm run db:studio' to open Drizzle Studio"
echo ""
echo "🌱 Seeding admin user..."
# Load environment variables from .env.local before seeding
if [ -f .env.local ]; then
    set -a  # automatically export all variables
    source .env.local
    set +a  # stop automatically exporting
fi
npm run db:seed || true

echo ""
echo "🔧 Starting Next.js development server..."
echo ""

# Start Next.js dev server
npm run dev
