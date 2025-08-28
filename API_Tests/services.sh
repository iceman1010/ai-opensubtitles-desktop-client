#!/bin/bash
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config/config.sh"
RESPONSE=$(curl --silent --request GET \
  --url "$URL_BASE/info/services$URL_ADDON" \
  --header "User-Agent: $AGENT")


# echo "$RESPONSE" | jq
echo "$RESPONSE"