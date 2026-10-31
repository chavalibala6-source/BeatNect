#!/bin/bash
set -e

echo "Starting Gunicorn WSGI workers on 127.0.0.1:8000..."
gunicorn -w 4 -b 127.0.0.1:8000 --timeout 180 --access-logfile - --error-logfile - app:app &
GUNICORN_PID=$!

echo "Starting Nginx reverse proxy on port 5000..."
nginx -g "daemon off;" &
NGINX_PID=$!

cleanup() {
    echo "Terminating services..."
    kill -TERM "$GUNICORN_PID" "$NGINX_PID" 2>/dev/null || true
    wait "$GUNICORN_PID" "$NGINX_PID" 2>/dev/null || true
    exit 0
}

trap cleanup SIGTERM SIGINT

wait -n
cleanup
