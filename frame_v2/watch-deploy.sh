#!/bin/bash
# NotesLook Auto-Deploy Watcher Launcher
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python3 "$DIR/auto_deploy_watcher.py"
