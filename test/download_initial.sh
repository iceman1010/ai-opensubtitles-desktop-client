#!/bin/bash

#
# Download Part 1 (Initiate Download RPC)
# later call check_status.sh
#

SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config/config.sh"

TARGET_URL="https://www.youtube.com/watch?v=m8QEDTQLdQ4"

# Send the request and capture the response
response=$(curl --silent --request POST \
  --url "$URL_BASE/download$URL_ADDON" \
  --header "Api-Key: $API_KEY" \
  --header "Authorization: Bearer $TOKEN" \
  --header "User-Agent: $AGENT" \
  --header 'kong-debug: 1' \
  --form "url=$TARGET_URL")
  
 # Extract correlation_id from JSON response and save to file
echo "$response" | jq -r '.correlation_id' > "$CORRELATION_ID_FILE"

echo "Saved correlation_id: $(cat "$CORRELATION_ID_FILE")"
echo "Request Response:"
echo "$response" | jq
