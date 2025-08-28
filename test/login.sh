#!/bin/bash

SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config/config.sh"

# Perform login request
RESPONSE=$(curl --silent --request POST \
  --url "https://api.opensubtitles.com/api/v1/login" \
  --header "Accept: application/json" \
  --header "Api-Key: $API_KEY" \
  --header "Content-Type: application/json" \
  --header "User-Agent: $AGENT" \
  --data '{
    "username": "'"$USERNAME"'",
    "password": "'"$PASSWORD"'"
  }')

# Extract token from response
TOKEN=$(echo "$RESPONSE" | jq -r '.token')

# Check if token was retrieved
if [[ "$TOKEN" == "null" || -z "$TOKEN" ]]; then
  echo "Login failed: No token received"
  echo "Response was:"
  echo "$RESPONSE" | jq
  exit 1
fi

# Save token to file
echo "$TOKEN" > "$TOKEN_FILE"
echo "Token saved to $TOKEN_FILE"
echo "$RESPONSE" | jq