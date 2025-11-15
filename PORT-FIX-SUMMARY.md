# Port Configuration Fix

## Problem
Users cloning the repo and running `npm run setup` or `npm run dev:full` were getting database connection errors (ECONNREFUSED).

## Root Cause
Port mismatch between Docker configuration and environment files:

- **Docker Compose** (`docker-compose.yml`):
  - PostgreSQL: **5434:5432** (host:container)
  - Redis: **6380:6379** (host:container)

- **Environment Files** (before fix):
  - `.env.example`: Used ports **5433** (wrong!) and **6379** (wrong!)
  - `first-time-setup.sh`: Hardcoded port **5433** (wrong!)

## Files Fixed

### 1. `scripts/first-time-setup.sh`
```diff
- DATABASE_URL=postgresql://postgres:postgres@localhost:5433/b0t_dev
- REDIS_URL=redis://localhost:6379
+ DATABASE_URL=postgresql://postgres:postgres@localhost:5434/b0t_dev
+ REDIS_URL=redis://localhost:6380
```

### 2. `.env.example`
```diff
- DATABASE_URL=postgresql://postgres:postgres@localhost:5433/b0t_dev
- REDIS_URL=redis://localhost:6379
+ DATABASE_URL=postgresql://postgres:postgres@localhost:5434/b0t_dev
+ REDIS_URL=redis://localhost:6380
```

### 3. `docker-compose.yml`
```diff
# Redis Commander config (was connecting to wrong internal port)
environment:
-  REDIS_HOSTS: local:redis:6380
+  REDIS_HOSTS: local:redis:6379
```

### 4. `scripts/dev-start.sh`
Enhanced display of service URLs for clarity

### 5. `TROUBLESHOOTING.md`
Updated with correct ports and comprehensive setup instructions

## Correct Port Mapping

**From Host (your machine) → To Container:**
- PostgreSQL: `localhost:5434` → `container:5432`
- Redis: `localhost:6380` → `container:6379`

**Connection Strings (for .env.local):**
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/b0t_dev
REDIS_URL=redis://localhost:6380
```

## Testing
For new users, the setup should now work correctly:

```bash
# Clone repo
git clone <repo-url>
cd b0t

# Run setup (Docker-based, fully automated)
npm run setup

# Start dev server
npm run dev:full
```

## Notes
- `.env.local.example` already had the correct ports (5434/6380)
- The issue only affected users following `.env.example` or relying on the auto-generated config from `first-time-setup.sh`
- Users who manually configured their `.env.local` would have encountered this immediately
