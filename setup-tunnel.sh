#!/usr/bin/env bash
set -euo pipefail

# Step 1: Login (opens browser)
cloudflared tunnel login

# Step 2: Create tunnel
cloudflared tunnel create gin13

# Step 3: Route DNS
cloudflared tunnel route dns gin13 gin13.kajnekvasil.com

# Step 4: Get tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep gin13 | awk '{print $1}')

# Step 5: Create config
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: /home/kaj/.cloudflared/$TUNNEL_ID.json
ingress:
  - hostname: gin13.kajnekvasil.com
    service: http://localhost:2567
  - service: http_status:404
EOF

# Step 6: Install as system service
sudo cloudflared service install

echo "Done! Run: sudo systemctl start cloudflared"
