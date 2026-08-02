# Plan de implementación — WP-21 · Smart Contracts (Chaincode)

**Estado:** Propuesto, pendiente de confirmación
**Depende de:** WP-20 (red Fabric operativa — canal `canal-trazabilidad-cacao`, 3 peers validadores + orderer ya unidos), C1/C2/C4 (Plan Maestro §2)
**Cierra:** la lógica de negocio *on-chain*. **No** incluye el puente backend↔Fabric (WP-22, que reemplaza/complementa la validación que hoy solo vive en Postgres) ni el QR público (WP-23).

---

## 1. Qué exige el DoD y cómo se cubre

| Entregable | Cómo se cubre |
|---|---|
| `CreateLot()` … `RegisterExport()`, `GetHistory()` | Clase `LoteContract` (`fabric-contract-api`), una función por cada una de las 6 de C4 (§2.1) |
| Validación de reglas de negocio | Regla de capacidad máxima (Fase I) + autorización por rol/organización (C7) — ambas dentro del chaincode, no solo en el backend (§2.3) |
| Validación de la máquina de estados | Cada función valida `estado` actual contra C1 antes de transicionar (§2.4) |
| Pruebas unitarias y funcionales | Unitarias con Jest + mocks de `Context`/`ChaincodeStub` (mismo framework que el backend); funcionales invocando el chaincode ya desplegado en la red real de WP-20 (§5) |
| Despliegue en Hyperledger Fabric | Ciclo de vida de chaincode de Fabric 2.5 (`package` → `install` ×3 → `approveformyorg` ×3 → `commit`) sobre la red de WP-20 (§4) |

## 2. Decisiones de diseño (C2/C4 no las resuelven del todo — igual que en WP-20, se completan aquí y quedan registradas)

### 2.1 Lenguaje y estructura: TypeScript, `fabric-contract-api`

La estructura del repo ya reservó `blockchain/chaincode/` "en TypeScript" desde WP-00. Se usa `fabric-contract-api` + `fabric-shim` (el SDK oficial de Node para chaincode), con una clase `LoteContract` y un método por función, siguiendo el patrón oficial de `fabric-samples` (bajo riesgo, ya probado). El peer construye el contenedor del chaincode con Docker (el socket ya está montado en los 3 peers desde WP-20 — no hace falta Chaincode-as-a-Service todavía).

### 2.2 Modelo on-chain: el lote completo, con `historialEventos` embebido

C2 define `historialEventos: array` como parte del esquema on-chain del lote. En vez de reconstruirlo a partir del historial nativo de claves de Fabric (`GetHistoryForKey`, que devuelve versiones completas del objeto, no eventos semánticos), cada función **agrega un evento** al array `historialEventos` dentro del mismo objeto `Lote` antes de guardarlo. `GetHistory()` simplemente lee el estado actual y devuelve ese array — más simple, determinístico y más fácil de probar que reconstruir historial desde el ledger nativo.

```ts
interface EventoOnChain {
  tipo: 'CREACION' | 'FERMENTACION' | 'CERTIFICACION' | 'TRANSPORTE' | 'EXPORTACION';
  actorMspId: string;   // ctx.clientIdentity.getMSPID() — nunca un parámetro del cliente
  actorId: string;      // ctx.clientIdentity.getID()
  timestamp: string;    // ctx.stub.getTxTimestamp()
  datos: Record<string, unknown>;
}

interface LoteOnChain {
  docType: 'lote';
  loteId: string;
  productorId: string;
  cooperativaId: string;
  estado: 'CREADO' | 'FERMENTANDO' | 'CERTIFICADO' | 'EN_TRANSPORTE' | 'EXPORTADO';
  capacidadProductivaMaximaKg: number; // ver §2.5 — snapshot para validar RegisterFermentation
  hashCertificado?: string;
  fechaCosecha: string;
  fechaTransporte?: string;
  fechaExportacion?: string;
  historialEventos: EventoOnChain[];
}
```

