#!/bin/bash
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config/config.sh"

RESPONSE=$(curl --silent --request POST \
  --url "$URL_BASE/recent_activities$URL_ADDON" \
  --header "Api-Key: $API_KEY" \
  --header "Authorization: Bearer $TOKEN" \
  --header "User-Agent: $AGENT" \
  --header 'kong-debug: 1') \
  # Optional
  # --form 'api=aws'

if echo "$RESPONSE" | jq . >/dev/null 2>&1; then
  echo "$RESPONSE" | jq
else
  echo "$RESPONSE"
fi