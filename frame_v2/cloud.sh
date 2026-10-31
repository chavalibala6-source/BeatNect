#!/usr/bin/env bash
set -euo pipefail

# Usage:
# ./setup-frame-cloudflared.sh <hostname> \
#   [tunnel-name=frame-tunnel] [app-label="app=frame-v2"] [namespace=default] [local-port=5001] [target-port=5000]
#
# Example:
# ./setup-frame-cloudflared.sh frame.example.com

HOSTNAME="${1:-}"
TUNNEL_NAME="${2:-frame-tunnel}"
APP_LABEL="${3:-app=frame-v2}"
NAMESPACE="${4:-default}"
LOCAL_PORT="${5:-5001}"
TARGET_PORT="${6:-5000}"

if [[ -z "$HOSTNAME" ]]; then
  echo "Usage: $0 <hostname> [tunnel-name] [app-label] [namespace] [local-port] [target-port]"
  exit 2
fi

echo "Hostname: $HOSTNAME"
echo "Tunnel name: $TUNNEL_NAME"
echo "App label: $APP_LABEL"
echo "Namespace: $NAMESPACE"
echo "Local port: $LOCAL_PORT -> Target container port: $TARGET_PORT"

# Check commands
for cmd in kubectl cloudflared jq systemctl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: $cmd not found. Install it and re-run."
    exit 1
  fi
done

# Check cloudflared login credentials
if [[ ! -f "${HOME}/.cloudflared/cert.pem" ]]; then
  echo "ERROR: cloudflared login not found (~/.cloudflared/cert.pem). Run 'cloudflared tunnel login' and re-run."
  exit 1
fi

