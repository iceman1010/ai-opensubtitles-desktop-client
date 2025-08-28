#!/bin/bash

# folders for configuration and test media assets
CONFIG_DIR="$(dirname "$0")/config"
ASSETS_DIR="$(dirname "$0")/assets"
# Configuration
API_KEY="XXXXXXXXXXXXXXXXXXXXXXXXX"
USERNAME="XXXXXXXXXX"
PASSWORD="XXXXXXXX"
TOKEN_FILE="$CONFIG_DIR/auth_token.txt"
CORRELATION_ID_FILE="$CONFIG_DIR/correlation_id.txt"
AGENT="API_Test_AI.OS"

# DEV Setting
# Direct access, override 3rd party auth, only works if debug mode is enabled

# URL_ADDON is for my Test User, this works only if the 'allow_debug' flag is set of the OS_API_Controller class, and should not be used in production
# if this flag is not set you will get errors like this: 'Please login again, your authorization token is invalid ...'
URL_ADDON="?JSON_PRETTY=1&os_id=797817&os_login=ai_testuser_1"
URL_BASE="https://ai.opensubtitles.com/api/os/v1"

# Production Setting, Proxy / Kong Access, not really good for debugging
# URL_ADDON="?JSON_PRETTY=1"
# URL_BASE="https://api.opensubtitles.com/api/v1/ai"

# Read last generated Token from OS login 
TOKEN=$(cat $TOKEN_FILE)

# Read last correlation_id from RPC function
CORRELATION_ID=$(cat $CORRELATION_ID_FILE)

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: 'jq' command is not installed. Please install it and try again."
    exit 1
fi
