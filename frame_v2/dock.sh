#!/bin/bash
set -e
docker build -t balu051989/frame_v2-web:latest .
minikube image load balu051989/frame_v2-web:latest
kubectl rollout restart deployment/frame-v2
kubectl rollout status deployment/frame-v2 --timeout=2m
