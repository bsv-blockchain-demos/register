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
fi

# Step 2: Install QuarkID dependencies
echo ""
echo -e "${BLUE}📦 Step 2/6: Installing QuarkID dependencies...${NC}"
cd ../Paquetes-NPMjs && yarn install
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
echo -e "${BLUE}⚙️  Step 5/6: Setting up environment files...${NC}"

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

# Step 6: Generate BSV keys
echo ""
echo -e "${BLUE}🔑 Step 6/6: Generating BSV wallet keys...${NC}"
cd back && npx tsx src/scripts/generate-keys.ts && cd ..
echo -e "${GREEN}  ✓ BSV keys generated and saved to .env${NC}"

# Success message
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Setup Complete!                                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo -e "  ${BLUE}1. Fund your platform wallet:${NC}"
echo -e "     ${GREEN}cd back && npx tsx src/scripts/fund-platform.ts${NC}"
echo ""
echo -e "  ${BLUE}2. Start all services with Docker:${NC}"
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
echo -e "${YELLOW}For more commands, run:${NC} ${GREEN}make help${NC}"
echo ""