#!/bin/bash
# =============================================================================
# AI Cancer Detection System — One-Command Startup
# =============================================================================
# Starts the Flask backend (port 5000) and the React frontend (port 3000).
#
# Usage:
#     chmod +x run.sh        # only needed the first time
#     ./run.sh
#
# To stop both processes, press Ctrl+C.
# =============================================================================

set -e

# Resolve the project root (the directory containing this script)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Color codes for nicer output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  AI Cancer Detection System — Startup${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "${YELLOW}Project root:${NC} $PROJECT_ROOT"
echo ""

# ----- 1. Python dependencies -----
echo -e "${GREEN}[1/4]${NC} Checking Python dependencies..."
if ! python -c "import flask, flask_cors, tensorflow" 2>/dev/null; then
    echo -e "${YELLOW}  Installing Python dependencies (this may take a few minutes)...${NC}"
    pip install -r requirements.txt
else
    echo -e "${GREEN}  All Python dependencies are present.${NC}"
fi

# ----- 2. Generate sample images if missing -----
echo ""
echo -e "${GREEN}[2/4]${NC} Checking for sample images..."
if [ ! -f "data/samples/blood_cancer_positive_1.jpg" ]; then
    echo -e "${YELLOW}  Generating 6 sample images in data/samples/...${NC}"
    python backend/scripts/generate_sample_images.py
else
    echo -e "${GREEN}  Sample images present.${NC}"
fi

# ----- 3. Start Flask backend -----
echo ""
echo -e "${GREEN}[3/4]${NC} Starting Flask backend on http://localhost:5000 ..."
cd "$PROJECT_ROOT/backend"
python api/app.py &
BACKEND_PID=$!
cd "$PROJECT_ROOT"

# Give the backend a moment to start
sleep 3

# ----- 4. Start React frontend -----
echo ""
echo -e "${GREEN}[4/4]${NC} Starting React frontend on http://localhost:3000 ..."
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}  node_modules/ missing — running npm install (this may take a few minutes)...${NC}"
    cd "$PROJECT_ROOT/frontend"
    npm install
    cd "$PROJECT_ROOT"
fi
cd "$PROJECT_ROOT/frontend"
npm start &
FRONTEND_PID=$!
cd "$PROJECT_ROOT"

# ----- Done -----
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  System is up!${NC}"
echo -e "${BLUE}  Backend:  http://localhost:5000${NC}"
echo -e "${BLUE}  Frontend: http://localhost:3000${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers.${NC}"

# Wait for either process to exit, then clean up
trap "echo -e '${RED}Stopping...${NC}'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait $BACKEND_PID $FRONTEND_PID
