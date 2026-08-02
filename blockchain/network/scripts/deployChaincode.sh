#!/usr/bin/env bash
# WP-21: ciclo de vida del chaincode sobre la red ya viva de WP-20 — ver
# docs/WP-21-plan-chaincode.md §4. package -> install x3 -> approveformyorg x3
# -> commit -> invocación de humo (CreateLot + GetHistory).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./envVar.sh

CC_NAME="lote-contract"
CC_VERSION="1.0"
CC_SEQUENCE="1"
CC_LABEL="${CC_NAME}_${CC_VERSION}"
CC_PACKAGE="${CC_NAME}.tar.gz"
# Política de endoso del chaincode (WP-21 §2.6): mayoría de los 3 validadores.
CC_ENDORSEMENT_POLICY="OutOf(2,'CooperativaMSP.peer','CertificadoraMSP.peer','ExportadorMSP.peer')"

ORDERER_ADDRESS="orderer.cacao.local:7050"
ORDERER_TLS_CA="/network/organizations/ordererOrganizations/orderer.cacao.local/orderers/orderer.orderer.cacao.local/tls/ca.crt"

org_admin_msp() { echo "/network/organizations/peerOrganizations/$1.cacao.local/users/Admin@$1.cacao.local/msp"; }
org_tls_root() { echo "/network/organizations/peerOrganizations/$1.cacao.local/peers/peer0.$1.cacao.local/tls/ca.crt"; }

package_chaincode() {
  echo "== compilando el chaincode (tsc) =="
  (cd "$CHAINCODE_ROOT" && npm run build)

  # Se empaqueta solo package.json + package-lock.json + dist/ — nunca
  # node_modules/ local: el builder Node de Fabric corre "npm install" dentro
  # del contenedor Linux del peer, y unos node_modules ya instalados en
  # Windows (binarios nativos de grpc) romperían ese build.
  echo "== preparando el árbol de empaquetado (sin node_modules/src/test) =="
  rm -rf "$CHAINCODE_ROOT/package-src"
  mkdir -p "$CHAINCODE_ROOT/package-src"
  cp "$CHAINCODE_ROOT/package.json" "$CHAINCODE_ROOT/package-src/"
  [ -f "$CHAINCODE_ROOT/package-lock.json" ] && cp "$CHAINCODE_ROOT/package-lock.json" "$CHAINCODE_ROOT/package-src/"
  cp -r "$CHAINCODE_ROOT/dist" "$CHAINCODE_ROOT/package-src/dist"

  echo "== empaquetando '$CC_LABEL' =="
  rm -f "$CHAINCODE_ROOT/$CC_PACKAGE"
  fabric_tools peer lifecycle chaincode package "/chaincode/$CC_PACKAGE" \
    --path /chaincode/package-src --lang node --label "$CC_LABEL"
}

install_on_org() {
  local org=$1 msp_id=$2 peer_address=$3
  echo "== [$org] instalando el paquete =="
  peer_cli "$msp_id" "$(org_admin_msp "$org")" "$peer_address" "$(org_tls_root "$org")" \
    lifecycle chaincode install "/chaincode/$CC_PACKAGE"
}

query_package_id() {
  # El Package ID (label:hash) es el mismo en las 3 organizaciones porque el
  # .tar.gz empaquetado es idéntico — basta con consultarlo en una.
  peer_cli CooperativaMSP "$(org_admin_msp cooperativa)" peer0.cooperativa.cacao.local:7051 "$(org_tls_root cooperativa)" \
    lifecycle chaincode queryinstalled 2>/dev/null \
    | grep "Label: $CC_LABEL" | sed -n "s/^Package ID: \(.*\), Label:.*/\1/p" | head -1
}

approve_for_org() {
  local org=$1 msp_id=$2 peer_address=$3 package_id=$4
  echo "== [$org] aprobando la definición =="
  peer_cli "$msp_id" "$(org_admin_msp "$org")" "$peer_address" "$(org_tls_root "$org")" \
    lifecycle chaincode approveformyorg \
    -o "$ORDERER_ADDRESS" --tls --cafile "$ORDERER_TLS_CA" \
    --channelID "$CHANNEL_NAME" --name "$CC_NAME" --version "$CC_VERSION" \
    --package-id "$package_id" --sequence "$CC_SEQUENCE" \
    --signature-policy "$CC_ENDORSEMENT_POLICY"
}

