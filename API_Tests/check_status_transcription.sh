#!/bin/bash

#
# Transcription / Download Part 2 (Check status of RPC)
# 

# possible RPC 'status':

# - CREATED
# - PENDING
# - COMPLETED
# - ERROR
# - TIMEOUT

# only with 'COMPLETED' you get 'data'

# Example Result

# {
#   "correlation_id": "67d9fe0ce53e2",
#   "status": "COMPLETED",
#   "data": {
#     "file_name": "test_archer_2min.srt",
#     "return_content": "1\r\n00:00:00,082 --> 00:00:00,740\r\nNot so bad, all right? ...",
#     "url": "https://api.opensubtitles.com/api/v1/ai/files/20550/test_archer_2min.srt",
#     "duration": 121,
#     "unit_price": 0.0054,
#     "total_price": 1,
#     "credits_left": 2026,
#     "id": 20550,
#     "complete": 1742339789
#   }
# }


SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config/config.sh"

echo "Requesting status of RPC transcription process with ID: $CORRELATION_ID"
# Send the request and capture the response
# POST or GET, both are allowed
response=$(curl --silent --request POST \
  --url "$URL_BASE/transcribe/$CORRELATION_ID/$URL_ADDON" \
  --header "Api-Key: $API_KEY" \
  --header "Authorization: Bearer $TOKEN" \
  --header "User-Agent: $AGENT" \
  --header 'kong-debug: 1')
  # CORRELATION_ID can be transmitted via form value too if send as POST,
  # then it can be removed from the URL
  # --form "correlation_id=$CORRELATION_ID")
 
echo "Request Response:"
echo "$response" | jq
