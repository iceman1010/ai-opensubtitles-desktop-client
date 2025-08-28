#!/bin/bash

MEDIA_ID="20027"
FILE_NAME="test.de.srt"
FILE_URL="files/$MEDIA_ID/$FILE_NAME"

SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config/config.sh"

response=$(curl --silent --request GET \
  --url "$URL_BASE/$FILE_URL$URL_ADDON" \
  --header "Api-Key: $API_KEY" \
  --header "Authorization: Bearer $TOKEN" \
  --header "User-Agent: $AGENT" \
  --header 'kong-debug: 1')

echo "$response" 