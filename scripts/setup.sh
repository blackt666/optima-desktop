#!/bin/bash
# OPTIMA Desktop — Setup Script
set -e

echo "🤖 OPTIMA Desktop Setup"
echo "======================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check prerequisites
check() {
  if command -v "$1" &>/dev/null; then
    echo -e "${GREEN}✓${NC} $1 found"
  else
    echo -e "${RED}✗${NC} $1 not found — please install"
  fi
}

echo -e "\n${YELLOW}Checking prerequisites...${NC}"
check node
check npm
check git

# Node version
NODE_VERSION=$(node -v | cut -d. -f1 | tr -d 'v')
if [ "$NODE_VERSION" -lt 20 ]; then
  echo -e "${RED}✗ Node.js 20+ required (found $(node -v))${NC}"
  exit 1
fi
echo -e "${GREEN}✓${NC} Node.js $(node -v)"

# Check for Blender (for avatar conversion)
if [ -d "/Applications/Blender.app" ]; then
  echo -e "${GREEN}✓${NC} Blender found at /Applications/Blender.app"
  BLENDER_PYTHON=$(find "/Applications/Blender.app/Contents/Resources" -name "python3" -type f 2>/dev/null | head -1)
  if [ -n "$BLENDER_PYTHON" ]; then
    echo "  Blender Python: $BLENDER_PYTHON"
  fi
else
  echo -e "${YELLOW}⚠${NC} Blender not found — avatar conversion will require manual setup"
fi

# Install npm dependencies
echo -e "\n${YELLOW}Installing dependencies...${NC}"
npm install

# Copy .env.example
if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${GREEN}✓${NC} Created .env from template — please edit with your API keys"
else
  echo -e "${GREEN}✓${NC} .env already exists"
fi

# Create assets directories
mkdir -p assets/icons
echo -e "${GREEN}✓${NC} Created assets/icons/"

# Check if avatar exists
AVATAR_PATHS=(
  "../Downloads/sophia.fbx/rp_sophia_animated_003_idling.fbx"
  "../../Downloads/sophia.fbx/rp_sophia_animated_003_idling.fbx"
  "/Users/atillacaliskan/Downloads/sophia.fbx/rp_sophia_animated_003_idling.fbx"
)

for p in "${AVATAR_PATHS[@]}"; do
  if [ -f "$p" ]; then
    echo -e "${GREEN}✓${NC} Found Sophia FBX at $p"
    echo -e "${YELLOW}  → Run './scripts/convert-avatar.py' to convert to GLB${NC}"
    break
  fi
done

echo -e "\n${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your ElevenLabs API key"
echo "  2. Run: npm run dev"
echo "  3. Grant Microphone + Screen Recording permissions when prompted"
echo ""
