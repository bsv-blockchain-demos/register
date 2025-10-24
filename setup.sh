#!/bin/bash
# BlockMed Setup Script
# One-command setup for new developers

set -e

# Colors for output
BLUE='\033[1;34m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  BlockMed Prescription Management System Setup      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "Makefile" ]; then
    echo -e "${RED}❌ Error: Please run this script from the register directory${NC}"
    exit 1
fi

# Step 1: Check for QuarkID packages
echo -e "${BLUE}📦 Step 1/6: Checking QuarkID packages...${NC}"
if [ ! -d "../Paquetes-NPMjs" ]; then
    echo -e "${YELLOW}  QuarkID packages not found. Cloning...${NC}"
    cd .. && git clone git@github.com:jonesjBSV/Paquetes-NPMjs.git
    cd register
    echo -e "${GREEN}  ✓ QuarkID packages cloned${NC}"
else
    echo -e "${GREEN}  ✓ QuarkID packages already exist${NC}"
    echo -e "  ${BLUE}Pulling latest changes...${NC}"
    cd ../Paquetes-NPMjs && git stash && git pull && (git stash pop || true) && cd ../register
    echo -e "${GREEN}  ✓ QuarkID packages updated${NC}"
fi

# Step 2: Install QuarkID dependencies
echo ""
echo -e "${BLUE}📦 Step 2/6: Installing QuarkID dependencies...${NC}"
echo -e "  ${BLUE}Cleaning yarn cache to ensure fresh install...${NC}"
cd ../Paquetes-NPMjs && yarn cache clean && yarn install
cd ../register
echo -e "${GREEN}  ✓ QuarkID dependencies installed${NC}"

# Step 3: Build QuarkID packages
echo ""
echo -e "${BLUE}🔨 Step 3/6: Building QuarkID packages...${NC}"
cd ../Paquetes-NPMjs && yarn workspaces run build
cd ../register
echo -e "${GREEN}  ✓ QuarkID packages built${NC}"

# Step 4: Install project dependencies
echo ""
echo -e "${BLUE}📦 Step 4/6: Installing project dependencies...${NC}"
echo -e "  ${BLUE}Installing backend...${NC}"
cd back && yarn install && cd ..
echo -e "  ${BLUE}Installing frontend...${NC}"
cd front && yarn install && cd ..
echo -e "  ${BLUE}Installing overlay...${NC}"
cd overlay && yarn install && cd ..
echo -e "${GREEN}  ✓ All dependencies installed${NC}"

# Step 5: Setup environment files
echo ""
echo -e "${BLUE}⚙️  Step 5/7: Setting up environment files...${NC}"

# Root .env for Docker
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "  ${GREEN}✓ Created .env from example (for Docker)${NC}"
    else
        echo -e "  ${YELLOW}⚠️  No .env.example found${NC}"
    fi
else
    echo -e "  ${GREEN}✓ Root .env already exists${NC}"
fi

# Backend .env
if [ ! -f "back/.env" ]; then
    if [ -f "back/env.example" ]; then
        cp back/env.example back/.env
        echo -e "  ${GREEN}✓ Created back/.env from example${NC}"
    else
        echo -e "  ${YELLOW}⚠️  No env.example found for backend${NC}"
    fi
else
    echo -e "  ${GREEN}✓ Backend .env already exists${NC}"
fi

# Backend .env.docker for Docker deployment
if [ ! -f "back/.env.docker" ]; then
    if [ -f "back/.env.docker.example" ]; then
        cp back/.env.docker.example back/.env.docker
        echo -e "  ${GREEN}✓ Created back/.env.docker from example${NC}"
    else
        echo -e "  ${YELLOW}⚠️  No .env.docker.example found for backend${NC}"
    fi
else
    echo -e "  ${GREEN}✓ Backend .env.docker already exists${NC}"
fi

# Frontend .env
if [ ! -f "front/.env" ]; then
    if [ -f "front/env.example" ]; then
        cp front/env.example front/.env
        echo -e "  ${GREEN}✓ Created front/.env from example${NC}"
    else
        echo -e "  ${YELLOW}⚠️  No env.example found for frontend${NC}"
    fi
else
    echo -e "  ${GREEN}✓ Frontend .env already exists${NC}"
fi

# Step 6: Check for existing keys or generate new ones
echo ""
echo -e "${BLUE}🔑 Step 6/7: Setting up BSV wallet keys...${NC}"

# Check if keys already exist in back/.env
MEDICAL_LICENSE_CERTIFIER=""
PLATFORM_FUNDING_KEY=""

if [ -f "back/.env" ]; then
    MEDICAL_LICENSE_CERTIFIER=$(grep "^MEDICAL_LICENSE_CERTIFIER=" back/.env | cut -d '=' -f2 | grep -v "your_")
    PLATFORM_FUNDING_KEY=$(grep "^PLATFORM_FUNDING_KEY=" back/.env | cut -d '=' -f2 | grep -v "your_")
