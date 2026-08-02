import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as grpc from '@grpc/grpc-js';
// Import profundo y explícito a dist/index.js (no al specifier "desnudo"
// '@hyperledger/fabric-gateway'): bajo ts-jest, la resolución del specifier
// desnudo cae en las fuentes TS del paquete (node_modules/.../src/*.ts) en
// vez de en dist/ pese a que package.json "main" apunta a dist/index.js —
// arrastrando dependencias ESM-only (@noble/curves) que rompen los tests.
// Node en ejecución normal (`nest start`) no tiene este problema; es
// específico del resolvedor de Jest/ts-jest para este paquete.
import {
  connect,
  GatewayError,
  type Contract,
  type Gateway,
} from '@hyperledger/fabric-gateway/dist/index.js';
import { FabricGatewayConfig } from './fabric-gateway.config';
import { loadPeerTlsRootCert, loadWalletIdentity } from './fabric-identity';
import { FabricSubmitResult, OrgChaincode } from './types';

interface OrgConnection {
  client: grpc.Client;
  gateway: Gateway;
  contract: Contract;
}

// Endosantes fijos para cada submit — WP-21 §2.6 fija la política del
// chaincode en OutOf(2, Cooperativa, Certificadora, Exportador); cualquier
// 2 de esas 3 organizaciones alcanzan. Se especifican explícitamente en vez
// de dejar que el SDK las descubra automáticamente (discovery) porque
// TransportistaMSP no tiene peer propio (WP-20 §2.1): el descubrimiento de
// endosantes vía gossip falla para una organización sin ningún peer en el
// canal ("access denied: channel ... creator org [TransportistaMSP]"),
// aunque esa misma identidad sí puede firmar y enviar transacciones.
const ENDORSING_ORGANIZATIONS = ['CooperativaMSP', 'CertificadoraMSP'];

// WP-22 · Puente NestJS ↔ Hyperledger Fabric — ver docs/WP-22-plan-fabric-gateway.md.
// Conexión perezosa por organización (§2.2): si la red Fabric no está arriba,
// el resto del backend sigue funcionando; solo fallan las operaciones que
// efectivamente necesitan blockchain, con un 503 claro (§2.5).
@Injectable()
export class FabricGatewayService implements OnModuleDestroy {
  private readonly logger = new Logger(FabricGatewayService.name);
  private readonly connections = new Map<OrgChaincode, OrgConnection>();

  constructor(private readonly config: FabricGatewayConfig) {}

  // Invoca una función de escritura del chaincode y espera su confirmación
  // en el ledger. Fuente de verdad = blockchain (§2.4): si esto rechaza o
  // falla, el servicio llamante no debe escribir en Postgres.
  async submit(
    org: OrgChaincode,
    functionName: string,
    ...args: string[]
  ): Promise<FabricSubmitResult> {
    const contract = await this.getContract(org);
    try {
      const commit = await contract.submitAsync(functionName, {
        arguments: args,
        endorsingOrganizations: ENDORSING_ORGANIZATIONS,
      });
      const result = Buffer.from(commit.getResult()).toString('utf8');
      const status = await commit.getStatus();
      if (!status.successful) {
        throw new ConflictException(
          `La transacción ${functionName} no se confirmó en el ledger (código de validación ${status.code}).`,
        );
      }
      return { transactionId: commit.getTransactionId(), result };
    } catch (error) {
      throw this.translateError(error, functionName);
    }
  }

  // Invoca una función de solo lectura del chaincode (no pasa por el orderer).
  async evaluate(
    org: OrgChaincode,
    functionName: string,
    ...args: string[]
  ): Promise<string> {
    const contract = await this.getContract(org);
    try {
      const result = await contract.evaluateTransaction(functionName, ...args);
      return Buffer.from(result).toString('utf8');
    } catch (error) {
      throw this.translateError(error, functionName);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const { gateway, client } of this.connections.values()) {
      gateway.close();
      client.close();
    }
    this.connections.clear();
  }

  private async getContract(org: OrgChaincode): Promise<Contract> {
    const cached = this.connections.get(org);
    if (cached) {
      return cached.contract;
    }

    try {
      const peerConfig = this.config.peerConnections[org];
      const { identity, signer } = loadWalletIdentity(this.config.walletsPath, org);
      const tlsRootCert = loadPeerTlsRootCert(this.config.walletsPath, peerConfig.tlsOrg);

      const client = new grpc.Client(
        peerConfig.peerEndpoint,
        grpc.credentials.createSsl(tlsRootCert),
      );
      const gateway = connect({ client, identity, signer });
      const network = gateway.getNetwork(this.config.channelName);
      const contract = network.getContract(this.config.chaincodeName);

      this.connections.set(org, { client, gateway, contract });
      return contract;
    } catch (error) {
      this.logger.error(
        `No se pudo inicializar la conexión Fabric Gateway para '${org}': ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'No se pudo conectar con la red blockchain (Hyperledger Fabric).',
      );
    }
  }

  // Clasifica los errores del SDK a las mismas excepciones que ya usa el
  // resto del backend para los mismos casos (§2.5) — sin inventar códigos
  // nuevos ni filtrar detalles internos de gRPC al cliente HTTP.
  private translateError(error: unknown, functionName: string): Error {
    if (
      error instanceof ConflictException ||
      error instanceof BadRequestException ||
      error instanceof ForbiddenException ||
      error instanceof NotFoundException
    ) {
      return error; // ya viene clasificado (p. ej. commit sin éxito, más arriba)
    }

    if (error instanceof GatewayError) {
      const chaincodeMessage = this.extractChaincodeMessage(error);
      if (chaincodeMessage) {
        if (/requiere\s+\S*MSP/i.test(chaincodeMessage)) {
          return new ForbiddenException(chaincodeMessage);
        }
        if (/no existe/i.test(chaincodeMessage)) {
          return new NotFoundException(chaincodeMessage);
        }
        if (/(excede la capacidad|debe ser un número positivo)/i.test(chaincodeMessage)) {
          return new BadRequestException(chaincodeMessage);
        }
        // "ya existe", "se esperaba <ESTADO>" y cualquier otro rechazo de
        // negocio del chaincode que no encaje en los casos anteriores.
        return new ConflictException(chaincodeMessage);
      }

      this.logger.error(
        `Fallo de conexión con Hyperledger Fabric en '${functionName}': ${error.message}`,
      );
      return new ServiceUnavailableException(
        'No se pudo conectar con la red blockchain (Hyperledger Fabric).',
      );
    }

    this.logger.error(
      `Error inesperado invocando '${functionName}': ${(error as Error)?.message ?? error}`,
    );
    return new ServiceUnavailableException(
      'No se pudo conectar con la red blockchain (Hyperledger Fabric).',
    );
  }

  private extractChaincodeMessage(error: GatewayError): string | undefined {
    // `details` solo se puebla cuando un peer endosante respondió con un
    // error (rechazo del chaincode) — si está vacío, es un fallo de
    // conexión/protocolo (timeout, peer caído), no una regla de negocio, y
    // no debe clasificarse como tal aunque error.message tenga texto.
    const detail = error.details.find((d) => d.message && d.message.trim().length > 0);
    if (!detail) {
      return undefined;
    }
    // El peer suele envolver el mensaje del chaincode como
    // "chaincode response 500, <mensaje>" — se extrae el mensaje real si
    // aplica ese formato; si no, se usa el texto tal cual.
    const match = /chaincode response \d+,\s*(.+)/i.exec(detail.message);
    return match ? match[1] : detail.message;
  }
}