`firmaDigital` (C2: "firma criptográfica del actor que registra") **no** se recibe como parámetro de ningún método — se deriva de `ctx.clientIdentity.getID()`/`getMSPID()`, que Fabric ya garantiza criptográficamente vía la firma real de la transacción. Aceptar un string de firma como parámetro sería confiar en un dato que el cliente podría falsificar; usar la identidad de la transacción es la fuente correcta y no puede impostarse sin comprometer la llave privada del actor.

### 2.3 Autorización por organización, dentro del chaincode (no solo en el backend)

C7 ya está aplicado en NestJS (WP-10 a WP-15), pero hasta ahora **nadie más que el backend impide** que una transacción llegue directamente al chaincode desde una identidad equivocada — quien tenga una identidad Fabric válida de cualquier organización podría invocar cualquier función si el chaincode no lo revisa. Cada función valida `ctx.clientIdentity.getMSPID()` contra C7 antes de ejecutar:

| Función | MSP requerido |
|---|---|
| `CreateLot`, `RegisterFermentation` | `CooperativaMSP` |
| `RegisterCertification` | `CertificadoraMSP` |
| `RegisterTransport` | `TransportistaMSP` |
| `RegisterExport` | `ExportadorMSP` |
| `GetHistory` | cualquiera (lectura) |

### 2.4 Máquina de estados (C1), validada antes de cada transición

```
CREADO → FERMENTANDO → CERTIFICADO → EN_TRANSPORTE → EXPORTADO
```

Cada función (salvo `CreateLot`, que crea desde cero) lee el lote, verifica que `estado` sea exactamente el anterior en la cadena, y si no lo es devuelve un error de chaincode (equivalente al 409 que ya devuelve el backend para el mismo caso en WP-11 a WP-14). `EXPORTADO` es terminal — no hay transición de vuelta. La corrección auditada (`TipoEvento.CORRECCION`) que WP-15 implementó **no** toca el chaincode: C4 no define ninguna función de corrección, y WP-15 ya la resolvió íntegramente en Postgres — se mantiene así, sin inventar una séptima función on-chain para eso.

### 2.5 `CreateLot`: extensión aditiva registrada (resuelve el pendiente de WP-01/WP-11)

`backend/prisma/schema.prisma` (comentario sobre `Productor.capacidadProductivaMaximaKg`) dejó anotado explícitamente: *"Cómo el chaincode valida RegisterFermentation contra este límite sin duplicarlo on-chain es una decisión abierta para WP-21"*. Se resuelve así, y queda registrado aquí (Plan Maestro §4.2 exige anotar cualquier cambio a C4):

- El chaincode no tiene acceso a Postgres — `RegisterFermentation` no puede validar contra `Productor.capacidadProductivaMaximaKg` si ese dato no está también on-chain.
- Se agrega un **5º parámetro** a `CreateLot`: `capacidadProductivaMaximaKg` (snapshot al momento de crear el lote, coherente con lo que el propio WP-01 ya había anticipado en `database/schema.prisma` con el campo `capacidadEstimadaSnapshotKg`, aunque WP-11 no terminó agregando esa columna en Postgres porque ahí sí puede resolverse con un JOIN en vivo).
- `RegisterFermentation` valida `peso <= capacidadProductivaMaximaKg` contra ese snapshot — la misma regla de Fase I que ya aplica el backend, ahora también aplicada on-chain.
- Este 5º parámetro lo llenará WP-22 (Fabric Gateway) leyendo `Productor.capacidadProductivaMaximaKg` de Postgres al momento de invocar `CreateLot` — no es responsabilidad de este WP.

### 2.6 Política de endoso del chaincode: `OutOf(2, Cooperativa, Certificadora, Exportador)`

Es la traducción concreta de "PoA — validadores: cooperativas, exportadores, certificadoras" (Fase II) al nivel del propio chaincode — no solo del orderer (que ya se resolvió en WP-20 §2.2). Se fija explícitamente al hacer `commit` (`--signature-policy "OutOf(2, 'CooperativaMSP.peer','CertificadoraMSP.peer','ExportadorMSP.peer')"`), en vez de heredar la política de canal por defecto:

