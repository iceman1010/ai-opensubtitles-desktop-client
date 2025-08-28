#!/bin/bash

#
# Translation / Download Part 2 (Check status of RPC)
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
#   "correlation_id": "67cb7e4ff3748",
#   "status": "OK",
#   "data": {
#     "file_name": "test.de.srt",
#     "url": "https://api.opensubtitles.com/api/v1/ai/files/20027/test.de.srt",
#     "character_count": 1616,
#     "unit_price": 0.00162,
#     "total_price": 3,
#     "credits_left": 2054,
#     "task": {
#       "login": "ai_testuser_1",
#       "loginid": "999999999",
#       "id": "20027",
#       "api": "deepl",
#       "language": "auto",
#       "translation": "de",
#       "start_time": 1741389391
#     },
#     "complete": 1741389392
#   }
# }


SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config/config.sh"

echo "Requesting status of RPC translation process with ID: $CORRELATION_ID"
# Send the request and capture the response
# POST or GET, both are allowed
response=$(curl --silent --request POST \
  --url "$URL_BASE/translation/$CORRELATION_ID/$URL_ADDON" \
  --header "Api-Key: $API_KEY" \
  --header "Authorization: Bearer $TOKEN" \
  --header "User-Agent: $AGENT" \
  --header 'kong-debug: 1')
  # CORRELATION_ID can be transmitted via form value too if transmitted via POST,
  # then it can be removed from the URL
  # --form "correlation_id=$CORRELATION_ID") 
 
echo "Request Response:"
echo "$response" | jq
