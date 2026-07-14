# Deployment Guide

This guide walks through deploying the OpenLend stack from a clean machine to a public mainnet-like cluster.

## 0. Prerequisites

- A Stellar keypair (use `stellar keys generate deployer`)
- An EVM keypair with ETH/MATIC for gas
- A Postgres database (managed or self-hosted)
- A container registry (DockerHub, GHCR, ECR, etc.)
- A Kubernetes cluster (EKS, GKE, DO, k3s, etc.)
- DNS records for `openlend.xyz` and `api.openlend.xyz`

## 1. Deploy contracts

```bash
# Stellar
cd stellar-contracts
cargo build --target wasm32-unknown-unknown --release
NETWORK=public STELLAR_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015" \
  bash scripts/deploy-testnet.sh   # adjust for mainnet

# EVM (Ethereum + Polygon)
cd ../evm-contracts
npm install
npx hardhat run scripts/deploy.ts --network mainnet
npx hardhat run scripts/deploy.ts --network polygon
```

Both scripts update `sdk/src/manifest.json` with the live addresses. Commit that file.

## 2. Build & push images

```bash
REGISTRY=ghcr.io/openlend TAG=0.1.0 bash infra/scripts/build-images.sh
```

## 3. Configure secrets

Replace the secrets in `infra/k8s/01-postgres.yaml`, `02-bridge.yaml`, etc. with real values, ideally sealed with [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets) or an external secret manager.

## 4. Deploy the cluster

```bash
bash infra/scripts/deploy-k8s.sh
```

## 5. Verify

```bash
kubectl -n openlend get pods
kubectl -n openlend port-forward svc/api 4000:80
curl localhost:4000/health
```

## 6. Set up TLS

Install [cert-manager](https://cert-manager.io/) and a ClusterIssuer for Let's Encrypt. Apply `infra/k8s/07-ingress.yaml` once the issuer is ready.

## 7. Monitoring (optional but recommended)

- Prometheus + Grafana for metrics
- Loki or Datadog for logs
- Sentry for error tracking
- A pager for `bridge` and `relayer` uptime

## 8. Mainnet checklist

- [ ] All secrets stored in external secret manager
- [ ] Admin keys held in multisig (e.g. Gnosis Safe on each chain)
- [ ] Attester set is 2-of-3 with at least one off-cloud signer
- [ ] Oracle publishers are duplicated and rate-limited
- [ ] `Paused` is `false` on the controller
- [ ] Frontend env vars updated with mainnet addresses
- [ ] DNS + TLS live
- [ ] Health-factor circuit-breaker tested
- [ ] Security audit completed
