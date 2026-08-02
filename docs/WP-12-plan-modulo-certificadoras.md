# Plan de implementación — WP-12 · Módulo Certificadoras

**Estado:** Propuesto, pendiente de confirmación
**Depende de:** WP-01 (modelo `Certificado`, ya tiene `archivoPdfUrl`/`hashArchivo`), WP-04 (placeholder `POST /certificados`), WP-11 (patrón de servicio de contexto por organización, transición de estado C1)

---

## 1. Alcance

Emisión de certificados con carga real de PDF, cálculo y almacenamiento del hash SHA-256, asociación al lote, y la transición de estado C1 `Fermentando → Certificado`. Primer WP que maneja subida de archivos.

## 2. Decisiones de diseño

### 2.1 Almacenamiento del PDF: disco local, direccionado por contenido

No hay object storage (S3/MinIO) configurado todavía y el plan maestro no lo exige para el MVP. Se guarda el PDF en `backend/uploads/certificados/`, con el nombre de archivo = hash SHA-256 del contenido (evita duplicados y colisiones). `archivoPdfUrl` en la base **no** guarda una ruta de filesystem — guarda la ruta de la API para descargarlo (`/certificados/:id/archivo`), así el detalle de almacenamiento queda desacoplado. Carpeta agregada a `.gitignore` (son archivos subidos, no código fuente). Migrar a un object storage real queda para una mejora futura (se puede mencionar en WP-44, escalabilidad).

### 2.2 El PDF se sirve por un endpoint autenticado, no como carpeta estática pública

`GET /certificados/:id/archivo` reutiliza el mismo guard de "solo propio" que `GET /certificados/:id` — no se monta la carpeta `uploads/` como estática pública, para no exponer certificados por URL adivinable.

### 2.3 El hash se calcula server-side desde el contenido real, no se confía en el cliente

`crypto.createHash('sha256')` sobre el buffer recibido (Multer en memoria, `FileInterceptor`). Valida `mimetype = application/pdf` y tamaño máximo (10 MB). Al emitir el certificado, el hash también se copia a `Lote.hashCertificado` (campo espejo ya definido en C2/WP-01).

### 2.4 Transición de estado C1: `Fermentando → Certificado`

Igual que WP-11 con `Creado → Fermentando`: `POST /certificados` exige que el lote esté en `estado = Fermentando` (si no, `409`) y lo mueve a `Certificado`. Se crea un `Evento` (`CERTIFICACION`) — mismo patrón que WP-11, con `hashTransaccionBlockchain`/`firmaDigital` en `null` hasta WP-22.

**Fuera de alcance de este WP:** re-certificar un lote que ya está en `Certificado` (o más adelante en el flujo) — el modelo `Certificado` sí soporta 1:N con `Lote` (WP-01), pero la lógica de re-certificación/corrección no se construye ahora; un segundo intento de `POST /certificados` sobre el mismo lote se rechaza con `409` igual que cualquier transición fuera de orden.

### 2.5 "Validación de certificados" = validación de los datos de entrada

C5/C7 no definen un flujo separado de "aprobar/rechazar" un certificado ya emitido. Se interpreta el entregable como validación de la solicitud (DTO con `class-validator`, tipo de archivo, tamaño, existencia y estado del lote) — no se inventa un workflow de aprobación que el contrato no pide.

### 2.6 `GET /certificados` (listado) — extensión aditiva, no contradice C5

C5 solo define `POST /certificados` y `GET /certificados/:id`. Se agrega `GET /certificados` (listado, "solo propio") porque el frontend necesita una tabla para gestionar certificaciones (mismo caso que `GET /lotes` en WP-11) — a diferencia de la corrección de `POST /lotes` en WP-11, esto no reemplaza ni contradice ningún endpoint definido por el contrato, solo lo completa.

### 2.7 Alcance "solo propio" (C7) — se generaliza el servicio de contexto

