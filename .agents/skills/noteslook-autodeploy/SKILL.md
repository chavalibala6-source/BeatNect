---
name: noteslook-autodeploy
description: >-
  Automated file watcher and continuous deployment workflow for BeatNect / NotesLook.
  Use when the user asks to automatically deploy pods after editing code, monitor files
  for live changes, run the background auto-deploy watcher, or verify automated Kubernetes
  rollouts.
---

# NotesLook Auto-Deploy Skill (`noteslook-autodeploy`)

This skill enables continuous, automatic deployment of the NotesLook stack whenever files in `frame_v2/` are modified and saved.

---

## 1. How It Works

1. **Automatic File Watching**:
   The built-in watcher script [`auto_deploy_watcher.py`](file:///home/bala/BeatNect/frame_v2/auto_deploy_watcher.py) monitors all `.py`, `.html`, `.css`, `.js`, and `.conf` files across the codebase.
2. **Debounce & Synchronization**:
   When a file save is detected, it debounces for 1 second to bundle multi-file edits, synchronizes `templates/index.html` to `index.html`, and proceeds with deployment.
3. **Automated Zero-Downtime Rollout**:
   - Rebuilds `balu051989/frame_v2-web:latest`.
   - Loads image into the Minikube cluster via `minikube image load`.
   - Triggers `kubectl rollout restart deployment/frame-v2`.
   - Due to the configured `readinessProbe` and `maxUnavailable: 0` strategy, the rollout executes with **zero dropped connections** on Cloudflare Tunnel.

---

## 2. Running the Auto-Deploy Watcher

### In Terminal (Interactive)
Run from the `frame_v2/` directory:
```bash
./watch-deploy.sh
```
Or directly with Python:
```bash
python3 auto_deploy_watcher.py
```

### In Background (Daemon)
To keep it running in the background during a development session:
```bash
nohup ./watch-deploy.sh > auto_deploy.log 2>&1 &
```
To check watcher logs:
```bash
tail -f auto_deploy.log
```
To stop the background watcher:
```bash
pkill -f auto_deploy_watcher.py
```

---

## 3. Supported File Types & Paths
* **Watched Extensions**: `.html`, `.css`, `.js`, `.py`, `.conf`
* **Watched Folders**:
  * `frame_v2/templates/`
  * `frame_v2/static/`
  * `frame_v2/nginx/`
  * `frame_v2/*.py`
* **Ignored Folders**: `.git`, `data/`, `files/`, `redis-data/`, `__pycache__`

---

## 4. Verification Check
After an automatic deployment completes, verify the update live:
```bash
curl -I http://192.168.49.2:30080/
curl -I https://noteslook.shop/
```
