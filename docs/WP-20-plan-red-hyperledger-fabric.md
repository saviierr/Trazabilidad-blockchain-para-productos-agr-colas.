# Plan de implementación — WP-20 · Red Hyperledger Fabric

**Estado:** Propuesto, pendiente de confirmación
**Depende de:** Fase II (tipo de blockchain, consenso, actores — Plan Maestro §0), WP-01 (`Organizacion.mspId`, `Organizacion.esValidadorRed` ya anticipan esta red desde WP-01/seed.ts)
**Abre:** Sprint 2 — Integración blockchain. **No** incluye chaincode (WP-21) ni el puente backend↔Fabric (WP-22): WP-20 termina cuando la red está arriba, con canal creado y organizaciones unidas — sin ninguna función de negocio todavía.
**Punto de repliegue (Plan Maestro §1, riesgo R3):** si esta red no llega a levantar de forma estable, el Sprint 2 puede cerrarse documentando una simulación/testnet local sin perder la Fase III, siempre que WP-21 (chaincode) quede funcional y probado de forma aislada. Este plan apunta a la red real, no a la simulación — el repliegue es un contingente, no el objetivo.

---

## 1. Qué exige el DoD y cómo se cubre

| Entregable | Cómo se cubre |
|---|---|
| Organizaciones participantes | 4 organizaciones de canal + 1 de orderer (§2.1) |
| Peers | 1 peer por organización *validadora* (3 peers) |
| Orderer | 1 nodo Raft (single-node, MVP — ver §2.2) |
| Fabric CA | 1 servidor Fabric CA por organización (5 CAs) — el DoD pide explícitamente Fabric CA, no `cryptogen` |
| Canal | `configtxgen` genera el bloque de configuración de aplicación; `peer channel create` |
| Unión al canal | `peer channel join` en cada uno de los 3 peers |
| Wallets institucionales | identidad admin + identidad de aplicación por organización, enroladas vía Fabric CA, en `blockchain/wallets/<org>/` |
| Docker Compose | `blockchain/network/docker/docker-compose-ca.yaml` (CAs) + `docker-compose-net.yaml` (peers + orderer) |
| Verificación | script `network.sh verify` + checklist manual (§5) |

## 2. Decisiones de arquitectura (no las define C1-C8 — se resuelven aquí, con el mismo criterio ya usado en WPs anteriores de completar lo que el contrato no especifica)

### 2.1 Organizaciones: 4 + orderer, no una por cada fila de `Organizacion` en Postgres

Fase II fija los validadores por **tipo de actor** ("cooperativas, exportadores, certificadoras"), no por institución individual. Postgres ya tiene `mspId` único *por fila* (`cooperativa-demo-msp`, `cooperativa2-demo-msp`, …, sembrado desde WP-10/11) — pero crear una organización Fabric distinta por cada cooperativa/certificadora/exportador que se registre en el sistema no escala y no es lo que describe Fase II. Se resuelve así:

- **`CooperativaMSP`, `CertificadoraMSP`, `ExportadorMSP`** — organizaciones *validadoras* (con peer propio), una por tipo de actor, coincide con `esValidadorRed: true` ya sembrado para esos tres tipos en `seed.ts`.
- **`TransportistaMSP`** — organización de *solo cliente* (tiene Fabric CA propia para emitir identidades, pero **no** tiene peer ni participa como endosante). C4 define `RegisterTransport(...)`, así que Transportista sí necesita firmar y enviar transacciones — pero Fase II no lo lista como validador (`esValidadorRed: false` en `seed.ts`), así que no aloja un peer. Es un patrón estándar de Fabric (organización cliente sin peer).
- **`OrdererMSP`** — organización del servicio de ordenamiento, separada de las anteriores (patrón estándar de Fabric).
- **Productor y Comprador no tienen identidad Fabric**: C4 no define ninguna función que ellos invoquen directamente (`CreateLot` lo llama la Cooperativa, con `productorId` como dato) y Comprador es "público, solo lectura" (C7) — se resuelve en WP-23 vía el endpoint público, no vía una identidad on-chain.
- **Reconciliación con `Organizacion.mspId` de Postgres**: el `mspId` ya sembrado (`cooperativa-demo-msp`, etc.) seguirá siendo un identificador *lógico* en Postgres, pero **no** es 1:1 con el MSP real de Fabric (`CooperativaMSP`, compartido por todas las cooperativas). Mapear cada institución a una identidad concreta dentro de su MSP compartido es tarea de **WP-22** (Fabric Gateway), no de este WP — queda anotado explícitamente para no repetirlo por descuido.

