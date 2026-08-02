#!/usr/bin/env bash
# WP-20: variables compartidas por los scripts de la red. Ver
# docs/WP-20-plan-red-hyperledger-fabric.md.
set -euo pipefail

# Raíz de blockchain/network/ y blockchain/chaincode/, sin importar desde
# dónde se invoque el script.
export NETWORK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export CHAINCODE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../chaincode" && pwd)"
export FABRIC_CA_CLIENT_IMAGE="hyperledger/fabric-ca:1.5"
export FABRIC_TOOLS_IMAGE="hyperledger/fabric-tools:2.5"
export DOCKER_NETWORK="cacao-fabric"
export CHANNEL_NAME="canal-trazabilidad-cacao"

# MSYS_NO_PATHCONV evita que Git Bash (MSYS2) reescriba rutas POSIX como
# /organizations a rutas de Windows antes de pasarlas a `docker run` — el
# contenedor las necesita tal cual, son rutas dentro de Linux.

# Ejecuta fabric-ca-client dentro de un contenedor efímero en la red Docker
# compartida (§2.5 del plan — sin binarios nativos en Windows).
fabric_ca_client() {
  # FABRIC_CA_CLIENT_HOME se fija explícito: la imagen trae un default propio
  # (la home del server), y fabric-ca-client resuelve rutas relativas (-M,
  # --tls.certfiles) contra esa variable, no contra -w.
  MSYS_NO_PATHCONV=1 docker run --rm --network "$DOCKER_NETWORK" \
    -v "$NETWORK_ROOT/organizations:/organizations" \
    -w /organizations \
    -e FABRIC_CA_CLIENT_HOME=/organizations \
    "$FABRIC_CA_CLIENT_IMAGE" fabric-ca-client "$@"
}

# Ejecuta configtxgen/peer/osnadmin dentro de fabric-tools.
fabric_tools() {
  MSYS_NO_PATHCONV=1 docker run --rm --network "$DOCKER_NETWORK" \
    -v "$NETWORK_ROOT:/network" \
    -v "$CHAINCODE_ROOT:/chaincode" \
    -w /network \
    "$FABRIC_TOOLS_IMAGE" "$@"
}

# Ejecuta `peer` autenticado como el Admin de una organización — usado para
# unir peers al canal (WP-20 §5) y el ciclo de vida del chaincode (WP-21 §4).
# Rutas relativas a blockchain/network/; monta también blockchain/chaincode/
# en /chaincode para `peer lifecycle chaincode package`.
peer_cli() {
  local msp_id=$1 admin_msp=$2 peer_address=$3 tls_root_cert=$4; shift 4
  MSYS_NO_PATHCONV=1 docker run --rm --network "$DOCKER_NETWORK" \
    -v "$NETWORK_ROOT:/network" \
    -v "$CHAINCODE_ROOT:/chaincode" \
    -w /network \
    -e CORE_PEER_TLS_ENABLED=true \
    -e CORE_PEER_LOCALMSPID="$msp_id" \
    -e CORE_PEER_MSPCONFIGPATH="$admin_msp" \
    -e CORE_PEER_ADDRESS="$peer_address" \
    -e CORE_PEER_TLS_ROOTCERT_FILE="$tls_root_cert" \
    "$FABRIC_TOOLS_IMAGE" peer "$@"
}

# Todas las rutas que reciben estas funciones son relativas a
# blockchain/network/organizations/ (igual que los argumentos de fabric_ca_client).

# NodeOUs — se copia en cada carpeta MSP para que las políticas basadas en
# unidad organizacional (OR('CooperativaMSP.peer'), etc.) funcionen.
write_node_ous_config() {
  local msp_dir=$1
  local base="$NETWORK_ROOT/organizations/$msp_dir"
  local ca_cert_file
  ca_cert_file=$(basename "$(ls "$base/cacerts/"*.pem | head -1)")
  cat > "$base/config.yaml" <<EOF
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/$ca_cert_file
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/$ca_cert_file
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/$ca_cert_file
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/$ca_cert_file
    OrganizationalUnitIdentifier: orderer
EOF
}

# Normaliza la salida de un enroll con --enrollment.profile tls al layout que
# esperan peer/orderer: server.crt, server.key, ca.crt.
normalize_tls_dir() {
  local tls_dir=$1
  local base="$NETWORK_ROOT/organizations/$tls_dir"
  cp "$base"/signcerts/cert.pem "$base/server.crt"
  cp "$base"/keystore/*_sk "$base/server.key"
  cp "$base"/tlscacerts/*.pem "$base/ca.crt"
}
