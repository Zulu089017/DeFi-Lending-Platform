# OpenLend — Infrastructure

This directory contains everything you need to run the OpenLend stack locally for development and to deploy it to a Kubernetes cluster for production.

## Layout

```
infra/
├── docker-compose.yml        # Full stack: postgres, redis, bridge, relayer, indexer, api, frontend
├── docker-compose.dev.yml    # Just postgres + redis for local dev
├── k8s/                      # Kubernetes manifests (one file per service)
│   ├── 00-namespace.yaml
│   ├── 01-postgres.yaml
│   ├── 02-bridge.yaml
│   ├── 03-relayer.yaml
│   ├── 04-indexer.yaml
│   ├── 05-api.yaml
│   ├── 06-frontend.yaml
│   ├── 07-ingress.yaml
│   └── 10-secrets.yaml
├── terraform/                # (optional) cloud-agnostic infra
└── scripts/                  # convenience scripts
    ├── dev-up.sh
    ├── dev-down.sh
    ├── build-images.sh
    └── deploy-k8s.sh
```