### 2.2 Orderer: Raft de un solo nodo (simplificación de MVP, documentada)

Fase II describe el consenso como "PoA — validadores: cooperativas, exportadores, certificadoras". Fabric no tiene un modo "PoA" nombrado así: el mecanismo real es **Raft** (ordenamiento tolerante a fallos, con nodos permisionados) — es la traducción técnica correcta del PoA descrito en Fase II, y así se documentará en WP-40/41 (consolidación / viabilidad).

Para WP-20 se levanta **un solo nodo orderer** bajo `OrdererMSP`, no 3 nodos (uno por organización validadora). Un clúster Raft de 3+ nodos es más fiel al espíritu "multi-validador" de PoA, pero también es la parte de Fabric con más puntos de falla en un entorno Docker/Windows nuevo (certificados TLS cruzados entre nodos, `configtx.yaml` de consenso más complejo). Dado el riesgo R3 ya identificado en el Plan Maestro, se prioriza tener una red **que efectivamente levante y sea verificable** sobre la fidelidad completa del clúster Raft. Un clúster Raft multi-nodo queda anotado como mejora futura (WP-44, escalabilidad) — no es requerido por el DoD de este WP (que solo pide "la red se inicie correctamente", no un orderer distribuido).

### 2.3 Fabric CA (no `cryptogen`)

El DoD pide explícitamente "Configuración de Fabric CA", así que las identidades (admins, peers, orderer, usuarios de aplicación) se generan **registrando y enrolando contra un servidor Fabric CA real** por organización (`fabric-ca-server` + `fabric-ca-client`), no con la herramienta estática `cryptogen`. Esto es además lo correcto para que WP-22 pueda inscribir usuarios nuevos dinámicamente (una cooperativa nueva que se registre en el sistema necesitará una identidad Fabric emitida en caliente, no pre-generada).

### 2.4 TLS habilitado, canal único, LevelDB (no CouchDB)

- **TLS**: habilitado en CAs, peers y orderer — se sigue el patrón ya probado de `fabric-samples/test-network` (con SANs apuntando a los nombres de servicio de Docker) en vez de inventar una variante sin TLS. Copiar un patrón ya validado reduce el riesgo real más que "simplificar" quitando TLS.
- **Canal**: uno solo, `canal-trazabilidad-cacao` — C5/C4 no requieren más de un canal.
- **Base de estado**: LevelDB (la que trae Fabric por defecto), no CouchDB. CouchDB solo aporta consultas enriquecidas por campo, que ningún endpoint de C4/C5 necesita todavía (`GetHistory` es un query por clave, no por campo) — se puede agregar en WP-21 si hiciera falta, sin tocar este WP.

### 2.5 Herramientas vía contenedor, no binarios nativos en Windows

`configtxgen`, `configtxlator`, `peer` CLI y `fabric-ca-client` se ejecutan **dentro de contenedores** (`hyperledger/fabric-tools`, `hyperledger/fabric-ca`), invocados desde los scripts con `docker run`/`docker exec`. Así no hace falta instalar binarios de Fabric directamente en Windows — todo pasa por Docker, que ya está disponible en esta máquina (`docker version` → 29.1.5, Docker Compose v5.0.1, WSL2 con Ubuntu confirmados).

### 2.6 Versión

Fabric 2.5.x (LTS actual) y Fabric CA 1.5.x — versión estable, misma que usa `fabric-samples` hoy.

## 3. Estructura de archivos (dentro de `blockchain/network/`, ya reservada en la estructura del repo desde WP-00)

