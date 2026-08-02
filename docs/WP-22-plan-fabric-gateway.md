# Plan de implementación — WP-22 · Integración Backend con Hyperledger Fabric (Fabric Gateway)

**Estado:** Propuesto, pendiente de confirmación
**Depende de:** WP-21 (chaincode desplegado y verificado en la red real — ver [docs/WP-21-plan-chaincode.md](./WP-21-plan-chaincode.md)), WP-10 a WP-15 (los 5 flujos de escritura que hoy solo tocan Postgres: recepción, fermentación, certificación, transporte, exportación), WP-20 (wallets institucionales en `blockchain/wallets/<org>/`, peers expuestos en `localhost` desde Docker)
**Cierra:** el puente backend↔Fabric. Con esto, de Sprint 2 solo queda pendiente WP-23 (QR público).
**Punto de repliegue (Plan Maestro §1, riesgo R3):** si la conexión gRPC desde el backend nativo de Windows hacia los peers dockerizados resulta inestable, el repliegue es narrar la integración con las pruebas de integración documentadas en este plan (§5) como evidencia, sin necesidad de dejarlo corriendo 100% del tiempo — el chaincode en sí (WP-21) ya está probado y funcional de forma aislada.

---

## 1. Qué exige el DoD y cómo se cubre

| Entregable | Cómo se cubre |
|---|---|
| Configuración de Fabric Gateway | Módulo `backend/src/fabric-gateway/` — una conexión gRPC+TLS por organización, reutilizando las wallets ya generadas por WP-20 (§2.1) |
| Conexión NestJS ↔ Hyperledger Fabric | `FabricGatewayService`, conexión perezosa (lazy) por organización, cacheada tras el primer uso (§2.2) |
| Invocación de las funciones del chaincode desde el backend | Los 5 flujos de escritura existentes (WP-11 a WP-14) llaman a `CreateLot`/`RegisterFermentation`/`RegisterCertification`/`RegisterTransport`/`RegisterExport` (§2.3) |
| Registro de transacciones reales en la blockchain | Cadena-primero: el chaincode se invoca **antes** de escribir en Postgres; si lo rechaza, no hay escritura off-chain (§2.4) |
| Hash de cada transacción almacenado en PostgreSQL | `transaction.getTransactionId()` del SDK se guarda en `Lote.ultimaTxHashBlockchain` / `Evento.hashTransaccionBlockchain` (campos que WP-01 ya dejó reservados y nulos) |
| Sincronización on-chain / off-chain | Por construcción (§2.4) + endpoint de verificación en vivo `GET /lotes/:id/blockchain` (§2.6) |
| Manejo de errores y validaciones de la integración | `FabricGatewayService` clasifica `GatewayError` del SDK en excepciones NestJS ya usadas en el resto del backend (409/400/403/503) (§2.5) |
| Endpoints REST integrados con la blockchain | Los mismos 5 endpoints de C5 (sin cambiar sus rutas ni DTOs) + 1 nuevo endpoint de solo lectura (§2.6) |
| Pruebas de integración Backend ↔ Fabric | Unitarias con el SDK mockeado + e2e contra la red real ya desplegada por WP-21 (§5) |

## 2. Decisiones de diseño (C4/C5/C7 no las resuelven del todo — se completan aquí, mismo criterio que WP-20/WP-21)

### 2.1 Identidad institucional compartida por tipo de organización (no por institución de Postgres)

WP-20 §2.1 ya dejó anotado este pendiente: Postgres siembra **dos** filas por tipo de organización (`cooperativa-demo-msp`, `cooperativa2-demo-msp`, etc. — ver `prisma/seed.ts`), pero Fabric solo tiene **una** identidad de aplicación por tipo (`blockchain/wallets/cooperativa/`, no una por institución). Se resuelve así, y queda registrado aquí como exige el Plan Maestro §4.2:

