#!/bin/sh
set -e

# Generate config.js from environment variables
echo "window.ENV = {" > /usr/share/nginx/html/config.js
echo "  GEMINI_API_KEY: \"${GEMINI_API_KEY:-}\"" >> /usr/share/nginx/html/config.js
echo "};" >> /usr/share/nginx/html/config.js

# Execute the CMD
exec "$@"
