# Docker Setup Guide for BlockMed Register

## Overview

This project supports running with Docker Compose for a complete containerized environment including:
- **MongoDB** - Database for backend
- **MySQL** - Database for overlay service
- **Backend API** - Express/TypeScript application
- **Frontend** - React/Vite application
- **Overlay Service** - LARS (Local ARC Routing Service)
- **Adminer** - MySQL database admin
- **Mongo Express** - MongoDB database admin

---

## Prerequisites

1. **Docker** & **Docker Compose** installed
   ```bash
   docker --version  # Should be 20.10+
   docker-compose --version  # Should be 1.29+
   ```

2. **Environment Setup**
   - Ensure you have `.env` file in the `register/` directory
   - Required for BSV keys and configuration

---

## Quick Start

### 1. Build and Start All Services

```bash
cd /Users/jake/Desktop/quarkID/Paquetes-NPMjs/register
docker-compose up --build
```

This will:
- Build all Docker images
- Start all services
- Create necessary networks and volumes

### 2. Access the Applications

Once running, access:

- **Frontend**: http://localhost:5174
- **Backend API**: http://localhost:3000
- **Overlay Service**: http://localhost:8080
- **Adminer** (MySQL): http://localhost:8081
- **Mongo Express**: http://localhost:8082

---

## Docker Compose Services

### Core Services

#### `db-mongo`
- **Image**: `mongo:6.0`
- **Port**: `27017`
- **Purpose**: MongoDB database for backend and overlay
- **Data**: Persisted in `./data/mongo`

#### `db-mysql`
- **Image**: `mysql:8.0`
- **Port**: `3306`
- **Purpose**: MySQL database for overlay service
- **Data**: Persisted in `./data/mysql`
- **Credentials**:
  - User: `overlayAdmin`
  - Password: `overlay123`
  - Database: `overlay`

#### `backend`
- **Build**: `back/Dockerfile`
- **Port**: `3000`
- **Dependencies**: MongoDB, Overlay
- **Environment**: See `docker-compose.yml`

#### `frontend`
- **Build**: `front/Dockerfile`
- **Port**: `5174` (mapped to 80 internally)
- **Dependencies**: Backend

#### `overlay`
- **Build**: `overlay/local-data/overlay-dev-container/Dockerfile`
- **Port**: `8080`
- **Dependencies**: MongoDB, MySQL
- **Purpose**: BSV overlay network service (LARS)

### Admin Interfaces

#### `adminer`
- **Port**: `8081`
- **Purpose**: MySQL web interface
- **Access**: http://localhost:8081

#### `mongoexpress`
- **Port**: `8082`
- **Purpose**: MongoDB web interface
- **Access**: http://localhost:8082

---

## Common Commands

### Start Services
```bash
# Start all services in foreground
docker-compose up

# Start all services in background
docker-compose up -d

# Start specific service
docker-compose up backend
```

### Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes all data)
docker-compose down -v
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Rebuild After Code Changes
```bash
# Rebuild specific service
docker-compose up --build backend

# Rebuild all services
docker-compose up --build
```

### Restart Service
```bash
docker-compose restart backend
docker-compose restart frontend
```

---

## Fixes Applied for Yarn Workspaces

### Issue
The Docker build was failing with:
```
error Error: EEXIST: file already exists, symlink '../../../../../../../../../../Paquetes-NPMjs/packages/did/core'
```

### Root Cause
- Yarn workspaces were trying to create symlinks that already existed
- `--frozen-lockfile` flag was preventing cleanup
- Multiple nested `node_modules` causing conflicts

### Solutions Applied

#### 1. Removed `--frozen-lockfile` Flag
Changed from:
```dockerfile
yarn install --frozen-lockfile
```
To:
```dockerfile
yarn install --force
```

#### 2. Added Explicit Cleanup
Added before workspace install:
```dockerfile
RUN rm -rf /app/register/front/node_modules
RUN rm -rf /app/register/back/node_modules
```

#### 3. Updated .dockerignore
Ensured `node_modules` are excluded but `yarn.lock` is included:
```
# Exclude node_modules
node_modules
*/node_modules
**/node_modules

# Keep yarn.lock (DO NOT exclude this)
```

---

## Troubleshooting

### Port Conflicts

**Problem**: Port already in use
```
ERROR: for backend  Cannot start service backend: Ports are not available
```