- El backend usa **una única identidad Fabric por tipo de organización** (Cooperativa, Certificadora, Transportista, Exportador) para firmar transacciones, sin importar cuál fila concreta de Postgres (`cooperativa-demo-msp` o `cooperativa2-demo-msp`) pertenece el usuario autenticado.
- La trazabilidad de **qué institución concreta** actuó se sigue resolviendo off-chain, exactamente como ya existe hoy: `Evento.actorUsuarioId` / `Evento.actorOrganizacionId` en Postgres. On-chain, `EventoOnChain.actorId` reflejará el certificado x509 de la identidad institucional compartida, no el de la institución individual.
- Mapear cada institución a su propia identidad Fabric (multi-tenant real dentro de un mismo MSP) queda **fuera de alcance** — es una limitación del MVP que se documentará honestamente en WP-41, no algo que WP-22 deba resolver.

### 2.2 Conexión perezosa (lazy) y cacheada, no eager en `OnModuleInit`

Si las 4 conexiones gRPC se abrieran al arrancar Nest (`OnModuleInit`), un backend levantado sin la red Fabric corriendo (p. ej. trabajando solo en frontend, o en CI sin Docker) fallaría **completo**, incluyendo módulos que no tocan blockchain (Auth, Productores, Dashboard). En vez de eso:

- `FabricGatewayService` abre la conexión (`grpc.Client` + `Gateway` + `Network` + `Contract`) la **primera vez** que se necesita esa organización, y la cachea en memoria para las siguientes invocaciones.
- Si la conexión falla (red caída), se lanza `ServiceUnavailableException` (503) solo en las peticiones que efectivamente necesitan blockchain — el resto del backend sigue funcionando.
- `onModuleDestroy()` cierra ordenadamente los `grpc.Client` abiertos al apagar el proceso.

### 2.3 Mapeo de organización → conexión física (identidad ≠ peer de conexión)

`TransportistaMSP` no tiene peer propio (WP-20 §2.1) — ya se demostró en WP-21 §5 que un cliente `TransportistaMSP` puede enviar propuestas a través del peer de **otra** organización. Esto exige separar dos cosas que normalmente coinciden:

| Organización (identidad que firma) | Wallet (`blockchain/wallets/<org>/msp`) | Peer al que se conecta | TLS root CA para verificar ese peer |
|---|---|---|---|
| `CooperativaMSP` | `cooperativa` | `peer0.cooperativa.cacao.local:7051` | `wallets/cooperativa/tlsca.pem` |
| `CertificadoraMSP` | `certificadora` | `peer0.certificadora.cacao.local:9051` | `wallets/certificadora/tlsca.pem` |
| `ExportadorMSP` | `exportador` | `peer0.exportador.cacao.local:11051` | `wallets/exportador/tlsca.pem` |
| `TransportistaMSP` | `transportista` | `peer0.cooperativa.cacao.local:7051` (sin peer propio) | `wallets/cooperativa/tlsca.pem` (el del peer al que se conecta, **no** el de Transportista) |

El backend corre nativo en Windows (no dockerizado hasta WP-31), así que se conecta a los peers vía los puertos ya publicados al host por `docker-compose-net.yaml` (`localhost:7051/9051/11051`). Los certificados TLS de los peers ya incluyen `localhost` como SAN (`registerEnroll.sh`, `--csr.hosts "peer0.$domain,localhost"`), así que no hace falta *hostname override* en el cliente gRPC.

### 2.4 Orden de escritura: chaincode primero, Postgres después (blockchain como fuente de verdad)

Los 5 servicios (`CooperativasService.recepcion/registrarFermentacion`, `CertificadosService.create`, `TransportesService.create`, `ExportacionesService.create`) hoy validan y escriben directo en Postgres. Se reordena cada uno así:

1. Los chequeos rápidos que ya existen (lote existe, pertenece a la organización, estado correcto, peso ≤ capacidad) **se mantienen** — evitan una llamada de red innecesaria para una petición obviamente inválida.
2. Se invoca la función de chaincode correspondiente. Si el chaincode la rechaza (p. ej. una carrera entre dos peticiones concurrentes que Postgres no alcanzó a detectar), **no se escribe nada en Postgres** — el chaincode es la autoridad final, coherente con que WP-21 ya implementa las mismas reglas de negocio on-chain.
3. Solo si el chaincode confirma la transacción, se ejecuta el `INSERT`/`UPDATE` en Postgres (dentro de la misma lógica que ya existe), guardando `transactionId` en `Lote.ultimaTxHashBlockchain` y `Evento.hashTransaccionBlockchain`.

