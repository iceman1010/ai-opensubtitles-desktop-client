#!/bin/bash
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/config/config.sh"
# You can leave away the /info/ part of the URL but then you have to send AUTH headers too.
RESPONSE=$(curl --silent --request POST \
  --url "$URL_BASE/info/translation_languages$URL_ADDON" \
  --header "User-Agent: $AGENT")
  # Optional
  # --form 'api=deepl'

# echo "$RESPONSE" | jq
echo "$RESPONSE"