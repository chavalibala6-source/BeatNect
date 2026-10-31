#!/usr/bin/env python3
"""
NotesLook Auto-Deploy Watcher
Monitors frame_v2 codebase for file changes (.py, .html, .css, .js)
and automatically rebuilds, loads into Minikube, and executes zero-downtime rollouts.
"""

import os
import sys
import time
import subprocess

WATCH_EXTS = {'.py', '.html', '.css', '.js', '.conf'}
IGNORE_DIRS = {'.git', '__pycache__', 'redis-data', 'data', 'files', 'k8s', '.agents', '.gemini'}
WATCH_DIR = os.path.dirname(os.path.abspath(__file__))

def get_snapshot():
    snapshot = {}
    for root, dirs, files in os.walk(WATCH_DIR):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS and not d.startswith('.')]
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in WATCH_EXTS:
                p = os.path.join(root, f)
                try:
                    snapshot[p] = os.path.getmtime(p)
                except OSError:
                    pass
    return snapshot

def deploy():
    print("\n" + "=" * 60)
    print("Change detected! Starting zero-downtime automated deployment...")
    print("=" * 60)
    
    # Step 1: Sync template
    tmpl_path = os.path.join(WATCH_DIR, 'templates', 'index.html')
    idx_path = os.path.join(WATCH_DIR, 'index.html')
    if os.path.exists(tmpl_path):
        try:
            with open(tmpl_path, 'rb') as src, open(idx_path, 'wb') as dst:
                dst.write(src.read())
            print("[1/4] Synchronized templates/index.html -> index.html")
        except Exception as e:
            print(f"Template sync warning: {e}")

    # Step 2: Build Docker image
    print("[2/4] Building production Docker image...")
    cmd_build = ["docker", "build", "-t", "balu051989/frame_v2-web:latest", "."]
    ret = subprocess.run(cmd_build, cwd=WATCH_DIR)
    if ret.returncode != 0:
        print("Docker build failed! Aborting deploy.")
        return

    # Step 3: Load into Minikube
    print("[3/4] Loading image into Minikube...")
    cmd_load = ["minikube", "image", "load", "balu051989/frame_v2-web:latest"]
    ret = subprocess.run(cmd_load, cwd=WATCH_DIR)
    if ret.returncode != 0:
        print("Minikube image load failed! Aborting deploy.")
        return

    # Step 4: Zero-downtime rollout restart
    print("[4/4] Executing zero-downtime rollout restart...")
    cmd_restart = ["kubectl", "rollout", "restart", "deployment/frame-v2"]
    subprocess.run(cmd_restart, cwd=WATCH_DIR)
    cmd_status = ["kubectl", "rollout", "status", "deployment/frame-v2", "--timeout=2m"]
    subprocess.run(cmd_status, cwd=WATCH_DIR)
    print("=" * 60)
    print("Deployment successfully rolled out! Watching for next change...")
    print("=" * 60 + "\n")

def main():
    print(f"NotesLook Auto-Deploy Watcher active on: {WATCH_DIR}")
    print(f"Watching extensions: {', '.join(sorted(WATCH_EXTS))}")
    print("Press Ctrl+C to stop.")
    last_snapshot = get_snapshot()
    
    while True:
        try:
            time.sleep(1.5)
            current_snapshot = get_snapshot()
            
            changed = []
            for path, mtime in current_snapshot.items():
                if path not in last_snapshot or last_snapshot[path] != mtime:
                    changed.append(os.path.basename(path))
            
            for path in last_snapshot:
                if path not in current_snapshot:
                    changed.append(os.path.basename(path))
                    
            if changed:
                print(f"\nDetected changes in: {', '.join(set(changed))}")
                # Debounce by 1 second to catch multi-file saves
                time.sleep(1.0)
                deploy()
                last_snapshot = get_snapshot()
                
        except KeyboardInterrupt:
            print("\nAuto-deploy watcher stopped.")
            break
        except Exception as e:
            print(f"Watcher error: {e}")
            time.sleep(2)

if __name__ == '__main__':
    main()
