#!/bin/bash

# Exit on error
set -e

# Check for required tools
command -v python3 >/dev/null 2>&1 || { echo >&2 "Python3 is required but not installed. Aborting."; exit 1; }
command -v pip3 >/dev/null 2>&1 || { echo >&2 "pip3 is required but not installed. Aborting."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo >&2 "npm is required but not installed. Aborting."; exit 1; }

# Load environment variables from .env if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Helper function to check, prompt, export, and save env vars
env_prompt_and_save() {
  VAR_NAME="$1"
  VAR_PROMPT="$2"
  VAR_VALUE="${!VAR_NAME}"
  if [ -z "$VAR_VALUE" ]; then
    read -p "$VAR_PROMPT" VAR_VALUE
    export $VAR_NAME="$VAR_VALUE"
    # Add or update in .env
    if grep -q "^$VAR_NAME=" .env 2>/dev/null; then
      sed -i '' "s/^$VAR_NAME=.*/$VAR_NAME=$VAR_VALUE/" .env
    else
      echo "$VAR_NAME=$VAR_VALUE" >> .env
    fi
  else
    export $VAR_NAME="$VAR_VALUE"
  fi
}

env_prompt_and_save "CO_API_KEY" "Please enter your Cohere API key: "

# Install Python dependencies
cd api
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cd ..

# Install Node dependencies
cd frontend
npm install
cd ..

# Run both servers concurrently
# Flask dev server (with reload) on port 3333, Vite dev server on port 3000
# Use 'wait' to keep both running, or 'concurrently' if available

start_api() {
  cd api
  source .venv/bin/activate
  export FLASK_APP=app.py
  export FLASK_ENV=development
  export CO_API_KEY="$CO_API_KEY"
  flask run --port=3333
}

start_fe() {
  cd frontend
  npm run dev
}

# If 'concurrently' is installed globally, use it for better UX
if command -v concurrently >/dev/null 2>&1; then
  concurrently -k -n "API,FE" -c "blue,green" "bash -c 'cd api && source .venv/bin/activate && export FLASK_APP=app.py && export FLASK_ENV=development && export CO_API_KEY=\"$CO_API_KEY\" && flask run --port=3333'" "bash -c 'cd frontend && npm run dev'"
else
  echo "Tip: Install 'concurrently' globally for better logs: npm install -g concurrently"
  start_api &
  API_PID=$!
  start_fe &
  FE_PID=$!
  trap "kill $API_PID $FE_PID" EXIT
  wait $API_PID $FE_PID
fi