- Exige mayoría de los 3 validadores (2 de 3) — sigue funcionando si a uno de los tres se le cae el peer.
- `TransportistaMSP` puede **enviar** transacciones (`RegisterTransport`) pero nunca es parte del conjunto de endosantes — es cliente, no validador (mismo criterio de WP-20 §2.1).
- La aprobación del *ciclo de vida* del chaincode (`approveformyorg`/`commit`) es una capa distinta y separada del endoso de cada invocación — la gobierna la política de canal `LifecycleEndorsement` que ya quedó fija en `configtx.yaml` (WP-20): `MAJORITY Endorsement` sobre las 4 organizaciones del canal. Como `TransportistaMSP` no tiene peer, nunca podrá correr `approveformyorg` — no bloquea nada, porque los 3 validadores ya alcanzan la mayoría (3 de 4) sin necesitar su voto.

## 3. Estructura de archivos

```
blockchain/chaincode/
├── package.json
├── tsconfig.json
├── jest.config.js
├── src/
│   ├── types.ts            # LoteOnChain, EventoOnChain, EstadoLote
│   ├── loteContract.ts     # clase LoteContract — las 6 funciones de C4 + validaciones (§2.3/§2.4)
│   └── index.ts            # entrypoint (exporta el/los contrato(s))
└── test/
    └── loteContract.spec.ts
```

## 4. Despliegue (sobre la red ya viva de WP-20)

Nuevo script `blockchain/network/scripts/deployChaincode.sh`, agregado como comando `deployChaincode` de `network.sh`:

1. `peer lifecycle chaincode package` — empaqueta `blockchain/chaincode/` (compilado a JS) como `lote-contract.tar.gz`.
2. `peer lifecycle chaincode install` en los 3 peers validadores (Cooperativa, Certificadora, Exportador) — cada organización instala por separado, mismo patrón de scripts por-organización de WP-20.
3. `peer lifecycle chaincode approveformyorg` — cada una de las 3 organizaciones aprueba la definición, con la política de endoso de §2.6.
4. `peer lifecycle chaincode commit` — se confirma en el canal en cuanto las 3 aprobaciones satisfacen `MAJORITY Endorsement` (§2.6).
5. Invocación de humo (`peer chaincode invoke`) creando un lote de prueba y verificando `GetHistory` — confirma que el chaincode realmente corre, no solo que se instaló.

## 5. Verificación planeada

- **Unitarias** (Jest, mocks de `Context`/`ChaincodeStub`/`ClientIdentity` — sin red real): un caso por función × (camino feliz, estado incorrecto, organización no autorizada); además, el caso específico de `RegisterFermentation` con peso mayor a la capacidad (§2.5).
- **Funcionales** (contra la red real de WP-20, ya desplegado): recorrido completo `CreateLot → RegisterFermentation → RegisterCertification → RegisterTransport → RegisterExport`, con `GetHistory` devolviendo los 5 eventos en orden; cada salto de estado inválido devuelve error; una organización no autorizada (p. ej. `TransportistaMSP` llamando `RegisterCertification`) es rechazada.
- Checklist final: `peer lifecycle chaincode querycommitted` en los 3 peers confirma la misma versión/secuencia del chaincode comprometida.

## 6. Fuera de alcance (explícitamente)

- Fabric Gateway / integración con NestJS (WP-22) — este WP se verifica con `peer chaincode invoke/query` directo, no desde el backend.
- Código QR / consulta pública (WP-23).
- Transacción de corrección on-chain (§2.4 — no existe en C4; WP-15 ya la resolvió fuera de la cadena).
- CouchDB / índices ricos (ya descartado en WP-20 §2.4; `GetHistory` no los necesita con el diseño de §2.2).
- Chaincode-as-a-Service — se usa el build clásico con Docker (§2.1), ya provisionado desde WP-20.
- Actualizaciones/versionado del chaincode más allá de la v1 inicial.

---

¿Confirmas que proceda con estos pasos?
