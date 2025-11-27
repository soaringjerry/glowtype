#!/bin/sh
set -e

# Generate runtime config.js (no secrets)
cat > /usr/share/nginx/html/config.js <<EOF
window.ENV = {
  API_BASE_URL: "${API_BASE_URL:-}"
};
EOF

# Execute the CMD
exec "$@"
