#!/usr/bin/env bash
# WP-20: une los 3 peers validadores al canal ya creado (ver
# docs/WP-20-plan-red-hyperledger-fabric.md §1). Transportista no tiene peer.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./envVar.sh

BLOCK_PATH="channel-artifacts/$CHANNEL_NAME.block"

join_org_peer() {
  local org=$1 msp_id=$2 peer_address=$3
  local domain="$org.cacao.local"
  # Rutas absolutas dentro del contenedor: peer resuelve CORE_PEER_MSPCONFIGPATH
  # relativo a /etc/hyperledger/fabric si se le pasa una ruta relativa, no al
  # working dir (-w) — hay que ser explícitos.
  local admin_msp="/network/organizations/peerOrganizations/$domain/users/Admin@$domain/msp"
  local tls_root="/network/organizations/peerOrganizations/$domain/peers/peer0.$domain/tls/ca.crt"

  echo "== [$org] uniendo peer0.$domain al canal =="
  peer_cli "$msp_id" "$admin_msp" "$peer_address" "$tls_root" \
    channel join -b "/network/$BLOCK_PATH"
}

join_org_peer cooperativa CooperativaMSP peer0.cooperativa.cacao.local:7051
join_org_peer certificadora CertificadoraMSP peer0.certificadora.cacao.local:9051
join_org_peer exportador ExportadorMSP peer0.exportador.cacao.local:11051

echo "Los 3 peers están unidos a '$CHANNEL_NAME'."