```
blockchain/network/
├── configtx.yaml                     # organizaciones, perfil de canal, Raft de 1 nodo
├── docker/
│   ├── docker-compose-ca.yaml        # 5 Fabric CA (Cooperativa, Certificadora, Exportador, Transportista, Orderer)
│   └── docker-compose-net.yaml       # 3 peers + 1 orderer
├── organizations/
│   └── fabric-ca/
│       ├── cooperativa/fabric-ca-server-config.yaml
│       ├── certificadora/fabric-ca-server-config.yaml
│       ├── exportador/fabric-ca-server-config.yaml
│       ├── transportista/fabric-ca-server-config.yaml
│       └── orderer/fabric-ca-server-config.yaml
│   # organizations/peerOrganizations/ y ordererOrganizations/ se generan en
│   # tiempo de ejecución (identidades MSP) — no se versionan (§4)
├── scripts/
│   ├── envVar.sh                     # variables CORE_PEER_* compartidas por org
│   ├── registerEnroll.sh             # registra/enrola admins + peers + orderer vía Fabric CA
│   ├── createChannel.sh
│   ├── joinChannel.sh
│   └── verify.sh                     # checklist de verificación (§5), automatizado
└── network.sh                        # orquestador: up | createChannel | verify | down
```

`blockchain/wallets/<org>/` guarda la identidad de aplicación ya enrolada de cada organización (certificado + llave), lista para que WP-22 la use desde el Fabric Gateway.

## 4. `.gitignore` — corrección necesaria

El `.gitignore` ya excluye `blockchain/wallets/` y `blockchain/network/channel-artifacts/`, pero excluye `blockchain/network/crypto-config/` — esa es la carpeta que genera `cryptogen`, herramienta que este WP **no** usa (§2.3). Con Fabric CA, el material generado cae bajo `blockchain/network/organizations/peerOrganizations/` y `.../ordererOrganizations/`. Se corrige la entrada del `.gitignore` para apuntar a esas rutas reales — si no, las llaves privadas generadas quedarían versionadas por error (viola la regla dura §4.5 del Plan Maestro).

## 5. Verificación planeada

Checklist (mismo criterio que "DoD explícito" del Plan Maestro §4.7), ejecutable con `./network.sh verify`:

1. `docker ps` — los 5 contenedores de CA, los 3 peers y el orderer están `Up` y `healthy`.
2. Cada organización tiene su MSP generado en `organizations/peerOrganizations/<org>/` (o `ordererOrganizations/` para el orderer) con certificados válidos.
3. El canal `canal-trazabilidad-cacao` existe: `peer channel list` en cada uno de los 3 peers lo muestra.
4. Los 3 peers están unidos y sincronizados: `peer channel getinfo -c canal-trazabilidad-cacao` reporta el mismo `height` de bloque en los tres.
5. `blockchain/wallets/` contiene una identidad válida por organización (Cooperativa, Certificadora, Exportador, Transportista) — se valida con `fabric-ca-client identity list`.
6. Reinicio limpio: `./network.sh down && ./network.sh up && ./network.sh createChannel` reproduce el mismo resultado sin intervención manual — confirma que no quedó nada "a mano" fuera de los scripts.

No se incluye ninguna prueba de chaincode (no existe todavía — WP-21) ni de integración con el backend (WP-22).

## 6. Fuera de alcance (explícitamente)

- Chaincode / lógica de negocio on-chain (WP-21).
- Fabric Gateway y su integración con NestJS (WP-22).
- Código QR / consulta pública (WP-23).
- Clúster Raft multi-nodo (§2.2 — anotado para WP-44).
- CouchDB / consultas enriquecidas (§2.4).
- Mapear cada institución de Postgres a una identidad Fabric individual dentro de su MSP compartido (§2.1 — tarea de WP-22).
- Despliegue en la nube — la red corre localmente vía Docker Compose (coherente con el "entorno reproducible local" que permite WP-34).

---

¿Confirmas que proceda con estos pasos?
