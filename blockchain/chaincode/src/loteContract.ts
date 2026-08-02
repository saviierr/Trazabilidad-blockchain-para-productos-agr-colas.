import { Context, Contract, Info, Returns, Transaction } from 'fabric-contract-api'
import { EstadoLote, EventoOnChain, LoteOnChain, TipoEvento } from './types'

// WP-21 · Chaincode de trazabilidad de cacao.
// Las 6 funciones de C4 + validación de rol (C7) y máquina de estados (C1).
// Ver docs/WP-21-plan-chaincode.md.

const MSP_COOPERATIVA = 'CooperativaMSP'
const MSP_CERTIFICADORA = 'CertificadoraMSP'
const MSP_TRANSPORTISTA = 'TransportistaMSP'
const MSP_EXPORTADOR = 'ExportadorMSP'

@Info({ title: 'LoteContract', description: 'Trazabilidad de lotes de cacao — C1/C2/C4' })
export class LoteContract extends Contract {
  // ── CreateLot ──────────────────────────────────────────────────────────
  // Extensión aditiva registrada (§2.5 del plan): 5º parámetro
  // capacidadProductivaMaximaKg — snapshot para validar RegisterFermentation
  // sin acceso a Postgres.
  @Transaction()
  public async CreateLot(
    ctx: Context,
    loteId: string,
    productorId: string,
    cooperativaId: string,
    fechaCosecha: string,
    capacidadProductivaMaximaKg: string,
  ): Promise<void> {
    this.requireMsp(ctx, MSP_COOPERATIVA, 'CreateLot')

    const existente = await ctx.stub.getState(loteId)
    if (existente && existente.length > 0) {
      throw new Error(`El lote ${loteId} ya existe`)
    }

    const capacidad = this.parsePositiveNumber(capacidadProductivaMaximaKg, 'capacidadProductivaMaximaKg')

    const lote: LoteOnChain = {
      docType: 'lote',
      loteId,
      productorId,
      cooperativaId,
      estado: EstadoLote.CREADO,
      capacidadProductivaMaximaKg: capacidad,
      fechaCosecha,
      historialEventos: [],
    }
    this.appendEvento(ctx, lote, TipoEvento.CREACION, { productorId, cooperativaId, fechaCosecha })

    await this.putLote(ctx, lote)
  }

  // ── RegisterFermentation ──────────────────────────────────────────────
  @Transaction()
  public async RegisterFermentation(
    ctx: Context,
    loteId: string,
    peso: string,
    fechaSecado: string,
  ): Promise<void> {
    this.requireMsp(ctx, MSP_COOPERATIVA, 'RegisterFermentation')

    const lote = await this.getLote(ctx, loteId)
    this.requireEstado(lote, EstadoLote.CREADO, 'RegisterFermentation')

    const pesoNumerico = this.parsePositiveNumber(peso, 'peso')
    // Regla de negocio obligatoria (Fase I, mitigación de datos falsos — C4):
    // rechaza si el peso reportado excede la capacidad productiva máxima.
    if (pesoNumerico > lote.capacidadProductivaMaximaKg) {
      throw new Error(
        `El peso reportado (${pesoNumerico}kg) excede la capacidad productiva máxima registrada (${lote.capacidadProductivaMaximaKg}kg)`,
      )
    }

    lote.estado = EstadoLote.FERMENTANDO
    lote.pesoFermentadoKg = pesoNumerico
    lote.fechaSecado = fechaSecado
    this.appendEvento(ctx, lote, TipoEvento.FERMENTACION, { peso: pesoNumerico, fechaSecado })

    await this.putLote(ctx, lote)
  }

  // ── RegisterCertification ─────────────────────────────────────────────
  @Transaction()
  public async RegisterCertification(
    ctx: Context,
    loteId: string,
    hashCertificado: string,
    firmaCertificadora: string,
  ): Promise<void> {
    this.requireMsp(ctx, MSP_CERTIFICADORA, 'RegisterCertification')

    const lote = await this.getLote(ctx, loteId)
    this.requireEstado(lote, EstadoLote.FERMENTANDO, 'RegisterCertification')

    lote.estado = EstadoLote.CERTIFICADO
    lote.hashCertificado = hashCertificado
    lote.firmaCertificadora = firmaCertificadora
    this.appendEvento(ctx, lote, TipoEvento.CERTIFICACION, { hashCertificado })

    await this.putLote(ctx, lote)
  }

