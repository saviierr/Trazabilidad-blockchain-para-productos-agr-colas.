#!/usr/bin/env bash
# WP-21 §5: prueba funcional contra la red real ya desplegada — recorrido
# completo CreateLot -> ... -> RegisterExport, GetHistory con los 5 eventos,
# y un caso de organización no autorizada rechazado. No se versiona en el
# repo (es una prueba manual de verificación, no parte del ciclo de vida).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./envVar.sh

CC_NAME="lote-contract"
ORDERER_ADDRESS="orderer.cacao.local:7050"
ORDERER_TLS_CA="/network/organizations/ordererOrganizations/orderer.cacao.local/orderers/orderer.orderer.cacao.local/tls/ca.crt"
LOTE_ID="func-$(date +%s)"

org_admin_msp() { echo "/network/organizations/peerOrganizations/$1.cacao.local/users/Admin@$1.cacao.local/msp"; }
org_tls_root() { echo "/network/organizations/peerOrganizations/$1.cacao.local/peers/peer0.$1.cacao.local/tls/ca.crt"; }

invoke() {
  local org=$1 msp_id=$2 peer_address=$3 payload=$4
  peer_cli "$msp_id" "$(org_admin_msp "$org")" "$peer_address" "$(org_tls_root "$org")" \
    chaincode invoke \
    -o "$ORDERER_ADDRESS" --tls --cafile "$ORDERER_TLS_CA" \
    -C "$CHANNEL_NAME" -n "$CC_NAME" \
    --peerAddresses peer0.cooperativa.cacao.local:7051 --tlsRootCertFiles "$(org_tls_root cooperativa)" \
    --peerAddresses peer0.certificadora.cacao.local:9051 --tlsRootCertFiles "$(org_tls_root certificadora)" \
    -c "$payload"
}

query() {
  local org=$1 msp_id=$2 peer_address=$3 payload=$4
  peer_cli "$msp_id" "$(org_admin_msp "$org")" "$peer_address" "$(org_tls_root "$org")" \
    chaincode query -C "$CHANNEL_NAME" -n "$CC_NAME" -c "$payload"
}

echo "== 1) CreateLot($LOTE_ID) — CooperativaMSP =="
invoke cooperativa CooperativaMSP peer0.cooperativa.cacao.local:7051 \
  "{\"function\":\"CreateLot\",\"Args\":[\"$LOTE_ID\",\"productor-1\",\"cooperativa-1\",\"2026-08-01\",\"500\"]}"
sleep 2

echo "== 2) RegisterFermentation — CooperativaMSP =="
invoke cooperativa CooperativaMSP peer0.cooperativa.cacao.local:7051 \
  "{\"function\":\"RegisterFermentation\",\"Args\":[\"$LOTE_ID\",\"300\",\"2026-08-05\"]}"
sleep 2

echo "== 3) RegisterCertification — CertificadoraMSP =="
invoke certificadora CertificadoraMSP peer0.certificadora.cacao.local:9051 \
  "{\"function\":\"RegisterCertification\",\"Args\":[\"$LOTE_ID\",\"hash-func-test\",\"firma-func-test\"]}"
sleep 2

echo "== 4) RegisterTransport — TransportistaMSP (cliente, sin peer propio) =="
peer_cli TransportistaMSP "/network/organizations/peerOrganizations/transportista.cacao.local/users/Admin@transportista.cacao.local/msp" \
  peer0.cooperativa.cacao.local:7051 "$(org_tls_root cooperativa)" \
  chaincode invoke \
  -o "$ORDERER_ADDRESS" --tls --cafile "$ORDERER_TLS_CA" \
  -C "$CHANNEL_NAME" -n "$CC_NAME" \
  --peerAddresses peer0.cooperativa.cacao.local:7051 --tlsRootCertFiles "$(org_tls_root cooperativa)" \
  --peerAddresses peer0.certificadora.cacao.local:9051 --tlsRootCertFiles "$(org_tls_root certificadora)" \
  -c "{\"function\":\"RegisterTransport\",\"Args\":[\"$LOTE_ID\",\"transportista-1\",\"Ruta X\",\"48h\"]}"
sleep 2

echo "== 5) RegisterExport — ExportadorMSP =="
invoke exportador ExportadorMSP peer0.exportador.cacao.local:11051 \
  "{\"function\":\"RegisterExport\",\"Args\":[\"$LOTE_ID\",\"exportador-1\",\"Belgica\",\"2026-08-15\"]}"
sleep 2

echo "== 6) GetHistory — debe mostrar los 5 eventos en orden =="
query cooperativa CooperativaMSP peer0.cooperativa.cacao.local:7051 \
  "{\"function\":\"GetHistory\",\"Args\":[\"$LOTE_ID\"]}"

echo ""
echo "== 7) Caso negativo: TransportistaMSP invocando RegisterCertification (no autorizado) =="
if peer_cli TransportistaMSP "/network/organizations/peerOrganizations/transportista.cacao.local/users/Admin@transportista.cacao.local/msp" \
  peer0.cooperativa.cacao.local:7051 "$(org_tls_root cooperativa)" \
  chaincode invoke \
  -o "$ORDERER_ADDRESS" --tls --cafile "$ORDERER_TLS_CA" \
  -C "$CHANNEL_NAME" -n "$CC_NAME" \
  --peerAddresses peer0.cooperativa.cacao.local:7051 --tlsRootCertFiles "$(org_tls_root cooperativa)" \
  --peerAddresses peer0.certificadora.cacao.local:9051 --tlsRootCertFiles "$(org_tls_root certificadora)" \
  -c "{\"function\":\"RegisterCertification\",\"Args\":[\"$LOTE_ID\",\"hash-x\",\"firma-x\"]}" 2>&1; then
  echo "FALLO: se esperaba que la transacción fuera rechazada" >&2
  exit 1
else
  echo "OK: rechazada como se esperaba (CertificadoraMSP requerido)"
fi

echo ""
echo "Prueba funcional completa OK para el lote $LOTE_ID."
