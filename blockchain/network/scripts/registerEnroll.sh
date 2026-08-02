#!/usr/bin/env bash
# WP-20: registra y enrola las identidades de cada organización contra su
# Fabric CA (ver docs/WP-20-plan-red-hyperledger-fabric.md §2.1/§2.3).
# Requiere que las 5 CAs ya estén arriba (docker-compose-ca.yaml).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./envVar.sh

# --- Organización validadora (tiene peer): cooperativa | certificadora | exportador ---
register_and_enroll_peer_org() {
  local org=$1 ca_name=$2 ca_host=$3 ca_port=$4
  local domain="$org.cacao.local"
  local peer_org_dir="peerOrganizations/$domain"
  local ca_tls_cert="fabric-ca/$org/tls-cert.pem"
  local ca_url="https://$ca_host:$ca_port"
  local admin_msp="$peer_org_dir/ca-admin-msp"

  echo "== [$org] enrolando admin de la CA (registrador) =="
  fabric_ca_client enroll -u "https://admin:adminpw@$ca_host:$ca_port" --caname "$ca_name" \
    -M "$admin_msp" --tls.certfiles "$ca_tls_cert"

  echo "== [$org] registrando peer0, ${org}admin y ${org}app =="
  fabric_ca_client register -u "$ca_url" --caname "$ca_name" -M "$admin_msp" --tls.certfiles "$ca_tls_cert" \
    --id.name peer0 --id.secret peer0pw --id.type peer
  fabric_ca_client register -u "$ca_url" --caname "$ca_name" -M "$admin_msp" --tls.certfiles "$ca_tls_cert" \
    --id.name "${org}admin" --id.secret "${org}adminpw" --id.type admin
  fabric_ca_client register -u "$ca_url" --caname "$ca_name" -M "$admin_msp" --tls.certfiles "$ca_tls_cert" \
    --id.name "${org}app" --id.secret "${org}apppw" --id.type client

  echo "== [$org] enrolando peer0 (identidad + TLS) =="
  fabric_ca_client enroll -u "https://peer0:peer0pw@$ca_host:$ca_port" --caname "$ca_name" \
    -M "$peer_org_dir/peers/peer0.$domain/msp" --tls.certfiles "$ca_tls_cert"
  write_node_ous_config "$peer_org_dir/peers/peer0.$domain/msp"
  fabric_ca_client enroll -u "https://peer0:peer0pw@$ca_host:$ca_port" --caname "$ca_name" \
    -M "$peer_org_dir/peers/peer0.$domain/tls" --tls.certfiles "$ca_tls_cert" \
    --enrollment.profile tls --csr.hosts "peer0.$domain,localhost"
  normalize_tls_dir "$peer_org_dir/peers/peer0.$domain/tls"

  echo "== [$org] enrolando ${org}admin (Admin de la organización) =="
  fabric_ca_client enroll -u "https://${org}admin:${org}adminpw@$ca_host:$ca_port" --caname "$ca_name" \
    -M "$peer_org_dir/users/Admin@$domain/msp" --tls.certfiles "$ca_tls_cert"
  write_node_ous_config "$peer_org_dir/users/Admin@$domain/msp"

  echo "== [$org] enrolando ${org}app (identidad de aplicación → wallet) =="
  fabric_ca_client enroll -u "https://${org}app:${org}apppw@$ca_host:$ca_port" --caname "$ca_name" \
    -M "$peer_org_dir/users/App@$domain/msp" --tls.certfiles "$ca_tls_cert"
  write_node_ous_config "$peer_org_dir/users/App@$domain/msp"

  # MSP raíz de la organización (la que referencia configtx.yaml): admincerts
  # + cacerts + tlscacerts, sin llave privada — se arma copiando lo ya enrolado.
  local org_msp="$peer_org_dir/msp"
  mkdir -p "$NETWORK_ROOT/organizations/$org_msp"/{cacerts,tlscacerts,admincerts}
  cp "$NETWORK_ROOT/organizations/$peer_org_dir/users/Admin@$domain/msp/cacerts/"*.pem "$NETWORK_ROOT/organizations/$org_msp/cacerts/"
  cp "$NETWORK_ROOT/organizations/$peer_org_dir/users/Admin@$domain/msp/signcerts/"*.pem "$NETWORK_ROOT/organizations/$org_msp/admincerts/"
  cp "$NETWORK_ROOT/organizations/$peer_org_dir/peers/peer0.$domain/tls/ca.crt" "$NETWORK_ROOT/organizations/$org_msp/tlscacerts/tlsca-$org.pem"
  write_node_ous_config "$org_msp"

  # Wallet institucional (WP-16→WP-22): identidad de aplicación lista para usar.
  mkdir -p "$NETWORK_ROOT/../wallets/$org"
  cp -r "$NETWORK_ROOT/organizations/$peer_org_dir/users/App@$domain/msp" "$NETWORK_ROOT/../wallets/$org/msp"
  cp "$NETWORK_ROOT/organizations/$org_msp/tlscacerts/tlsca-$org.pem" "$NETWORK_ROOT/../wallets/$org/tlsca.pem"
}

