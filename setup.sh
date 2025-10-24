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

# Create master .env from example if it doesn't exist
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "  ${GREEN}✓ Created master .env from example${NC}"
    else
        echo -e "  ${YELLOW}⚠️  No .env.example found${NC}"
    fi
else
    echo -e "  ${GREEN}✓ Master .env already exists${NC}"
fi

# Create symlinks from component directories to master .env
echo -e "  ${BLUE}Creating environment symlinks...${NC}"
(cd back && npx tsx src/scripts/sync-env.ts > /dev/null 2>&1)
if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✓ Environment symlinks created (back, front, overlay)${NC}"
else
    echo -e "  ${YELLOW}⚠️  Failed to create symlinks, will use copies instead${NC}"
    # Fallback: copy .env to each location
    [ -f ".env" ] && cp .env back/.env && echo -e "  ${GREEN}✓ Copied .env to back/${NC}"
    [ -f ".env" ] && cp .env front/.env && echo -e "  ${GREEN}✓ Copied .env to front/${NC}"
    [ -f ".env" ] && cp .env overlay/local-data/.env && echo -e "  ${GREEN}✓ Copied .env to overlay/local-data/${NC}"
fi

# Step 6: Check for existing keys or generate new ones
echo ""
echo -e "${BLUE}🔑 Step 6/7: Setting up BSV wallet keys...${NC}"

# Check if keys already exist in master .env
MEDICAL_LICENSE_CERTIFIER=""
PLATFORM_FUNDING_KEY=""

if [ -f ".env" ]; then
    MEDICAL_LICENSE_CERTIFIER=$(grep "^MEDICAL_LICENSE_CERTIFIER=" .env | cut -d '=' -f2 | grep -v "your_")
    PLATFORM_FUNDING_KEY=$(grep "^PLATFORM_FUNDING_KEY=" .env | cut -d '=' -f2 | grep -v "your_")
fi

# Generate new keys only if they don't exist
if [ -z "$MEDICAL_LICENSE_CERTIFIER" ] || [ -z "$PLATFORM_FUNDING_KEY" ]; then
    echo -e "  ${YELLOW}Keys not found, generating new keys...${NC}"
    (cd back && npx tsx src/scripts/generate-keys.ts)
    if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}✓ New BSV keys generated and saved to master .env${NC}"
    else
        echo -e "  ${RED}✗ Failed to generate keys${NC}"
        exit 1
    fi
else
    echo -e "  ${GREEN}✓ Existing BSV keys found in master .env${NC}"
fi

# Step 7: Re-sync environment files after key generation
echo ""
echo -e "${BLUE}🔄 Step 7/7: Syncing environment files...${NC}"
(cd back && npx tsx src/scripts/sync-env.ts > /dev/null 2>&1)
if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✓ Environment files synced${NC}"
else
    echo -e "  ${YELLOW}⚠️  Symlink sync failed, using copies${NC}"
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