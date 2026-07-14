#!/usr/bin/env bash
# Apply the K8s manifests in order. Requires kubectl configured for the target cluster.
set -euo pipefail
cd "$(dirname "$0")/.."
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-postgres.yaml
sleep 5
kubectl apply -f k8s/02-bridge.yaml
kubectl apply -f k8s/03-relayer.yaml
kubectl apply -f k8s/04-indexer.yaml
kubectl apply -f k8s/05-api.yaml
kubectl apply -f k8s/06-frontend.yaml
kubectl apply -f k8s/07-ingress.yaml
echo "✔ Stack applied."
kubectl -n openlend get pods