Riesgo residual, documentado y no resuelto aquí (ver §2.6 y §6): si el chaincode confirma pero la escritura en Postgres falla justo después (p. ej. caída de la base de datos en ese instante), el ledger queda "adelantado" respecto a la proyección de lectura. No se implementa compensación automática — es la misma clase de limitación que cualquier integración de dos sistemas sin transacción distribuida.

### 2.5 Clasificación de errores del SDK a excepciones NestJS ya usadas en el backend

El SDK de `@hyperledger/fabric-gateway` lanza `GatewayError` (fallo de endorso/commit, con el mensaje real del chaincode embebido — los mismos strings que ya prueba `blockchain/chaincode/test/loteContract.spec.ts`) o errores de conexión gRPC (`UNAVAILABLE`, etc.). `FabricGatewayService` centraliza la traducción:

- Mensaje de chaincode que ya conocemos (`excede la capacidad`, `se esperaba <ESTADO>`, `ya existe`, `no existe`) → `ConflictException` (409) o `BadRequestException` (400), igual que ya lanzan hoy las validaciones de Postgres para el mismo caso — no se inventan códigos nuevos.
- Mensaje de autorización (`requiere <MSP>`) → `ForbiddenException` (403). En la práctica no debería dispararse casi nunca (los `@Roles()` de NestJS ya restringen por rol antes de llegar aquí), pero si ocurre es una señal real de que el mapeo Rol↔MSP se rompió — no se oculta.
- Error de conexión/timeout gRPC → `ServiceUnavailableException` (503) con un mensaje genérico ("no se pudo conectar con la red blockchain"), sin filtrar detalles internos de gRPC al cliente HTTP.

### 2.6 Endpoint de verificación de sincronización (sin reparación automática)

Para que "sincronización on-chain/off-chain" sea algo verificable y no solo una afirmación de diseño, se agrega `GET /lotes/:id/blockchain` (mismo alcance "solo propio" que ya aplica `LotesService.findOne`, C7): llama `QueryLote` (evaluación de solo lectura, cualquier identidad sirve — se usa la de Cooperativa por defecto) y devuelve el estado on-chain junto a un booleano `sincronizado` (compara `estado` y `hashCertificado` contra la fila de Postgres). **Es de solo lectura** — si detecta una divergencia, la reporta; no la corrige automáticamente (ver §6, es una limitación reconocida, no un bug).

### 2.7 Parámetro `firmaCertificadora` de C4: sin PKI de documento, se reutiliza el hash SHA-256

`RegisterCertification(loteId, hashCertificado, firmaCertificadora)` es la firma fija de C4 (Plan Maestro §2). Ningún WP anterior implementó una PKI real para que la Certificadora firme criptográficamente el PDF en sí (distinto de que Fabric ya firma la *transacción* vía la identidad `CertificadoraMSP`, eso es gratis y ya lo cubre WP-21 §2.2). No se improvisa una firma falsa: se reutiliza el mismo hash SHA-256 del archivo (`CertificadosService.create` ya lo calcula) como valor de `firmaCertificadora`, documentado explícitamente como simplificación del MVP — implementar una PKI de documentos completa queda fuera de alcance (§6).

## 3. Estructura de archivos

```
backend/src/fabric-gateway/            # carpeta ya reservada en la estructura del repo desde WP-00
├── fabric-gateway.module.ts           # @Global() — evita reimportar en cada módulo consumidor
├── fabric-gateway.service.ts          # submit()/evaluate() por organización, conexión lazy (§2.2)
├── fabric-gateway.config.ts           # lee y valida las variables de entorno de §4
├── fabric-identity.ts                 # carga cert+key de blockchain/wallets/<org>/msp → Identity/Signer
├── types.ts                           # enum OrgChaincode, tipos de resultado
└── fabric-gateway.service.spec.ts     # unitarias, SDK mockeado (§5)

backend/test/
└── fabric-gateway.e2e-spec.ts         # integración contra la red real (§5)
```

Módulos existentes que cambian (sin tocar sus rutas ni DTOs — C5 no se modifica):