# Wait for a Ready pod
echo "Waiting for a Ready pod matching label $APP_LABEL in namespace $NAMESPACE..."
while true; do
  POD=$(kubectl get pods -n "$NAMESPACE" -l "$APP_LABEL" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
  if [[ -n "$POD" ]]; then
    READY=$(kubectl get pod "$POD" -n "$NAMESPACE" -o jsonpath='{.status.containerStatuses[0].ready}' 2>/dev/null || echo "false")
    if [[ "$READY" == "true" ]]; then
      echo "Found ready pod: $POD"
      break
    fi
  fi
  echo "No ready pod yet; retrying in 2s..."
  sleep 2
done

# Create a tunnel if necessary
TUNNEL_ID=""
if cloudflared tunnel list --output json 2>/dev/null | jq -e --arg name "$TUNNEL_NAME" '.[] | select(.name==$name)' >/dev/null 2>&1; then
  TUNNEL_ID=$(cloudflared tunnel list --output json | jq -r --arg name "$TUNNEL_NAME" '.[] | select(.name==$name) | .id')
  echo "Found existing tunnel '$TUNNEL_NAME' (id: $TUNNEL_ID)"
else
  echo "Creating tunnel '$TUNNEL_NAME'..."
  OUT=$(cloudflared tunnel create "$TUNNEL_NAME")
  # parse id from output (creates ~/.cloudflared/<id>.json)
  TUNNEL_ID=$(echo "$OUT" | awk '/id:/{print $2; exit}' || true)
  if [[ -z "$TUNNEL_ID" ]]; then
    # try to find the most recent .json in ~/.cloudflared
    TUNNEL_ID=$(ls -1t ~/.cloudflared/*.json 2>/dev/null | head -n1 | xargs -r basename | sed 's/\.json$//' || true)
  fi
  if [[ -z "$TUNNEL_ID" ]]; then
    echo "ERROR: could not determine tunnel id after creation. Output:"
    echo "$OUT"
    exit 1
  fi
  echo "Created tunnel id: $TUNNEL_ID"
fi

CRED_FILE="${HOME}/.cloudflared/${TUNNEL_ID}.json"
if [[ ! -f "$CRED_FILE" ]]; then
  echo "WARNING: credentials file $CRED_FILE not found. cloudflared may still work if the tunnel exists. Continuing..."
fi

# Route DNS (create CNAME) - attempts automatic route
echo "Creating DNS route for $HOSTNAME -> $TUNNEL_NAME..."
if cloudflared tunnel route dns "$TUNNEL_NAME" "$HOSTNAME" >/dev/null 2>&1; then
  echo "DNS route created/ensured."
else
  echo "Warning: 'cloudflared tunnel route dns' failed. You may need permissions to modify DNS in Cloudflare. Please create a CNAME record:"
  echo "  $HOSTNAME -> ${TUNNEL_ID}.cfargotunnel.com"
fi

# Write cloudflared config.yml
mkdir -p "${HOME}/.cloudflared"
CONFIG_FILE="${HOME}/.cloudflared/config.yml"
cat > "$CONFIG_FILE" <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: ${CRED_FILE}

ingress:
  - hostname: ${HOSTNAME}
    service: http://localhost:${LOCAL_PORT}
  - service: http_status:404
EOF

echo "Wrote cloudflared config to $CONFIG_FILE"

# Create start wrapper dir
WORKDIR="${HOME}/frame-tunnel"
mkdir -p "$WORKDIR"

START_SCRIPT="${WORKDIR}/start-tunnel.sh"
cat > "$START_SCRIPT" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

TUNNEL_NAME="${TUNNEL_NAME_PLACEHOLDER}"
NAMESPACE="${NAMESPACE_PLACEHOLDER}"
APP_LABEL="${APP_LABEL_PLACEHOLDER}"
LOCAL_PORT="${LOCAL_PORT_PLACEHOLDER}"
TARGET_PORT="${TARGET_PORT_PLACEHOLDER}"

log() { echo "[$(date +'%F %T')] $*"; }

# Wait and find a ready pod, keep updating POD variable if pod restarts
while true; do
  POD=$(kubectl get pods -n "${NAMESPACE}" -l "${APP_LABEL}" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
  if [[ -n "${POD}" ]]; then
    READY=$(kubectl get pod "${POD}" -n "${NAMESPACE}" -o jsonpath='{.status.containerStatuses[0].ready}' 2>/dev/null || echo "false")
    if [[ "${READY}" == "true" ]]; then
      log "Using pod ${POD} for port-forward"
      break
    fi
  fi
  log "No ready pod yet for label ${APP_LABEL} in ${NAMESPACE}; retrying in 2s..."
  sleep 2
done

# start a resilient port-forward in background that restarts if it dies
PF_LOG="/var/log/frame-port-forward.log"
mkdir -p "$(dirname "$PF_LOG")" 2>/dev/null || true
(
  while true; do
    log "Starting kubectl port-forward pod/${POD} ${LOCAL_PORT}:${TARGET_PORT}"
    kubectl port-forward -n "${NAMESPACE}" pod/"${POD}" "${LOCAL_PORT}":"${TARGET_PORT}" >>"${PF_LOG}" 2>&1 || true
    log "port-forward exited; retrying in 2s"
    sleep 2
  done
) &

# Run cloudflared tunnel (this process retains foreground so systemd can track it)
exec cloudflared tunnel run "${TUNNEL_NAME}"
EOF

# replace placeholders
sed -i "s|TUNNEL_NAME_PLACEHOLDER|${TUNNEL_NAME}|g" "$START_SCRIPT"
sed -i "s|NAMESPACE_PLACEHOLDER|${NAMESPACE}|g" "$START_SCRIPT"
sed -i "s|APP_LABEL_PLACEHOLDER|${APP_LABEL}|g" "$START_SCRIPT"
sed -i "s|LOCAL_PORT_PLACEHOLDER|${LOCAL_PORT}|g" "$START_SCRIPT"
sed -i "s|TARGET_PORT_PLACEHOLDER|${TARGET_PORT}|g" "$START_SCRIPT"

chmod +x "$START_SCRIPT"
echo "Wrote start wrapper: $START_SCRIPT"

# Create systemd service
SERVICE_NAME="frame-tunnel.service"
SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}"

echo "Creating systemd service $SERVICE_PATH (requires sudo)..."
sudo tee "$SERVICE_PATH" >/dev/null <<EOF
[Unit]
Description=Frame V2 port-forward + Cloudflare Tunnel
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${USER}
Environment=HOME=${HOME}
WorkingDirectory=${WORKDIR}
ExecStart=${START_SCRIPT}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "Reloading systemd and enabling service..."
sudo systemctl daemon-reload
sudo systemctl enable --now "${SERVICE_NAME}"

echo "Service started. Check logs with:"
echo "  sudo journalctl -u ${SERVICE_NAME} -f"
echo ""
echo "Confirm local access with: curl -v http://localhost:${LOCAL_PORT}"
echo "Confirm public hostname: https://${HOSTNAME}"
echo ""
echo "If the DNS CNAME wasn't created automatically, create a CNAME record:"
echo "  ${HOSTNAME} -> ${TUNNEL_ID}.cfargotunnel.com"
echo ""
echo "Done."