# --- Organización solo-cliente (sin peer): transportista ---
register_and_enroll_client_org() {
  local org=$1 ca_name=$2 ca_host=$3 ca_port=$4
  local domain="$org.cacao.local"
  local org_dir="peerOrganizations/$domain"
  local ca_tls_cert="fabric-ca/$org/tls-cert.pem"
  local ca_url="https://$ca_host:$ca_port"
  local admin_msp="$org_dir/ca-admin-msp"

  echo "== [$org] enrolando admin de la CA (registrador) =="
  fabric_ca_client enroll -u "https://admin:adminpw@$ca_host:$ca_port" --caname "$ca_name" \
    -M "$admin_msp" --tls.certfiles "$ca_tls_cert"

  echo "== [$org] registrando ${org}admin y ${org}app =="
  fabric_ca_client register -u "$ca_url" --caname "$ca_name" -M "$admin_msp" --tls.certfiles "$ca_tls_cert" \
    --id.name "${org}admin" --id.secret "${org}adminpw" --id.type admin
  fabric_ca_client register -u "$ca_url" --caname "$ca_name" -M "$admin_msp" --tls.certfiles "$ca_tls_cert" \
    --id.name "${org}app" --id.secret "${org}apppw" --id.type client

  echo "== [$org] enrolando ${org}admin =="
  fabric_ca_client enroll -u "https://${org}admin:${org}adminpw@$ca_host:$ca_port" --caname "$ca_name" \
    -M "$org_dir/users/Admin@$domain/msp" --tls.certfiles "$ca_tls_cert"
  write_node_ous_config "$org_dir/users/Admin@$domain/msp"

  echo "== [$org] enrolando ${org}app (identidad de aplicación → wallet) =="
  # Un solo enroll (perfil x509 por defecto). WP-22 §2.3 no usa el
  # tlscacerts propio de esta identidad — la wallet lo toma directamente de
  # fabric-ca/$org/ca-cert.pem más abajo — así que enrolar además con
  # --enrollment.profile tls solo dejaba una segunda llave privada sin uso
  # en el mismo keystore. Eso rompía la firma de transacciones en WP-22:
  # FabricGatewayService toma "la primera" llave del directorio y, con dos
  # presentes, a veces tomaba la que no correspondía al certificado final.
  fabric_ca_client enroll -u "https://${org}app:${org}apppw@$ca_host:$ca_port" --caname "$ca_name" \
    -M "$org_dir/users/App@$domain/msp" --tls.certfiles "$ca_tls_cert"
  write_node_ous_config "$org_dir/users/App@$domain/msp"

  local org_msp="$org_dir/msp"
  mkdir -p "$NETWORK_ROOT/organizations/$org_msp"/{cacerts,tlscacerts,admincerts}
  cp "$NETWORK_ROOT/organizations/$org_dir/users/Admin@$domain/msp/cacerts/"*.pem "$NETWORK_ROOT/organizations/$org_msp/cacerts/"
  cp "$NETWORK_ROOT/organizations/$org_dir/users/Admin@$domain/msp/signcerts/"*.pem "$NETWORK_ROOT/organizations/$org_msp/admincerts/"
  cp "$NETWORK_ROOT/organizations/fabric-ca/$org/ca-cert.pem" "$NETWORK_ROOT/organizations/$org_msp/tlscacerts/tlsca-$org.pem"
  write_node_ous_config "$org_msp"

  mkdir -p "$NETWORK_ROOT/../wallets/$org"
  cp -r "$NETWORK_ROOT/organizations/$org_dir/users/App@$domain/msp" "$NETWORK_ROOT/../wallets/$org/msp"
  cp "$NETWORK_ROOT/organizations/$org_msp/tlscacerts/tlsca-$org.pem" "$NETWORK_ROOT/../wallets/$org/tlsca.pem"
}

