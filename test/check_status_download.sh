#!/bin/bash

#
# Download Part 2 (Check status of RPC)
# 

# possible RPC 'status':

# - CREATED
# - PENDING
# - COMPLETED
# - ERROR
# - TIMEOUT

# only with 'COMPLETED' you get 'data'

SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config/config.sh"

echo "Requesting status of RPC translation process with ID: $CORRELATION_ID"
# Send the request and capture the response
# POST or GET, both are allowed
response=$(curl --silent --request POST \
  --url "$URL_BASE/download/$CORRELATION_ID/$URL_ADDON" \
  --header "Api-Key: $API_KEY" \
  --header "Authorization: Bearer $TOKEN" \
  --header "User-Agent: $AGENT" \
  --header 'kong-debug: 1')
  # CORRELATION_ID can be transmitted via form value too if transmitted via POST,
  # then it can be removed from the URL
  # --form "correlation_id=$CORRELATION_ID") 
 
echo "Request Response:"
echo "$response" | jq
