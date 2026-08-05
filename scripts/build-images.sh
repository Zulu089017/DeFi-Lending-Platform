#!/usr/bin/env bash
# Build & push all StellarPay container images to the registry.
# Override with: REGISTRY=ghcr.io/stellar-payment-gateway TAG=0.1.0 ./scripts/build-images.sh
set -euo pipefail
cd "$(dirname "$0")/.."
REGISTRY="${REGISTRY:-spg}"
TAG="${TAG:-latest}"

for svc in bridge relayer indexer api frontend; do
  echo "▶ Building $svc:$TAG..."
  docker build -t "$REGISTRY/$svc:$TAG" "../$svc"
  docker push "$REGISTRY/$svc:$TAG"
done

echo "✔ All images pushed to $REGISTRY:*:$TAG"