commit_chaincode() {
  echo "== comprobando disponibilidad para commit =="
  peer_cli CooperativaMSP "$(org_admin_msp cooperativa)" peer0.cooperativa.cacao.local:7051 "$(org_tls_root cooperativa)" \
    lifecycle chaincode checkcommitreadiness \
    --channelID "$CHANNEL_NAME" --name "$CC_NAME" --version "$CC_VERSION" \
    --sequence "$CC_SEQUENCE" --signature-policy "$CC_ENDORSEMENT_POLICY" --output json

  echo "== confirmando la definición en el canal (3 de 4 orgs = mayoría, WP-20 §2.1) =="
  peer_cli CooperativaMSP "$(org_admin_msp cooperativa)" peer0.cooperativa.cacao.local:7051 "$(org_tls_root cooperativa)" \
    lifecycle chaincode commit \
    -o "$ORDERER_ADDRESS" --tls --cafile "$ORDERER_TLS_CA" \
    --channelID "$CHANNEL_NAME" --name "$CC_NAME" --version "$CC_VERSION" \
    --sequence "$CC_SEQUENCE" --signature-policy "$CC_ENDORSEMENT_POLICY" \
    --peerAddresses peer0.cooperativa.cacao.local:7051 --tlsRootCertFiles "$(org_tls_root cooperativa)" \
    --peerAddresses peer0.certificadora.cacao.local:9051 --tlsRootCertFiles "$(org_tls_root certificadora)" \
    --peerAddresses peer0.exportador.cacao.local:11051 --tlsRootCertFiles "$(org_tls_root exportador)"
}

smoke_test() {
  local lote_id="smoke-$(date +%s)"
  echo "== invocación de humo: CreateLot($lote_id) =="
  peer_cli CooperativaMSP "$(org_admin_msp cooperativa)" peer0.cooperativa.cacao.local:7051 "$(org_tls_root cooperativa)" \
    chaincode invoke \
    -o "$ORDERER_ADDRESS" --tls --cafile "$ORDERER_TLS_CA" \
    -C "$CHANNEL_NAME" -n "$CC_NAME" \
    --peerAddresses peer0.cooperativa.cacao.local:7051 --tlsRootCertFiles "$(org_tls_root cooperativa)" \
    --peerAddresses peer0.certificadora.cacao.local:9051 --tlsRootCertFiles "$(org_tls_root certificadora)" \
    -c "{\"function\":\"CreateLot\",\"Args\":[\"$lote_id\",\"productor-demo\",\"cooperativa-demo\",\"2026-08-02\",\"500\"]}"

  sleep 2
  echo "== verificando con GetHistory($lote_id) =="
  peer_cli CooperativaMSP "$(org_admin_msp cooperativa)" peer0.cooperativa.cacao.local:7051 "$(org_tls_root cooperativa)" \
    chaincode query -C "$CHANNEL_NAME" -n "$CC_NAME" \
    -c "{\"function\":\"GetHistory\",\"Args\":[\"$lote_id\"]}"
}

package_chaincode

install_on_org cooperativa CooperativaMSP peer0.cooperativa.cacao.local:7051
install_on_org certificadora CertificadoraMSP peer0.certificadora.cacao.local:9051
install_on_org exportador ExportadorMSP peer0.exportador.cacao.local:11051

PACKAGE_ID="$(query_package_id)"
if [ -z "$PACKAGE_ID" ]; then
  echo "No se pudo resolver el Package ID de '$CC_LABEL' tras la instalación." >&2
  exit 1
fi
echo "Package ID: $PACKAGE_ID"

approve_for_org cooperativa CooperativaMSP peer0.cooperativa.cacao.local:7051 "$PACKAGE_ID"
approve_for_org certificadora CertificadoraMSP peer0.certificadora.cacao.local:9051 "$PACKAGE_ID"
approve_for_org exportador ExportadorMSP peer0.exportador.cacao.local:11051 "$PACKAGE_ID"

commit_chaincode
smoke_test

echo "Chaincode '$CC_NAME' desplegado y verificado en '$CHANNEL_NAME'."
