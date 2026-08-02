#!/usr/bin/env bash
# WP-20: genera el bloque del canal de aplicación y une el orderer (Channel
# Participation API — ver docs/WP-20-plan-red-hyperledger-fabric.md §2.2).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./envVar.sh

ORDERER_TLS_DIR="ordererOrganizations/orderer.cacao.local/orderers/orderer.orderer.cacao.local/tls"
BLOCK_PATH="channel-artifacts/$CHANNEL_NAME.block"

mkdir -p "$NETWORK_ROOT/channel-artifacts"

echo "== generando el bloque del canal '$CHANNEL_NAME' =="
fabric_tools configtxgen -profile TrazabilidadCacaoChannel \
  -outputBlock "$BLOCK_PATH" -channelID "$CHANNEL_NAME" -configPath .

echo "== uniendo el orderer al canal =="
fabric_tools osnadmin channel join \
  --channelID "$CHANNEL_NAME" \
  --config-block "$BLOCK_PATH" \
  -o orderer.cacao.local:7053 \
  --ca-file "organizations/$ORDERER_TLS_DIR/ca.crt" \
  --client-cert "organizations/$ORDERER_TLS_DIR/server.crt" \
  --client-key "organizations/$ORDERER_TLS_DIR/server.key"

echo "Canal '$CHANNEL_NAME' creado y orderer unido."