**Solution**: Stop conflicting services
```bash
# Check what's using the port
lsof -i :3000
lsof -i :5174
lsof -i :8080

# Kill the process or stop local services
make # if running locally
```

### Build Failures

**Problem**: Yarn workspace symlink errors

**Solution**:
```bash
# Clean everything
docker-compose down -v
docker system prune -f

# Remove local node_modules
cd /Users/jake/Desktop/quarkID/Paquetes-NPMjs/register
rm -rf back/node_modules front/node_modules

# Rebuild
docker-compose up --build
```

### Database Connection Issues

**Problem**: Backend can't connect to MongoDB

**Solution**:
```bash
# Check if MongoDB is healthy
docker-compose ps

# View MongoDB logs
docker-compose logs db-mongo

# Restart MongoDB
docker-compose restart db-mongo
```

### Memory Issues

**Problem**: Docker running out of memory

**Solution**:
1. Increase Docker memory in Docker Desktop settings
2. Or build services one at a time:
```bash
docker-compose up -d db-mongo db-mysql
docker-compose up -d overlay
docker-compose up -d backend
docker-compose up -d frontend
```

---

## Development Workflow

### Making Code Changes

1. **Frontend changes**: Hot reload is enabled
   ```bash
   # Edit files in front/src/
   # Changes reflect automatically
   ```

2. **Backend changes**: Auto-restart with tsx
   ```bash
   # Edit files in back/src/
   # Backend restarts automatically
   ```

3. **Dependency changes**: Rebuild required
   ```bash
   docker-compose up --build backend
   # or
   docker-compose up --build frontend
   ```

### Seeding Database

```bash
# Enter backend container
docker-compose exec backend sh

# Run seed scripts
cd /app/register/back
npx tsx src/scripts/clearActors.ts
npx tsx src/scripts/seedActors.ts
```

### Viewing Database

**MongoDB**:
- Open http://localhost:8082
- Or use MongoDB Compass: `mongodb://localhost:27017`

**MySQL**:
- Open http://localhost:8081
- Server: `db-mysql`
- Username: `overlayAdmin`
- Password: `overlay123`

---

## Environment Variables

Required in `.env` file:

```env
# BSV Configuration
PLATFORM_FUNDING_KEY=<your-private-key>
PLATFORM_FUNDING_ADDRESS=<your-address>

# Overlay Configuration
OVERLAY_PROVIDER_URL=http://overlay:8080

# Database (automatically set in docker-compose)
MONGODB_URI=mongodb://db-mongo:27017
APP_DB_NAME=quarkid_prescriptions_db
```

---

## Production Deployment

### Single Container Deployment

Use the single-container Dockerfile:

```bash
# Build from parent directory
cd /Users/jake/Desktop/quarkID/Paquetes-NPMjs
docker build -t blockmed-register -f register/Dockerfile .

# Run
docker run -d \
  -p 80:80 \
  -p 3000:3000 \
  --name blockmed \
  -e MONGODB_URI=mongodb://host.docker.internal:27017 \
  blockmed-register
```

This includes:
- MongoDB (embedded)
- Backend
- Frontend (nginx)
- All running in one container

---

## Network Architecture

```
┌─────────────────────────────────────┐
│      quarkid-network (bridge)       │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────┐    ┌──────────┐     │
│  │ db-mongo │    │ db-mysql │     │
│  │  :27017  │    │  :3306   │     │
│  └────┬─────┘    └────┬─────┘     │
│       │               │            │
│  ┌────┴───────────────┴─────┐     │
│  │      overlay :8080        │     │
│  └────────────┬──────────────┘     │
│               │                    │
│  ┌────────────┴──────────┐         │
│  │    backend :3000      │         │
│  └────────────┬──────────┘         │
│               │                    │
│  ┌────────────┴──────────┐         │
│  │   frontend :5174      │         │
│  └───────────────────────┘         │
│                                     │
└─────────────────────────────────────┘
```

---

## Summary

**To run the project with Docker**:
```bash
cd /Users/jake/Desktop/quarkID/Paquetes-NPMjs/register
docker-compose up --build
```

**To stop**:
```bash
docker-compose down
```

**To reset everything**:
```bash
docker-compose down -v
docker system prune -f
```

All services are now configured to use **yarn only** with proper workspace symlink handling.
