#!/bin/bash

# DDN RAG v2 Installation Script
# ================================

set -e

echo "========================================"
echo "  DDN RAG v2 - Installation Script"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory (where install.sh is located)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check Python version
echo -e "${YELLOW}Checking Python version...${NC}"
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    echo -e "${GREEN}✓ Python $PYTHON_VERSION found${NC}"
else
    echo -e "${RED}✗ Python 3 not found. Please install Python 3.9+${NC}"
    exit 1
fi

# Check Node.js version
echo -e "${YELLOW}Checking Node.js version...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Node.js $NODE_VERSION found${NC}"
else
    echo -e "${RED}✗ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

echo ""
echo "========================================"
echo "  Installing Backend"
echo "========================================"
echo ""

# Change to backend directory
cd "$SCRIPT_DIR/backend"

# Remove existing venv if corrupted
if [ -d "venv" ] && [ ! -f "venv/bin/activate" ]; then
    echo -e "${YELLOW}Removing corrupted venv...${NC}"
    rm -rf venv
fi

# Create virtual environment only if it doesn't exist
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating Python virtual environment...${NC}"
    python3 -m venv venv
else
    echo -e "${GREEN}✓ Virtual environment already exists${NC}"
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
echo -e "${YELLOW}Upgrading pip...${NC}"
pip install --upgrade pip --quiet

# Install dependencies
echo -e "${YELLOW}Installing Python dependencies...${NC}"
pip install -r requirements.txt --quiet

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env from template...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit backend/.env and add your NVIDIA_API_KEY${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

echo -e "${GREEN}✓ Backend installation complete${NC}"

# Deactivate virtual environment before moving to frontend
deactivate

echo ""
echo "========================================"
echo "  Installing Frontend"
echo "========================================"
echo ""

cd "$SCRIPT_DIR/frontend"

# Install npm dependencies
echo -e "${YELLOW}Installing Node.js dependencies...${NC}"
npm install --silent

echo -e "${GREEN}✓ Frontend installation complete${NC}"

echo ""
echo "========================================"
echo "  Installation Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Edit backend/.env and add your NVIDIA_API_KEY:"
echo "   ${YELLOW}nano $SCRIPT_DIR/backend/.env${NC}"
echo ""
echo "2. Start the backend:"
echo "   ${YELLOW}cd $SCRIPT_DIR/backend && source venv/bin/activate && python main.py${NC}"
echo ""
echo "3. Start the frontend (in a new terminal):"
echo "   ${YELLOW}cd $SCRIPT_DIR/frontend && npm run dev${NC}"
echo ""
echo "4. Open in browser:"
echo "   ${GREEN}http://localhost:5173${NC}"
echo ""
echo "API docs available at: ${GREEN}http://localhost:8000/docs${NC}"
echo ""
