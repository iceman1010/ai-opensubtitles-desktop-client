#!/bin/bash

# folders for configuration and test media assets
CONFIG_DIR="$(dirname "$0")/config"
ASSETS_DIR="$(dirname "$0")/assets"
# Configuration
API_KEY="XXXXXXXXXXXXXXXXXXXXXXXXXX"
USERNAME="user"
PASSWORD="password"
TOKEN_FILE="$CONFIG_DIR/auth_token.txt"
CORRELATION_ID_FILE="$CONFIG_DIR/correlation_id.txt"
AGENT="API_Test_AI.OS"

# Production Setting, Proxy / Kong Access, not really good for debugging
 URL_ADDON="?JSON_PRETTY=1"
 URL_BASE="https://api.opensubtitles.com/api/v1/ai"

# Read last generated Token from OS login 
TOKEN=$(cat $TOKEN_FILE)

# Read last correlation_id from RPC function
CORRELATION_ID=$(cat $CORRELATION_ID_FILE)

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: 'jq' command is not installed. Please install it and try again."
    exit 1
fi
