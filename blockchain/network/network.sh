#!/usr/bin/env bash
# WP-20 · Red Hyperledger Fabric — orquestador de la red.
# Ver docs/WP-20-plan-red-hyperledger-fabric.md.
#
# Uso:
#   ./network.sh up             # crea la red docker, levanta las 5 CA, registra/enrola
#                                # identidades y levanta el orderer + 3 peers
#   ./network.sh createChannel  # genera el bloque del canal y une el orderer
#   ./network.sh joinChannel    # une los 3 peers al canal
#   ./network.sh deployChaincode # WP-21: package/install/approve/commit + humo
#   ./network.sh verify         # checklist de verificación (§5 del plan)
#   ./network.sh down           # detiene y elimina contenedores, volúmenes y material generado
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source scripts/envVar.sh

DOCKER_DIR="docker"

network_up() {
  echo "== creando la red docker compartida '$DOCKER_NETWORK' (si no existe) =="
  docker network inspect "$DOCKER_NETWORK" >/dev/null 2>&1 || docker network create "$DOCKER_NETWORK"

  echo "== levantando las 5 Fabric CA =="
  docker compose -p cacao-fabric-ca -f "$DOCKER_DIR/docker-compose-ca.yaml" up -d
  sleep 3

  echo "== registrando y enrolando identidades (Fabric CA) =="
  bash scripts/registerEnroll.sh

  echo "== levantando el orderer y los 3 peers =="
  docker compose -p cacao-fabric-net -f "$DOCKER_DIR/docker-compose-net.yaml" up -d
  sleep 3

  echo "Red arriba. Siguiente paso: ./network.sh createChannel"
}

network_create_channel() {
  bash scripts/createChannel.sh
}

network_join_channel() {
  bash scripts/joinChannel.sh
}

network_deploy_chaincode() {
  bash scripts/deployChaincode.sh
}

network_verify() {
  bash scripts/verify.sh
}

network_down() {
  echo "== bajando peers/orderer =="
  docker compose -p cacao-fabric-net -f "$DOCKER_DIR/docker-compose-net.yaml" down -v || true
  echo "== bajando CAs =="
  docker compose -p cacao-fabric-ca -f "$DOCKER_DIR/docker-compose-ca.yaml" down -v || true
  echo "== limpiando material generado (MSP, canal, wallets) =="
  rm -rf organizations/fabric-ca/*/[!.]* organizations/peerOrganizations organizations/ordererOrganizations \
    organizations/fabric-ca-client-config.yaml channel-artifacts
  rm -rf ../wallets/*
  echo "Red eliminada. './network.sh up' para reconstruir desde cero."
}

case "${1:-}" in
  up) network_up ;;
  createChannel) network_create_channel ;;
  joinChannel) network_join_channel ;;
  deployChaincode) network_deploy_chaincode ;;
  verify) network_verify ;;
  down) network_down ;;
  *)
    echo "Uso: ./network.sh {up|createChannel|joinChannel|deployChaincode|verify|down}"
    exit 1
    ;;
esac