  // ── RegisterTransport ──────────────────────────────────────────────────
  @Transaction()
  public async RegisterTransport(
    ctx: Context,
    loteId: string,
    transportistaId: string,
    ruta: string,
    tiempos: string,
  ): Promise<void> {
    this.requireMsp(ctx, MSP_TRANSPORTISTA, 'RegisterTransport')

    const lote = await this.getLote(ctx, loteId)
    this.requireEstado(lote, EstadoLote.CERTIFICADO, 'RegisterTransport')

    lote.estado = EstadoLote.EN_TRANSPORTE
    lote.transportistaId = transportistaId
    lote.ruta = ruta
    lote.tiempos = tiempos
    lote.fechaTransporte = this.txTimestampIso(ctx)
    this.appendEvento(ctx, lote, TipoEvento.TRANSPORTE, { transportistaId, ruta, tiempos })

    await this.putLote(ctx, lote)
  }

  // ── RegisterExport ──────────────────────────────────────────────────────
  @Transaction()
  public async RegisterExport(
    ctx: Context,
    loteId: string,
    exportadorId: string,
    paisDestino: string,
    fechaExportacion: string,
  ): Promise<void> {
    this.requireMsp(ctx, MSP_EXPORTADOR, 'RegisterExport')

    const lote = await this.getLote(ctx, loteId)
    this.requireEstado(lote, EstadoLote.EN_TRANSPORTE, 'RegisterExport')

    lote.estado = EstadoLote.EXPORTADO
    lote.exportadorId = exportadorId
    lote.paisDestino = paisDestino
    lote.fechaExportacion = fechaExportacion
    this.appendEvento(ctx, lote, TipoEvento.EXPORTACION, { exportadorId, paisDestino, fechaExportacion })

    await this.putLote(ctx, lote)
  }

  // ── GetHistory ────────────────────────────────────────────────────────
  // Solo lectura, cualquier organización del canal (C4/C7).
  @Transaction(false)
  @Returns('string')
  public async GetHistory(ctx: Context, loteId: string): Promise<string> {
    const lote = await this.getLote(ctx, loteId)
    return JSON.stringify(lote.historialEventos)
  }

  // Consulta adicional (no está en C4, pero el DoD pide "como mínimo" esas
  // 6 — esta ayuda a las pruebas funcionales sin necesitar reconstruir el
  // lote a mano a partir del historial).
  @Transaction(false)
  @Returns('string')
  public async QueryLote(ctx: Context, loteId: string): Promise<string> {
    const lote = await this.getLote(ctx, loteId)
    return JSON.stringify(lote)
  }

  // ── Helpers privados ──────────────────────────────────────────────────

  private requireMsp(ctx: Context, mspEsperado: string, funcion: string): void {
    const mspActual = ctx.clientIdentity.getMSPID()
    if (mspActual !== mspEsperado) {
      throw new Error(`${funcion}: requiere ${mspEsperado}, la identidad que invoca pertenece a ${mspActual}`)
    }
  }

  // Cada función solo acepta el estado inmediatamente anterior en C1 — eso
  // ya implementa el orden estricto sin necesitar recorrer ORDEN_ESTADOS.
  private requireEstado(lote: LoteOnChain, esperado: EstadoLote, funcion: string): void {
    if (lote.estado !== esperado) {
      throw new Error(
        `${funcion}: el lote ${lote.loteId} está en estado ${lote.estado}; se esperaba ${esperado}`,
      )
    }
  }

  private parsePositiveNumber(valor: string, campo: string): number {
    const numero = Number(valor)
    if (!Number.isFinite(numero) || numero <= 0) {
      throw new Error(`${campo} debe ser un número positivo (recibido: "${valor}")`)
    }
    return numero
  }

  private async getLote(ctx: Context, loteId: string): Promise<LoteOnChain> {
    const bytes = await ctx.stub.getState(loteId)
    if (!bytes || bytes.length === 0) {
      throw new Error(`El lote ${loteId} no existe`)
    }
    return JSON.parse(Buffer.from(bytes).toString('utf8')) as LoteOnChain
  }

  private async putLote(ctx: Context, lote: LoteOnChain): Promise<void> {
    await ctx.stub.putState(lote.loteId, Buffer.from(JSON.stringify(lote)))
  }

  private txTimestampIso(ctx: Context): string {
    const ts = ctx.stub.getTxTimestamp()
    const millis = ts.seconds.toNumber() * 1000 + Math.floor(ts.nanos / 1e6)
    return new Date(millis).toISOString()
  }

  private appendEvento(
    ctx: Context,
    lote: LoteOnChain,
    tipo: TipoEvento,
    datos: Record<string, unknown>,
  ): void {
    const evento: EventoOnChain = {
      tipo,
      actorMspId: ctx.clientIdentity.getMSPID(),
      actorId: ctx.clientIdentity.getID(),
      timestamp: this.txTimestampIso(ctx),
      datos,
    }
    lote.historialEventos.push(evento)
  }
}
