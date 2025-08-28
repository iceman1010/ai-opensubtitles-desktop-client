#!/bin/bash
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config/config.sh"

response=$(curl --silent --request POST \
  --url "$URL_BASE/headers$URL_ADDON" \
  --header "Api-Key: $API_KEY" \
  --header "Authorization: Bearer $TOKEN" \
  --header 'kong-debug: 1' \
  --header "User-Agent: $AGENT")


echo "Raw response:"
echo "$response"
echo "Trying to parse with jq:"
echo "$response" | jq .