# --- Organización del orderer ---
register_and_enroll_orderer_org() {
  local ca_name="ca-orderer" ca_host="ca-orderer.cacao.local" ca_port=11054
  local domain="orderer.cacao.local"
  local orderer_org_dir="ordererOrganizations/$domain"
  local ca_tls_cert="fabric-ca/orderer/tls-cert.pem"
  local ca_url="https://$ca_host:$ca_port"
  local admin_msp="$orderer_org_dir/ca-admin-msp"

  echo "== [orderer] enrolando admin de la CA (registrador) =="
  fabric_ca_client enroll -u "https://admin:adminpw@$ca_host:$ca_port" --caname "$ca_name" \
    -M "$admin_msp" --tls.certfiles "$ca_tls_cert"

  echo "== [orderer] registrando orderer y ordererAdmin =="
  fabric_ca_client register -u "$ca_url" --caname "$ca_name" -M "$admin_msp" --tls.certfiles "$ca_tls_cert" \
    --id.name orderer --id.secret ordererpw --id.type orderer
  fabric_ca_client register -u "$ca_url" --caname "$ca_name" -M "$admin_msp" --tls.certfiles "$ca_tls_cert" \
    --id.name ordererAdmin --id.secret ordererAdminpw --id.type admin

  echo "== [orderer] enrolando orderer (identidad + TLS) =="
  fabric_ca_client enroll -u "https://orderer:ordererpw@$ca_host:$ca_port" --caname "$ca_name" \
    -M "$orderer_org_dir/orderers/orderer.$domain/msp" --tls.certfiles "$ca_tls_cert"
  write_node_ous_config "$orderer_org_dir/orderers/orderer.$domain/msp"
  fabric_ca_client enroll -u "https://orderer:ordererpw@$ca_host:$ca_port" --caname "$ca_name" \
    -M "$orderer_org_dir/orderers/orderer.$domain/tls" --tls.certfiles "$ca_tls_cert" \
    --enrollment.profile tls --csr.hosts "$domain,localhost"
  normalize_tls_dir "$orderer_org_dir/orderers/orderer.$domain/tls"

  echo "== [orderer] enrolando ordererAdmin =="
  fabric_ca_client enroll -u "https://ordererAdmin:ordererAdminpw@$ca_host:$ca_port" --caname "$ca_name" \
    -M "$orderer_org_dir/users/Admin@$domain/msp" --tls.certfiles "$ca_tls_cert"
  write_node_ous_config "$orderer_org_dir/users/Admin@$domain/msp"

  local org_msp="$orderer_org_dir/msp"
  mkdir -p "$NETWORK_ROOT/organizations/$org_msp"/{cacerts,tlscacerts,admincerts}
  cp "$NETWORK_ROOT/organizations/$orderer_org_dir/users/Admin@$domain/msp/cacerts/"*.pem "$NETWORK_ROOT/organizations/$org_msp/cacerts/"
  cp "$NETWORK_ROOT/organizations/$orderer_org_dir/users/Admin@$domain/msp/signcerts/"*.pem "$NETWORK_ROOT/organizations/$org_msp/admincerts/"
  cp "$NETWORK_ROOT/organizations/$orderer_org_dir/orderers/orderer.$domain/tls/ca.crt" "$NETWORK_ROOT/organizations/$org_msp/tlscacerts/tlsca-orderer.pem"
  write_node_ous_config "$org_msp"

  mkdir -p "$NETWORK_ROOT/../wallets/orderer"
  cp -r "$NETWORK_ROOT/organizations/$orderer_org_dir/users/Admin@$domain/msp" "$NETWORK_ROOT/../wallets/orderer/msp"
  cp "$NETWORK_ROOT/organizations/$org_msp/tlscacerts/tlsca-orderer.pem" "$NETWORK_ROOT/../wallets/orderer/tlsca.pem"
}

register_and_enroll_peer_org cooperativa ca-cooperativa ca-cooperativa.cacao.local 7054
register_and_enroll_peer_org certificadora ca-certificadora ca-certificadora.cacao.local 8054
register_and_enroll_peer_org exportador ca-exportador ca-exportador.cacao.local 9054
register_and_enroll_client_org transportista ca-transportista ca-transportista.cacao.local 10054
register_and_enroll_orderer_org

echo "Identidades registradas y enroladas para las 5 organizaciones."