`CooperativaContextService` (WP-11) se renombra a `OrganizacionContextService` y se le agrega `resolveCertificadoraId`, en vez de crear un servicio casi idéntico por cada rol organizacional (Transportista y Exportador lo reutilizarán en WP-13/14).

- `CERTIFICADORA` ve/gestiona solo los certificados que emitió.
- `COOPERATIVA` ve los certificados de sus propios lotes (join por `lote.cooperativaId`).
- `PRODUCTOR` ve los certificados de sus propios lotes.
- `ADMIN` ve todos.
- `TRANSPORTISTA`/`EXPORTADOR`/`COMPRADOR` ven todos por ahora (mismo criterio temporal que WP-11, hasta que existan sus propias relaciones de datos en WP-13/14).

## 3. Backend

| Endpoint | Rol | Efecto |
|---|---|---|
| `POST /certificados` (multipart: campos + `archivo`) | `CERTIFICADORA` | Valida que el lote exista y esté en estado `Fermentando` (sin restricción de "propiedad": una certificadora puede certificar lotes de cualquier cooperativa, no hay relación de pertenencia entre ambas), guarda PDF, calcula hash, crea `Certificado`, actualiza `Lote` (`Certificado`, `hashCertificado`) + `Evento` (`CERTIFICACION`) |
| `GET /certificados` | cualquier autenticado | Lista con alcance "solo propio" (§2.7) |
| `GET /certificados/:id` | cualquier autenticado | Detalle, mismo alcance |
| `GET /certificados/:id/archivo` | cualquier autenticado | Descarga el PDF, mismo alcance |

DTO `CreateCertificadoDto`: `loteId` (UUID), `tipoCertificacion` (string), `fechaEmision`, `fechaVencimiento?`. El archivo llega vía `FileInterceptor('archivo')`, no por el DTO.

## 4. Frontend

Reemplaza la página "Próximamente" de `/certificadoras` (WP-03) por una real:
- Tabla de certificados (lote/productor, tipo, fecha emisión, vigencia, estado, botón **Ver PDF**).
- Botón **Nuevo certificado**: formulario con selector de lote (reutiliza `useLotes`, filtrado en el cliente a los que están en estado `Fermentando`), tipo de certificación, fecha de emisión, fecha de vencimiento opcional, e input de archivo PDF.
- "Ver PDF": pide el archivo con el token (vía `axios`, `responseType: 'blob'`) y lo abre en una pestaña nueva — un `<a href>` normal no serviría porque el endpoint exige `Authorization`.

## 5. Verificación planeada

- e2e (Jest, con un PDF de prueba mínimo generado en el propio test): emisión exitosa transiciona el lote a `Certificado` y guarda el hash; una certificadora puede certificar un lote de cualquier cooperativa (no hay restricción de pertenencia); rechazo si el lote no está en `Fermentando` (409); rechazo de archivo que no sea PDF (400); rechazo por rol incorrecto (403); `GET /certificados` respeta "solo propio" (una certificadora no ve los certificados emitidos por otra); descarga del PDF y verificación de que el hash devuelto coincide con el SHA-256 del contenido subido.
- Verificación manual en el navegador: login como `certificadora@test.com`, emitir un certificado sobre un lote en estado Fermentando (de los creados en WP-11), confirmar que pasa a "Certificado", descargar el PDF y confirmarlo.

## 6. Fuera de alcance (explícitamente)

- Object storage real (S3/MinIO) → posible mejora futura (WP-44).
- Revocar/marcar vencido un certificado ya emitido (`estado` VENCIDO/REVOCADO) → no lo pide el DoD de este WP.
- Re-certificación de un lote ya certificado.
- `numeroAcreditacion`/`entidadAcreditadora` de la propia `Certificadora` (ya existen en el modelo desde WP-01) — gestionarlos vía API no está pedido aquí.

---

¿Confirmas que proceda con estos pasos?