```
backend/src/cooperativas/cooperativas.service.ts     # recepcion() → CreateLot, registrarFermentacion() → RegisterFermentation
backend/src/certificadoras/certificados.service.ts   # create() → RegisterCertification
backend/src/transportistas/transportes.service.ts    # create() → RegisterTransport
backend/src/exportaciones/exportaciones.service.ts   # create() → RegisterExport
backend/src/lotes/lotes.service.ts                   # + método para GET /lotes/:id/blockchain (§2.6)
backend/src/lotes/lotes.controller.ts                # + ruta GET /lotes/:id/blockchain
```

## 4. Configuración (`.env` / `.env.example`)

```
FABRIC_CHANNEL_NAME="canal-trazabilidad-cacao"
FABRIC_CHAINCODE_NAME="lote-contract"
FABRIC_WALLETS_PATH="../blockchain/wallets"        # relativo a backend/, o ruta absoluta

FABRIC_COOPERATIVA_PEER_ENDPOINT="localhost:7051"
FABRIC_CERTIFICADORA_PEER_ENDPOINT="localhost:9051"
FABRIC_EXPORTADOR_PEER_ENDPOINT="localhost:11051"
# TransportistaMSP no tiene peer propio (§2.3) — se enruta por el peer de Cooperativa;
# no es una variable de entorno independiente, es una decisión de arquitectura fija.
```

Nuevas dependencias (`backend/package.json`): `@hyperledger/fabric-gateway`, `@grpc/grpc-js`. La firma de transacciones usa el módulo `crypto` nativo de Node (claves EC P-256 de Fabric CA) — no hace falta ninguna librería adicional para eso.

## 5. Verificación planeada

- **Unitarias** (Jest, SDK de `@hyperledger/fabric-gateway` mockeado — sin red real):
  - `FabricGatewayService`: éxito, y cada rama de clasificación de error de §2.5.
  - Cada uno de los 5 métodos de servicio (con `FabricGatewayService` mockeado): confirma que se llama a la función de chaincode correcta con los argumentos correctos, en el orden correcto (§2.4), y que un rechazo del mock aborta la escritura en Postgres (no queda fila a medias).
- **Integración/e2e** (contra la red real, ya desplegada y probada por WP-21 — requiere `blockchain/network/network.sh up` + `deployChaincode` primero):
  - Recorrido HTTP completo `POST /cooperativas/recepcion → .../fermentacion → POST /certificados → POST /transporte → POST /exportaciones`, confirmando que cada fila queda con `ultimaTxHashBlockchain`/`hashTransaccionBlockchain` poblado.
  - `GET /lotes/:id/blockchain` devuelve `sincronizado: true` tras el recorrido.
  - Caso negativo HTTP (peso que excede la capacidad máxima) devuelve 409 con el mismo mensaje que ya prueba `loteContract.spec.ts` a nivel de chaincode — confirma que el rechazo viaja intacto desde el chaincode hasta la respuesta HTTP.
  - Con la red apagada (`network.sh down`) a mitad de la prueba: los 5 endpoints devuelven 503, no 500 genérico ni timeout colgado — confirma §2.5.
- **Consecuencia operativa que queda documentada, no oculta:** desde este WP en adelante, los e2e existentes que ejercitan recepción/fermentación/certificación/transporte/exportación (`backend/test/lotes.e2e-spec.ts`) también requieren la red Fabric arriba para pasar — antes solo necesitaban Postgres.

## 6. Fuera de alcance (explícitamente)

- Código QR / endpoint público de solo lectura (WP-23).
- PKI real de firma de documentos para `firmaCertificadora` (§2.7) — se documenta la simplificación, no se construye la PKI.
- Reconciliación **automática** on-chain/off-chain — el endpoint de §2.6 detecta y reporta, no repara.
- Identidad Fabric individual por institución de Postgres (§2.1) — se mantiene la identidad institucional compartida por tipo, ya anotada como pendiente desde WP-20.
- Resiliencia avanzada de la conexión gRPC (retry con backoff exponencial, circuit breaker, pool de conexiones) — MVP con conexión lazy cacheada (§2.2) y manejo de errores simple (§2.5), sin librería de resiliencia dedicada.
- Dockerización del backend (WP-31) — sigue corriendo nativo en Windows durante todo Sprint 2, conectándose a los peers vía `localhost`.

---

¿Confirmas que proceda con estos pasos?
