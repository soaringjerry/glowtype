#!/bin/sh
set -e

# Generate config.js from environment variables
# Supports OpenAI-compatible API configuration
cat > /usr/share/nginx/html/config.js <<EOF
window.ENV = {
  AI_API_KEY: "${AI_API_KEY:-}",
  AI_API_URL: "${AI_API_URL:-https://api.openai.com/v1}",
  AI_MODEL: "${AI_MODEL:-gpt-4o-mini}"
};
EOF

# Execute the CMD
exec "$@"
