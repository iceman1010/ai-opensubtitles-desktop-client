#!/bin/bash

#
# Translation Part 1 (Initiate Translation RPC)
# later call check_status.sh

SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config/config.sh"

#Parameters
TRANSLATE_TO="de"
TRANSLATE_FROM="auto"
API="gemini-flash"
FILE="$ASSETS_DIR/test_long.srt"

# Send the request and capture the response
response=$(curl --silent --request POST \
  --url "$URL_BASE/translate$URL_ADDON" \
  --header "Api-Key: $API_KEY" \
  --header "Authorization: Bearer $TOKEN" \
  --header "User-Agent: $AGENT" \
  --header 'kong-debug: 1' \
  --form "file=@$FILE" \
  --form "translate_to=$TRANSLATE_TO" \
  --form "translate_from=$TRANSLATE_FROM" \
  --form "api=$API" \
  --form 'return_content=true')
  # return_content is optional and will give you the translation directly as 'translation'
  # Either file upload or id of existing task / job or file_id from OS API
  #  --form 'id=19907' \
  #  --form 'file_id=8457297' \
  #  --form "file=@$FILE" \
  # --form 'file_id=8457297' \
  
 # Extract correlation_id from JSON response and save to file
echo "$response" | jq -r '.correlation_id' > "$CORRELATION_ID_FILE"

echo "Saved correlation_id: $(cat "$CORRELATION_ID_FILE")"
echo "Request Response:"
echo "$response"
echo "$response" | jq