fi

# Generate new keys only if they don't exist
if [ -z "$MEDICAL_LICENSE_CERTIFIER" ] || [ -z "$PLATFORM_FUNDING_KEY" ]; then
    echo -e "  ${YELLOW}Keys not found, generating new keys...${NC}"
    cd back && npx tsx src/scripts/generate-keys.ts && cd ..
    echo -e "  ${GREEN}✓ New BSV keys generated and saved to back/.env${NC}"

    # Re-extract the newly generated keys
    if [ -f "back/.env" ]; then
        MEDICAL_LICENSE_CERTIFIER=$(grep "^MEDICAL_LICENSE_CERTIFIER=" back/.env | cut -d '=' -f2)
        PLATFORM_FUNDING_KEY=$(grep "^PLATFORM_FUNDING_KEY=" back/.env | cut -d '=' -f2)
    fi
else
    echo -e "  ${GREEN}✓ Existing BSV keys found in back/.env${NC}"
fi

# Step 7: Sync keys to all required .env files
echo ""
echo -e "${BLUE}🔄 Step 7/7: Syncing keys to all config files...${NC}"
if [ ! -z "$MEDICAL_LICENSE_CERTIFIER" ] && [ ! -z "$PLATFORM_FUNDING_KEY" ]; then

    # Update root .env if it exists
    if [ -f ".env" ]; then
        if [ ! -z "$MEDICAL_LICENSE_CERTIFIER" ]; then
            sed -i.bak "s|^MEDICAL_LICENSE_CERTIFIER=.*|MEDICAL_LICENSE_CERTIFIER=$MEDICAL_LICENSE_CERTIFIER|" .env
            echo -e "  ${GREEN}✓ Updated MEDICAL_LICENSE_CERTIFIER in root .env${NC}"
        fi

        if [ ! -z "$PLATFORM_FUNDING_KEY" ]; then
            sed -i.bak "s|^PLATFORM_FUNDING_KEY=.*|PLATFORM_FUNDING_KEY=$PLATFORM_FUNDING_KEY|" .env
            echo -e "  ${GREEN}✓ Updated PLATFORM_FUNDING_KEY in root .env${NC}"
        fi
        rm -f .env.bak
    fi

    # Update back/.env.docker if it exists
    if [ -f "back/.env.docker" ]; then
        if [ ! -z "$MEDICAL_LICENSE_CERTIFIER" ]; then
            sed -i.bak "s|^MEDICAL_LICENSE_CERTIFIER=.*|MEDICAL_LICENSE_CERTIFIER=$MEDICAL_LICENSE_CERTIFIER|" back/.env.docker
            echo -e "  ${GREEN}✓ Updated MEDICAL_LICENSE_CERTIFIER in back/.env.docker${NC}"
        fi

        if [ ! -z "$PLATFORM_FUNDING_KEY" ]; then
            sed -i.bak "s|^PLATFORM_FUNDING_KEY=.*|PLATFORM_FUNDING_KEY=$PLATFORM_FUNDING_KEY|" back/.env.docker
            echo -e "  ${GREEN}✓ Updated PLATFORM_FUNDING_KEY in back/.env.docker${NC}"
        fi
        rm -f back/.env.docker.bak
    fi
else
    echo -e "  ${YELLOW}⚠️  Could not sync keys (back/.env missing)${NC}"
fi

# Success message
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Setup Complete!                                 ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════���══════════════╝${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo -e "  ${BLUE}1. Start all services with Docker:${NC}"
echo -e "     ${GREEN}make docker-up${NC}"
echo ""
echo -e "  ${BLUE}   OR start services locally:${NC}"
echo -e "     ${GREEN}make run${NC}"
echo ""
echo -e "${YELLOW}Services will be available at:${NC}"
echo -e "  ${BLUE}Frontend:${NC}  http://localhost:5174"
echo -e "  ${BLUE}Backend:${NC}   http://localhost:3000"
echo -e "  ${BLUE}Overlay:${NC}   http://localhost:8080"
echo ""
echo -e "${YELLOW}Note:${NC} BSV keys have been automatically generated."
echo ""
echo -e "${YELLOW}Optional: Seed test data (requires backend running)${NC}"
echo -e "  1. Start backend: ${GREEN}make run-backend${NC} (or ${GREEN}make docker-up${NC})"
echo -e "  2. In another terminal: ${GREEN}cd back && npx tsx src/scripts/seedActors.ts${NC}"
echo ""
echo -e "${YELLOW}Fund platform wallet (when needed):${NC}"
echo -e "  ${GREEN}cd back && npx tsx src/scripts/fund-platform.ts${NC}"
echo ""
echo -e "${YELLOW}For more commands, run:${NC} ${GREEN}make help${NC}"
echo ""