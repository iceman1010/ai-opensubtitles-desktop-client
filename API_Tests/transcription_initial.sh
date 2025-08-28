#!/bin/bash

#
# Transcription Part 1 (Initiate Transcription RPC)
# later call check_status.sh

SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config/config.sh"

# Parameters
FILE="$ASSETS_DIR/test_archer_2min.mp3"
LANGUAGE="en";
API="salad"

# Send the request and capture the response
response=$(curl --silent --request POST \
  --url "$URL_BASE/transcribe$URL_ADDON" \
  --header "Api-Key: $API_KEY" \
  --header "Authorization: Bearer $TOKEN" \
  --header "User-Agent: $AGENT" \
  --header 'kong-debug: 1' \
  --form "language=$LANGUAGE" \
  --form "api=$API" \
  --form "file=@$FILE") 
# optional, will return content of subtitle file  
# --form 'return_content=true'
echo "$response"  
 # Extract correlation_id from JSON response and save to file
echo "$response" | jq -r '.correlation_id' > "$CORRELATION_ID_FILE"
echo "Saved correlation_id: $(cat "$CORRELATION_ID_FILE")"
echo "Request Response:"
echo "$response" | jq
