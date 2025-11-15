# Troubleshooting Guide

## Database Connection Errors (ECONNREFUSED)

If you see errors like:
```
Failed to load job settings from database {"error":{"query":"select ..."}}
cause":{"code":"ECONNREFUSED"}
```

### Root Cause
PostgreSQL database is not running or connection configuration is incorrect.

### Solution Steps

1. **Verify PostgreSQL is installed and running:**
   ```bash
   # Check if PostgreSQL is running
   psql --version

   # Start PostgreSQL (macOS with Homebrew)
   brew services start postgresql@14

   # Or on Linux
   sudo systemctl start postgresql
   ```

2. **Check your .env.local file exists and has correct database URL:**
   ```bash
   # The file should contain (if using Docker):
   DATABASE_URL="postgresql://postgres:postgres@localhost:5434/b0t_dev"
   REDIS_URL="redis://localhost:6380"
   ```

3. **Create the database if it doesn't exist:**
   ```bash
   # Connect to PostgreSQL
   psql postgres

   # Create the database
   CREATE DATABASE b0t;

   # Exit
   \q
   ```

4. **Run database migrations:**
   ```bash
   npm run db:push
   ```

5. **Verify Redis is running (required for BullMQ):**
   ```bash
   # Start Redis (macOS with Homebrew)
   brew services start redis

   # Or on Linux
   sudo systemctl start redis
   ```

6. **Restart the application:**
   ```bash
   npm run dev:full
   ```

### Quick Setup for New Installs

If this is your first time setting up the project:

**Option 1: Automated Setup (Recommended - uses Docker)**
```bash
# Run the automated setup script
npm run setup

# Then start the dev server
npm run dev:full
```

**Option 2: Manual Setup (using local PostgreSQL/Redis)**
```bash
# 1. Copy example env file
cp .env.example .env.local

# 2. Edit .env.local with your database credentials
# DATABASE_URL="postgresql://postgres:password@localhost:5432/b0t"
# REDIS_URL="redis://localhost:6379"

# 3. Ensure PostgreSQL and Redis are running
brew services start postgresql@14
brew services start redis

# 4. Create database
createdb b0t

# 5. Run migrations
npm run db:push

# 6. Start the application
npm run dev
```

**Option 3: Using Docker (Recommended)**
```bash
# 1. Run setup script (installs everything)
npm run setup

# 2. Start development
npm run dev:full

# The Docker setup uses:
# - PostgreSQL on port 5434
# - Redis on port 6380
```

### Still Having Issues?

Check the following:
- Database credentials in .env.local are correct
- PostgreSQL is accepting connections on the configured port (default: 5432)
- Firewall is not blocking database connections
- Database user has proper permissions

Run this to test the connection:
```bash
psql $DATABASE_URL
```
