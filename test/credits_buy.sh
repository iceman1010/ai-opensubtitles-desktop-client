#!/bin/bash
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config/config.sh"

RESPONSE=$(curl --silent --request POST \
  --url "$URL_BASE/credits/buy$URL_ADDON" \
  --header "Api-Key: $API_KEY" \
  --header "Authorization: Bearer $TOKEN" \
  --header "User-Agent: $AGENT" \
  --form 'email=myemail@gmail.com' )

# email is optional and can be also send as GET URL addon ... ?email=myemail@gmail.com
echo "$RESPONSE" | jq
