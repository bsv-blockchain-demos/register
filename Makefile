# BlockMed Prescription Management System Makefile
# Automates project setup and concurrent service execution

# Color codes for pretty output
BLUE := \033[1;34m
GREEN := \033[1;32m
YELLOW := \033[1;33m
RED := \033[1;31m
NC := \033[0m # No Color

# Directories
FRONTEND_DIR := front
BACKEND_DIR := back
OVERLAY_DIR := overlay
QUARKID_PACKAGES_DIR := ../Paquetes-NPMjs/packages

# Check if node_modules exist
FRONTEND_NODE_MODULES := $(FRONTEND_DIR)/node_modules
BACKEND_NODE_MODULES := $(BACKEND_DIR)/node_modules
OVERLAY_NODE_MODULES := $(OVERLAY_DIR)/node_modules

# Default target
.PHONY: all
all: install run


# Install all dependencies
.PHONY: install
install: install-quarkid build-quarkid install-frontend install-backend install-overlay
	@echo "$(GREEN)✅ All dependencies installed successfully!$(NC)"

.PHONY: install-quarkid
install-quarkid:
	@echo "$(BLUE)🔗 Installing QuarkID dependencies...$(NC)"
	@# Check if Paquetes-NPMjs exists in parent directory
	@if [ ! -d "../Paquetes-NPMjs" ]; then \
		echo "$(YELLOW)📦 Paquetes-NPMjs not found. Cloning from repository...$(NC)"; \
		cd .. && git clone git@github.com:jonesjBSV/Paquetes-NPMjs.git; \
		echo "$(GREEN)✅ Paquetes-NPMjs cloned successfully$(NC)"; \
	else \
		echo "$(GREEN)✓ Paquetes-NPMjs already exists$(NC)"; \
	fi
	@# Install QuarkID dependencies
	@echo "$(BLUE)📦 Installing QuarkID dependencies...$(NC)"
	@cd ../Paquetes-NPMjs && yarn install
	@echo "$(GREEN)✅ QuarkID dependencies installed$(NC)"

# Install frontend dependencies
.PHONY: install-frontend
install-frontend:
	@echo "$(BLUE)📦 Installing frontend dependencies...$(NC)"
	@cd $(FRONTEND_DIR) && yarn install
	@echo "$(GREEN)✅ Frontend dependencies installed$(NC)"

# Install backend dependencies
.PHONY: install-backend
install-backend:
	@echo "$(BLUE)📦 Installing backend dependencies...$(NC)"
	@cd $(BACKEND_DIR) && yarn install
	@echo "$(GREEN)✅ Backend dependencies installed$(NC)"

# Install overlay dependencies
.PHONY: install-overlay
install-overlay:
	@echo "$(BLUE)📦 Installing overlay service dependencies...$(NC)"
	@cd $(OVERLAY_DIR) && yarn install
	@echo "$(GREEN)✅ Overlay dependencies installed$(NC)"

# Run all services concurrently
.PHONY: run
run:
	@echo "$(BLUE)🚀 Starting all services...$(NC)"
	@echo "$(YELLOW)Note: Press Ctrl+C to stop all services$(NC)"
	@echo ""
	@$(MAKE) -j3 run-overlay run-backend run-frontend

# Run frontend development server
.PHONY: run-frontend
run-frontend:
	@echo "$(BLUE)[Frontend] Starting on http://localhost:5174...$(NC)"
	@cd $(FRONTEND_DIR) && npm run dev

# Run backend development server
.PHONY: run-backend
run-backend:
	@echo "$(BLUE)[Backend] Starting on http://localhost:3000...$(NC)"
	@cd $(BACKEND_DIR) && npm run dev

# Run overlay service
.PHONY: run-overlay
run-overlay:
	@echo "$(BLUE)[Overlay] Starting LARS on http://localhost:8080...$(NC)"
	@cd $(OVERLAY_DIR) && npm run start

# Run only frontend and backend (no overlay)
.PHONY: run-app
run-app:
	@echo "$(BLUE)🚀 Starting frontend and backend services...$(NC)"
	@$(MAKE) -j2 run-backend run-frontend

# Build all components
.PHONY: build
build: build-quarkidbuild-frontend build-backend build-overlay
	@echo "$(GREEN)✅ All components built successfully!$(NC)"

# Build QuarkID
.PHONY: build-quarkid
build-quarkid:
	@echo "$(BLUE)🔨 Building QuarkID...$(NC)"
	@cd ../Paquetes-NPMjs && yarn workspaces run build
	@echo "$(GREEN)✅ QuarkID built$(NC)"

# Build frontend
.PHONY: build-frontend
build-frontend:
	@echo "$(BLUE)🔨 Building frontend...$(NC)"
	@cd $(FRONTEND_DIR) && npm run build
	@echo "$(GREEN)✅ Frontend built$(NC)"

# Build backend
.PHONY: build-backend
build-backend:
	@echo "$(BLUE)🔨 Building backend...$(NC)"
	@cd $(BACKEND_DIR) && npm run build
	@echo "$(GREEN)✅ Backend built$(NC)"

# Build overlay
.PHONY: build-overlay
build-overlay:
	@echo "$(BLUE)🔨 Building overlay service...$(NC)"
	@cd $(OVERLAY_DIR) && npm run build
	@echo "$(GREEN)✅ Overlay service built$(NC)"

# Clean all node_modules and build artifacts
.PHONY: clean
clean:
	@echo "$(YELLOW)🧹 Cleaning project...$(NC)"
	@cd ../Paquetes-NPMjs && npm run clean && cd ../register
	@rm -rf $(FRONTEND_NODE_MODULES) $(BACKEND_NODE_MODULES) $(OVERLAY_NODE_MODULES)
	@rm -rf $(FRONTEND_DIR)/dist $(BACKEND_DIR)/dist
	@echo "$(GREEN)✅ Project cleaned$(NC)"


# Setup environment files
.PHONY: setup-env
setup-env:
	@echo "$(BLUE)⚙️  Setting up environment files...$(NC)"
	@# Root .env for Docker
	@if [ ! -f .env ]; then \
		if [ -f .env.example ]; then \
			cp .env.example .env; \
			echo "$(GREEN)✓ Created .env from example (for Docker)$(NC)"; \
		else \
			echo "$(YELLOW)⚠️  No .env.example found$(NC)"; \
		fi; \
	else \
		echo "$(GREEN)✓ Root .env already exists$(NC)"; \
	fi
	@# Backend .env
	@if [ ! -f $(BACKEND_DIR)/.env ]; then \
		cp $(BACKEND_DIR)/env.example $(BACKEND_DIR)/.env 2>/dev/null || echo "$(YELLOW)⚠️  No .env.example found in backend$(NC)"; \
	else \
		echo "$(GREEN)✓ Backend .env already exists$(NC)"; \
	fi
	@# Backend .env.docker for Docker deployment
	@if [ ! -f $(BACKEND_DIR)/.env.docker ]; then \
		if [ -f $(BACKEND_DIR)/.env.docker.example ]; then \
			cp $(BACKEND_DIR)/.env.docker.example $(BACKEND_DIR)/.env.docker; \
			echo "$(GREEN)✓ Created back/.env.docker from example$(NC)"; \
		else \
			echo "$(YELLOW)⚠️  No .env.docker.example found in backend$(NC)"; \
		fi; \
	else \
		echo "$(GREEN)✓ Backend .env.docker already exists$(NC)"; \
	fi
	@# Frontend .env
	@if [ ! -f $(FRONTEND_DIR)/.env ]; then \
		cp $(FRONTEND_DIR)/env.example $(FRONTEND_DIR)/.env 2>/dev/null || echo "$(YELLOW)⚠️  No .env.example found in frontend$(NC)"; \
	else \
		echo "$(GREEN)✓ Frontend .env already exists$(NC)"; \
	fi
	@echo "$(BLUE)🔑 Setting up BSV keys...$(NC)"
	@# Check if keys already exist
	@KEYS_EXIST=0; \
	if [ -f $(BACKEND_DIR)/.env ]; then \
		EXISTING_MLC=$$(grep "^MEDICAL_LICENSE_CERTIFIER=" $(BACKEND_DIR)/.env | cut -d '=' -f2 | grep -v "your_"); \
		EXISTING_PFK=$$(grep "^PLATFORM_FUNDING_KEY=" $(BACKEND_DIR)/.env | cut -d '=' -f2 | grep -v "your_"); \
		if [ ! -z "$$EXISTING_MLC" ] && [ ! -z "$$EXISTING_PFK" ]; then \
			KEYS_EXIST=1; \
			echo "$(GREEN)✓ Existing BSV keys found in back/.env$(NC)"; \
		fi; \
	fi; \
	if [ $$KEYS_EXIST -eq 0 ]; then \
		echo "$(YELLOW)Keys not found, generating new keys...$(NC)"; \
		cd $(BACKEND_DIR) && npx tsx src/scripts/generate-keys.ts; \
		echo "$(GREEN)✓ New BSV keys generated$(NC)"; \
	fi
	@# Sync keys to all required .env files
	@if [ -f $(BACKEND_DIR)/.env ]; then \
		MEDICAL_LICENSE_CERTIFIER=$$(grep "^MEDICAL_LICENSE_CERTIFIER=" $(BACKEND_DIR)/.env | cut -d '=' -f2); \
		PLATFORM_FUNDING_KEY=$$(grep "^PLATFORM_FUNDING_KEY=" $(BACKEND_DIR)/.env | cut -d '=' -f2); \
		if [ -f .env ]; then \
			if [ ! -z "$$MEDICAL_LICENSE_CERTIFIER" ]; then \
				sed -i.bak "s|^MEDICAL_LICENSE_CERTIFIER=.*|MEDICAL_LICENSE_CERTIFIER=$$MEDICAL_LICENSE_CERTIFIER|" .env; \
			fi; \
			if [ ! -z "$$PLATFORM_FUNDING_KEY" ]; then \
				sed -i.bak "s|^PLATFORM_FUNDING_KEY=.*|PLATFORM_FUNDING_KEY=$$PLATFORM_FUNDING_KEY|" .env; \
			fi; \
			rm -f .env.bak; \
			echo "$(GREEN)✓ Synced keys to root .env$(NC)"; \
		fi; \
		if [ -f $(BACKEND_DIR)/.env.docker ]; then \
			if [ ! -z "$$MEDICAL_LICENSE_CERTIFIER" ]; then \
				sed -i.bak "s|^MEDICAL_LICENSE_CERTIFIER=.*|MEDICAL_LICENSE_CERTIFIER=$$MEDICAL_LICENSE_CERTIFIER|" $(BACKEND_DIR)/.env.docker; \
			fi; \
			if [ ! -z "$$PLATFORM_FUNDING_KEY" ]; then \
				sed -i.bak "s|^PLATFORM_FUNDING_KEY=.*|PLATFORM_FUNDING_KEY=$$PLATFORM_FUNDING_KEY|" $(BACKEND_DIR)/.env.docker; \
			fi; \
			rm -f $(BACKEND_DIR)/.env.docker.bak; \
			echo "$(GREEN)✓ Synced keys to back/.env.docker$(NC)"; \
		fi; \
	fi
	@echo "$(BLUE)💰 Funding PLATFORM_FUNDING_KEY...$(NC)"
	@cd $(BACKEND_DIR) && npx tsx src/scripts/fund-platform.ts
	@echo "$(GREEN)✅ Environment files setup complete$(NC)"

# Quick start - full setup and run
.PHONY: quickstart
quickstart: install setup-env run

# Development mode - watch for changes
.PHONY: dev
dev: 
	@echo "$(BLUE)👀 Starting in development mode with hot reload...$(NC)"
	@$(MAKE) run

# Check if all services are running
.PHONY: status
status:
	@echo "$(BLUE)📊 Checking service status...$(NC)"
	@echo -n "Frontend (port 5173): "
	@curl -s http://localhost:5173 > /dev/null && echo "$(GREEN)✅ Running$(NC)" || echo "$(RED)❌ Not running$(NC)"
	@echo -n "Backend (port 3000): "
	@curl -s http://localhost:3000 > /dev/null && echo "$(GREEN)✅ Running$(NC)" || echo "$(RED)❌ Not running$(NC)"
	@echo -n "Overlay (port 8080): "
	@curl -s http://localhost:8080 > /dev/null && echo "$(GREEN)✅ Running$(NC)" || echo "$(RED)❌ Not running$(NC)"

# Lint all code
.PHONY: lint
lint:
	@echo "$(BLUE)🔍 Running linters...$(NC)"
	@cd $(FRONTEND_DIR) && npm run lint || echo "$(YELLOW)⚠️  Frontend lint warnings$(NC)"
	@cd $(BACKEND_DIR) && npm run lint || echo "$(YELLOW)⚠️  Backend lint warnings$(NC)"
	@cd $(OVERLAY_DIR) && npm run lint || echo "$(YELLOW)⚠️  Overlay lint warnings$(NC)"
	@echo "$(GREEN)✅ Linting complete$(NC)"

# Run tests
.PHONY: test
test:
	@echo "$(BLUE)🧪 Running tests...$(NC)"
	@cd $(BACKEND_DIR) && npm test 2>/dev/null || echo "$(YELLOW)⚠️  No backend tests configured$(NC)"
	@cd $(FRONTEND_DIR) && npm test 2>/dev/null || echo "$(YELLOW)⚠️  No frontend tests configured$(NC)"
	@cd $(OVERLAY_DIR) && npm test 2>/dev/null || echo "$(YELLOW)⚠️  No overlay tests configured$(NC)"

# Docker commands
.PHONY: docker-build
docker-build:
	@echo "$(BLUE)🐳 Building Docker containers...$(NC)"
	@docker-compose build
	@echo "$(GREEN)✅ Docker containers built$(NC)"

.PHONY: docker-up
docker-up:
	@echo "$(BLUE)🐳 Building base image first...$(NC)"
	@docker-compose build quarkid-base
	@echo "$(BLUE)🐳 Starting all services with Docker...$(NC)"
	@docker-compose up -d
	@echo "$(GREEN)✅ All services started$(NC)"
	@echo "$(YELLOW)Services available at:$(NC)"
	@echo "  - Frontend: http://localhost:5174"
	@echo "  - Backend:  http://localhost:3000"
	@echo "  - Overlay:  http://localhost:8080"
	@echo "  - Adminer:  http://localhost:8081"
	@echo "  - MongoExpress: http://localhost:8082"

.PHONY: docker-down
docker-down:
	@echo "$(YELLOW)🛑 Stopping Docker services...$(NC)"
	@docker-compose down
	@echo "$(GREEN)✅ Docker services stopped$(NC)"

.PHONY: docker-logs
docker-logs:
	@echo "$(BLUE)📋 Showing Docker logs...$(NC)"
	@docker-compose logs -f

.PHONY: docker-clean
docker-clean:
	@echo "$(YELLOW)🧹 Cleaning Docker resources...$(NC)"
	@docker-compose down -v --remove-orphans
	@docker system prune -f
	@echo "$(GREEN)✅ Docker resources cleaned$(NC)"

.PHONY: docker-single
docker-single:
	@echo "$(BLUE)🐳 Building single container...$(NC)"
	@cd .. && docker build -t blockmed-single -f register/Dockerfile .
	@echo "$(GREEN)✅ Single container built$(NC)"
	@echo "$(BLUE)🚀 Starting single container...$(NC)"
	@docker run -d -p 80:80 -p 3000:3000 --name blockmed blockmed-single
	@echo "$(GREEN)✅ Single container started$(NC)"
	@echo "$(YELLOW)Application available at: http://localhost$(NC)"

.PHONY: docker-single-stop
docker-single-stop:
	@echo "$(YELLOW)🛑 Stopping single container...$(NC)"
	@docker stop blockmed || true
	@docker rm blockmed || true
	@echo "$(GREEN)✅ Single container stopped$(NC)"

# OverlayDocker helpers (legacy)
.PHONY: overlay-start
overlay-start:
	@echo "$(BLUE)🐳 Starting Overlay (LARS) container...$(NC)"
	@cd $(OVERLAY_DIR) && docker-compose up -d
	@echo "$(GREEN)✅ Overlay (LARS) started on port 8080$(NC)"

.PHONY: overlay-stop
overlay-stop:
	@echo "$(YELLOW)🛑 Stopping Overlay (LARS) container...$(NC)"
	@cd $(OVERLAY_DIR) && docker-compose down
	@echo "$(GREEN)✅ Overlay (LARS) stopped$(NC)"

# Help command
.PHONY: help
help:
	@echo "$(BLUE)BlockMed Prescription Management System$(NC)"
	@echo "$(BLUE)======================================$(NC)"
	@echo ""
	@echo "$(GREEN)Quick Start:$(NC)"
	@echo "  make quickstart    - Complete setup and run all services"
	@echo "  make               - Install deps, build QuarkID, and run services"
	@echo ""
	@echo "$(GREEN)Individual Commands:$(NC)"
	@echo "  make install       - Install all dependencies"
	@echo "  make install-quarkid  - Install QuarkID dependencies"
	@echo "  make run           - Run all services concurrently"
	@echo "  make run-app       - Run only frontend and backend"
	@echo "  make build         - Build all components"
	@echo "  make clean         - Remove node_modules and build artifacts"
	@echo ""
	@echo "$(GREEN)Service Control:$(NC)"
	@echo "  make run-frontend  - Run only frontend (port 5174)"
	@echo "  make run-backend   - Run only backend (port 3000)"
	@echo "  make run-overlay   - Run only overlay service (port 8080)"
	@echo "  make status        - Check if services are running"
	@echo ""
	@echo "$(GREEN)Docker Commands:$(NC)"
	@echo "  make docker-build    - Build Docker containers"
	@echo "  make docker-up       - Start all services with Docker"
	@echo "  make docker-down     - Stop Docker services"
	@echo "  make docker-logs     - Show Docker logs"
	@echo "  make docker-clean    - Clean Docker resources"
	@echo "  make docker-single   - Build and run single container"
	@echo "  make docker-single-stop - Stop single container"
	@echo ""
	@echo "$(GREEN)Overlay (LARS):$(NC)"
	@echo "  make overlay-start   - Start Overlay (LARS) Docker containers"
	@echo "  make overlay-stop    - Stop Overlay (LARS) Docker containers"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  make dev           - Start in development mode"
	@echo "  make lint          - Run code linters"
	@echo "  make test          - Run tests"
	@echo "  make setup-env     - Setup environment files from examples"
	@echo ""
	@echo "$(YELLOW)Note: Services run on the following ports:$(NC)"
	@echo "  - Frontend: http://localhost:5174"
	@echo "  - Backend:  http://localhost:3000"
	@echo "  - Overlay:  http://localhost:8080"
	@echo "  - MongoDB:  mongodb://localhost:27017"
