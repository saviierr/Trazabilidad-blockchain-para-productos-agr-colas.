import { createPrivateKey } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// Import profundo — ver el comentario en fabric-gateway.service.ts.
import type { Identity, Signer } from '@hyperledger/fabric-gateway/dist/index.js';
import { signers } from '@hyperledger/fabric-gateway/dist/index.js';
import { MSP_ID_BY_ORG, OrgChaincode } from './types';

export interface WalletIdentity {
  identity: Identity;
  signer: Signer;
}

// Carga la identidad institucional compartida por tipo de organización desde
// blockchain/wallets/<org>/msp — generada en tiempo de ejecución por
// blockchain/network/scripts/registerEnroll.sh (WP-20). Ver
// docs/WP-22-plan-fabric-gateway.md §2.1.
export function loadWalletIdentity(
  walletsPath: string,
  org: OrgChaincode,
): WalletIdentity {
  const mspDir = join(walletsPath, org, 'msp');
  const certPath = join(mspDir, 'signcerts', 'cert.pem');
  const keystoreDir = join(mspDir, 'keystore');

  // Debe haber exactamente una llave: si `registerEnroll.sh` alguna vez
  // vuelve a enrolar esta identidad dos veces sin limpiar el keystore, dos
  // llaves ahí dentro son indistinguibles desde aquí y una firma con la
  // llave equivocada falla en el peer con un error opaco ("signature is
  // invalid") en vez de acá, con contexto — mejor fallar alto y claro.
  const keyFiles = readdirSync(keystoreDir);
  if (keyFiles.length === 0) {
    throw new Error(`No se encontró una llave privada en ${keystoreDir}`);
  }
  if (keyFiles.length > 1) {
    throw new Error(
      `Se esperaba una única llave privada en ${keystoreDir}, se encontraron ${keyFiles.length}: ${keyFiles.join(', ')}`,
    );
  }
  const [keyFile] = keyFiles;

  const credentials = readFileSync(certPath);
  const privateKey = createPrivateKey(readFileSync(join(keystoreDir, keyFile)));

  return {
    identity: { mspId: MSP_ID_BY_ORG[org], credentials },
    signer: signers.newPrivateKeySigner(privateKey),
  };
}

// TLS root CA para verificar el certificado del peer al que se conecta — no
// siempre coincide con la organización que firma la transacción (§2.3 del
// plan: TransportistaMSP no tiene peer propio y se conecta vía el de Cooperativa).
export function loadPeerTlsRootCert(
  walletsPath: string,
  tlsOrg: OrgChaincode,
): Buffer {
  return readFileSync(join(walletsPath, tlsOrg, 'tlsca.pem'));
}
