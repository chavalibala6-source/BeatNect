---
name: noteslook-ops
description: >-
  Operational runbook and architecture guide for BeatNect / NotesLook. Use when building,
  deploying, troubleshooting, or modifying the production Gunicorn/Nginx container,
  Kubernetes deployment and service, Cloudflare Tunnel routing, persistent media storage
  (/static/uploads/), audio playback streaming, zero-flash theme switching, or document
  layout logic.
---

# NotesLook Operations & Architecture Runbook (`noteslook-ops`)

This skill encapsulates the production architecture, deployment runbooks, troubleshooting workflows, and UI patterns for the BeatNect / NotesLook stack.

---

## 1. System Architecture Overview

### In-Container Web & WSGI Stack
* **Container Port 5000** (matches Kubernetes Service TargetPort `5000` / NodePort `30080`):
  * **Nginx** runs as reverse proxy and static media server:
    * `/static/` -> directly served from `/app/static/` with 7-day caching and gzip compression.
    * `/static/uploads/` -> directly served from persistent volume `/app/data/uploads/` (`alias /app/data/uploads/;`) with 30-day caching, CORS headers, and byte-range streaming (`Accept-Ranges bytes`).
    * `/` -> reverse-proxied to Gunicorn on `http://127.0.0.1:8000` with buffering off and 300s timeouts.
  * **Gunicorn** runs WSGI server on `127.0.0.1:8000`:
    * 4 worker processes (`gunicorn -w 4 -b 127.0.0.1:8000 --timeout 180 app:app`).
    * Database initialized during app startup context (`with app.app_context(): init_db()`).
  * **Supervision**: `entrypoint.sh` manages both Gunicorn and Nginx with SIGTERM/SIGINT signal trapping for graceful termination.

### Kubernetes & Cloudflare Tunnel
* **Minikube NodePort Service**: `service/frame-v2` routes `NodePort 30080` -> Container `5000`.
* **Cloudflare Tunnel (`cloudflared`)**:
  * Forwards `noteslook.shop` and `www.noteslook.shop` -> `http://192.168.49.2:30080`.
* **Persistent Storage**:
  * PVC `frame-pvc` mounted at `/app/data` (holds `/app/data/uploads/artwork` and `/app/data/uploads/files`).

---

## 2. Zero-Downtime Deployment Runbook

### Crucial Kubernetes Settings in `k8s/deployment.yaml`
To prevent Cloudflare Tunnel `connect: connection refused` errors during rollouts:
1. **Zero-Unavailable Strategy**:
   ```yaml
   strategy:
     type: RollingUpdate
     rollingUpdate:
       maxUnavailable: 0
       maxSurge: 1
   ```
   *Guarantees Kubernetes never terminates an old pod until the new pod is confirmed healthy.*
2. **Readiness Probe**:
   ```yaml
   readinessProbe:
     httpGet:
       path: /
       port: 5000
     initialDelaySeconds: 4
     periodSeconds: 2
   ```
   *Prevents traffic routing until Nginx and Gunicorn are actively responding HTTP 200.*
3. **Graceful Connection Draining (`lifecycle.preStop`)**:
   ```yaml
   lifecycle:
     preStop:
       exec:
         command: ["/bin/sleep", "3"]
   ```

### Build & Deploy Sequence
Execute from `frame_v2/`:
```bash
# 1. Sync templates/index.html to index.html if modified
cp templates/index.html index.html

# 2. Build production Docker image
docker build -t balu051989/frame_v2-web:latest .

# 3. Load into Minikube VM
minikube image load balu051989/frame_v2-web:latest

# 4. Rollout restart deployment
kubectl rollout restart deployment/frame-v2
kubectl rollout status deployment/frame-v2 --timeout=2m
```

---

## 3. Persistent Media & Uploads Rules

* **Storage Path**: `/app/data/uploads/` on the persistent volume.
  * Audio files: `/app/data/uploads/files/<id>.mp3` (accessed via `/static/uploads/files/<id>.mp3`).
  * Artwork images: `/app/data/uploads/artwork/<id>_art.jpg` (accessed via `/static/uploads/artwork/<id>_art.jpg`).
* **Nginx Configuration Requirement**:
  ```nginx
  location /static/uploads/ {
      alias /app/data/uploads/;
      expires 30d;
      add_header Cache-Control "public, max-age=2592000";
      add_header Access-Control-Allow-Origin *;
      add_header Access-Control-Allow-Methods "GET, OPTIONS";
      add_header Access-Control-Allow-Headers "*";
  }
  ```
  *Never let Nginx route `/static/uploads/` to `/app/static/`, as uploads reside in `/app/data/uploads/`.*

---

## 4. UI Patterns & Best Practices

### Instant Theme Switching (Zero White Flash)
1. **Suppress Transitions**:
   ```css
   html.theme-no-transition,
   html.theme-no-transition *,
   body.theme-no-transition,
   body.theme-no-transition * {
       transition: none !important;
       animation: none !important;
   }
   ```
2. **Synchronous Class Toggle**:
   In `toggleTheme()`: add `.theme-no-transition`, flip classes, force reflow (`void html.offsetHeight`), and clear suppression on double `requestAnimationFrame`.
3. **Early Pre-Render Script**:
   Inline script in `<head>` executes before the initial DOM paint to apply `dark-mode` immediately on page load/refresh.

### Fixed Top Toolbar & Separate Scroll Block
1. `#documentView`: Fixed viewport container (`position: fixed; top: 52px; bottom: 0; display: flex; flex-direction: column; overflow: hidden;`).
2. `.apple-chapternav-bar` & `.app-header`: Fixed header children with solid background (`#ffffff` in light mode, `#121214` in dark mode) and subtle hairline border.
3. `#documentView .notepad`: Dedicated scrolling workspace (`flex: 1 1 auto; overflow-y: auto;`).

---

## 5. Verification Commands

* **Direct HTTP Check**:
  ```bash
  curl -I http://192.168.49.2:30080/
  ```
* **Artwork Delivery Check**:
  ```bash
  curl -I http://192.168.49.2:30080/static/uploads/artwork/<file>.jpg
  ```
* **Audio Byte-Range Seeking Check**:
  ```bash
  curl -I -r 0-1024 http://192.168.49.2:30080/static/uploads/files/<file>.mp3
  # Expected: HTTP/1.1 206 Partial Content
  ```
* **Public Domain Check**:
  ```bash
  curl -I https://noteslook.shop/
  curl -I https://noteslook.shop/last_modified
  ```
