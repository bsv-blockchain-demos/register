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
	@if [ ! -f $(BACKEND_DIR)/.env ]; then \
		cp $(BACKEND_DIR)/env.example $(BACKEND_DIR)/.env 2>/dev/null || echo "$(YELLOW)⚠️  No .env.example found in backend$(NC)"; \
	else \
		echo "$(GREEN)✓ Backend .env already exists$(NC)"; \
	fi
	@if [ ! -f $(FRONTEND_DIR)/.env ]; then \
		cp $(FRONTEND_DIR)/env.example $(FRONTEND_DIR)/.env 2>/dev/null || echo "$(YELLOW)⚠️  No .env.example found in frontend$(NC)"; \
	else \
		echo "$(GREEN)✓ Frontend .env already exists$(NC)"; \
	fi
	@echo "$(BLUE) Generate keys and update .env using TypeScript...$(NC)"
	@echo "$(BLUE)🔑 Generating BSV keys...$(NC)"
	@cd $(BACKEND_DIR) && npx tsx src/scripts/generate-keys.ts
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

# OverlayDocker helpers
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
