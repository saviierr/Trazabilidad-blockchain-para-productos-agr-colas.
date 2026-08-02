#!/usr/bin/env bash
# WP-20: checklist de verificación — ver docs/WP-20-plan-red-hyperledger-fabric.md §5.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./envVar.sh

echo "== 1) contenedores =="
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "^ca-|^orderer\.|^peer0\." || true

check_peer() {
  local org=$1 msp_id=$2 peer_address=$3
  local domain="$org.cacao.local"
  local admin_msp="/network/organizations/peerOrganizations/$domain/users/Admin@$domain/msp"
  local tls_root="/network/organizations/peerOrganizations/$domain/peers/peer0.$domain/tls/ca.crt"

  echo "== [$org] peer channel list =="
  peer_cli "$msp_id" "$admin_msp" "$peer_address" "$tls_root" channel list

  echo "== [$org] peer channel getinfo =="
  peer_cli "$msp_id" "$admin_msp" "$peer_address" "$tls_root" \
    channel getinfo -c "$CHANNEL_NAME"
}

check_peer cooperativa CooperativaMSP peer0.cooperativa.cacao.local:7051
check_peer certificadora CertificadoraMSP peer0.certificadora.cacao.local:9051
check_peer exportador ExportadorMSP peer0.exportador.cacao.local:11051

echo "== wallets institucionales =="
ls "$NETWORK_ROOT/../wallets"
