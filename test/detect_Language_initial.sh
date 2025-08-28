#!/bin/bash
#
# Language Detection Part 1 (Initiate Detection RPC)
# later call check_status_detect_Language.sh

SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config/config.sh"

#Parameters

# FILE - can be either mp3 or subtitle file format like srt or vtt
# FILE="$ASSETS_DIR/test_archer_2min.mp3"
FILE="$ASSETS_DIR/test.srt"
# DURATION="60"
# Send the request and capture the response
response=$(curl --silent --request POST \
  --url "$URL_BASE/detect_language_text$URL_ADDON" \
  --header "Api-Key: $API_KEY" \
  --header "Authorization: Bearer $TOKEN" \
  --header "User-Agent: $AGENT" \
  --header 'kong-debug: 1' \
  --form "file=@$FILE")
  
 # Extract correlation_id from JSON response and save to file
echo "$response" | jq -r '.correlation_id' > "$CORRELATION_ID_FILE"

# echo "Saved correlation_id: $(cat "$CORRELATION_ID_FILE")"
echo "Request Response:"
# echo "$response" 
echo "$response" | jq

# Example Output for text media file (no subsequent calls):

# Request Response:
# {
#   "data": {
#     "format": "SubRip",
#     "type": "text",
#     "language": {
#       "W3C": "en",
#       "name": "english",
#       "native": "english",
#       "ISO_639_1": "en",
#       "ISO_639_2b": "eng"
#     }
#   }
# }


# Example Output for audio media file (has correlation_id for subsequent calls):

# Request Response:
# {
#   "format": "MPEG Audio",
#   "type": "audio",
#   "duration": 90,
#   "media": "test_archer_2min-7.mp3",
#   "status": "CREATED",
#   "correlation_id": "685a79d476876"
# }
