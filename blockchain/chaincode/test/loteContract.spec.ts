import { Context } from 'fabric-contract-api'
import { LoteContract } from '../src/loteContract'
import { EstadoLote, LoteOnChain, TipoEvento } from '../src/types'

// WP-21: pruebas unitarias con mocks de Context/ChaincodeStub/ClientIdentity
// — sin red real (la verificación funcional corre aparte, ver §5 del plan).

// Un único Map por prueba, compartido entre las 4 identidades: en Fabric real
// el estado del canal es global, no por identidad — solo el firmante cambia.
function createMockContext(world: Map<string, Buffer>, mspId: string, clientId = `${mspId}-user`): Context {
  return {
    clientIdentity: {
      getMSPID: () => mspId,
      getID: () => clientId,
    },
    stub: {
      getState: async (key: string) => world.get(key) ?? Buffer.alloc(0),
      putState: async (key: string, value: Buffer) => {
        world.set(key, value)
      },
      getTxTimestamp: () => ({
        seconds: { toNumber: () => Math.floor(Date.now() / 1000) },
        nanos: 0,
      }),
    },
  } as unknown as Context
}

async function crearLoteBase(contract: LoteContract, ctx: Context, loteId = 'lote-1') {
  await contract.CreateLot(ctx, loteId, 'productor-1', 'cooperativa-1', '2026-07-01', '500')
  return loteId
}

describe('LoteContract', () => {
  let contract: LoteContract
  let cooperativaCtx: Context
  let certificadoraCtx: Context
  let transportistaCtx: Context
  let exportadorCtx: Context

  beforeEach(() => {
    contract = new LoteContract()
    const world = new Map<string, Buffer>()
    cooperativaCtx = createMockContext(world, 'CooperativaMSP')
    certificadoraCtx = createMockContext(world, 'CertificadoraMSP')
    transportistaCtx = createMockContext(world, 'TransportistaMSP')
    exportadorCtx = createMockContext(world, 'ExportadorMSP')
  })

  describe('CreateLot', () => {
    it('crea el lote en estado CREADO con un evento CREACION', async () => {
      const loteId = await crearLoteBase(contract, cooperativaCtx)
      const lote: LoteOnChain = JSON.parse(await contract.QueryLote(cooperativaCtx, loteId))

      expect(lote.estado).toBe(EstadoLote.CREADO)
      expect(lote.capacidadProductivaMaximaKg).toBe(500)
      expect(lote.historialEventos).toHaveLength(1)
      expect(lote.historialEventos[0].tipo).toBe(TipoEvento.CREACION)
      expect(lote.historialEventos[0].actorMspId).toBe('CooperativaMSP')
    })

    it('rechaza si la organización no es CooperativaMSP', async () => {
      await expect(
        contract.CreateLot(exportadorCtx, 'lote-x', 'p1', 'c1', '2026-07-01', '500'),
      ).rejects.toThrow(/CooperativaMSP/)
    })

    it('rechaza un loteId duplicado', async () => {
      const loteId = await crearLoteBase(contract, cooperativaCtx)
      await expect(
        contract.CreateLot(cooperativaCtx, loteId, 'p1', 'c1', '2026-07-01', '500'),
      ).rejects.toThrow(/ya existe/)
    })

    it('rechaza una capacidad no positiva', async () => {
      await expect(
        contract.CreateLot(cooperativaCtx, 'lote-y', 'p1', 'c1', '2026-07-01', '0'),
      ).rejects.toThrow(/positivo/)
    })
  })

  describe('RegisterFermentation', () => {
    it('transiciona CREADO → FERMENTANDO', async () => {
      const loteId = await crearLoteBase(contract, cooperativaCtx)
      await contract.RegisterFermentation(cooperativaCtx, loteId, '300', '2026-07-10')

      const lote: LoteOnChain = JSON.parse(await contract.QueryLote(cooperativaCtx, loteId))
      expect(lote.estado).toBe(EstadoLote.FERMENTANDO)
      expect(lote.pesoFermentadoKg).toBe(300)
      expect(lote.historialEventos.map((e) => e.tipo)).toEqual([
        TipoEvento.CREACION,
        TipoEvento.FERMENTACION,
      ])
    })

    it('rechaza si el peso excede la capacidad productiva máxima (Fase I)', async () => {
      const loteId = await crearLoteBase(contract, cooperativaCtx) // capacidad = 500
      await expect(
        contract.RegisterFermentation(cooperativaCtx, loteId, '600', '2026-07-10'),
      ).rejects.toThrow(/excede la capacidad/)
    })

    it('rechaza fermentar dos veces (estado ya no es CREADO)', async () => {
      const loteId = await crearLoteBase(contract, cooperativaCtx)
      await contract.RegisterFermentation(cooperativaCtx, loteId, '300', '2026-07-10')
      await expect(
        contract.RegisterFermentation(cooperativaCtx, loteId, '250', '2026-07-11'),
      ).rejects.toThrow(/se esperaba CREADO/)
    })

    it('rechaza si la organización no es CooperativaMSP', async () => {
      const loteId = await crearLoteBase(contract, cooperativaCtx)
      await expect(
        contract.RegisterFermentation(certificadoraCtx, loteId, '300', '2026-07-10'),
      ).rejects.toThrow(/CooperativaMSP/)
    })
  })

  describe('RegisterCertification', () => {
    async function loteFermentando(loteId = 'lote-cert') {
      await crearLoteBase(contract, cooperativaCtx, loteId)
      await contract.RegisterFermentation(cooperativaCtx, loteId, '300', '2026-07-10')
      return loteId
    }

    it('transiciona FERMENTANDO → CERTIFICADO', async () => {
      const loteId = await loteFermentando()
      await contract.RegisterCertification(certificadoraCtx, loteId, 'hash-abc', 'firma-xyz')

      const lote: LoteOnChain = JSON.parse(await contract.QueryLote(certificadoraCtx, loteId))
      expect(lote.estado).toBe(EstadoLote.CERTIFICADO)
      expect(lote.hashCertificado).toBe('hash-abc')
    })

    it('rechaza si el lote no está en FERMENTANDO', async () => {
      const loteId = await crearLoteBase(contract, cooperativaCtx, 'lote-sin-fermentar')
      await expect(
        contract.RegisterCertification(certificadoraCtx, loteId, 'hash-abc', 'firma-xyz'),
      ).rejects.toThrow(/se esperaba FERMENTANDO/)
    })

    it('rechaza si la organización no es CertificadoraMSP', async () => {
      const loteId = await loteFermentando('lote-cert-2')
      await expect(
        contract.RegisterCertification(transportistaCtx, loteId, 'hash-abc', 'firma-xyz'),
      ).rejects.toThrow(/CertificadoraMSP/)
    })
  })

  describe('RegisterTransport', () => {
    async function loteCertificado(loteId = 'lote-transp') {
      await crearLoteBase(contract, cooperativaCtx, loteId)
      await contract.RegisterFermentation(cooperativaCtx, loteId, '300', '2026-07-10')
      await contract.RegisterCertification(certificadoraCtx, loteId, 'hash-abc', 'firma-xyz')
      return loteId
    }

    it('transiciona CERTIFICADO → EN_TRANSPORTE', async () => {
      const loteId = await loteCertificado()
      await contract.RegisterTransport(transportistaCtx, loteId, 'transportista-1', 'Ruta X', '48h')

      const lote: LoteOnChain = JSON.parse(await contract.QueryLote(transportistaCtx, loteId))
      expect(lote.estado).toBe(EstadoLote.EN_TRANSPORTE)
      expect(lote.ruta).toBe('Ruta X')
    })

    it('rechaza si la organización no es TransportistaMSP', async () => {
      const loteId = await loteCertificado('lote-transp-2')
      await expect(
        contract.RegisterTransport(cooperativaCtx, loteId, 'transportista-1', 'Ruta X', '48h'),
      ).rejects.toThrow(/TransportistaMSP/)
    })

    it('rechaza si el lote no está en CERTIFICADO', async () => {
      const loteId = await crearLoteBase(contract, cooperativaCtx, 'lote-sin-certificar')
      await expect(
        contract.RegisterTransport(transportistaCtx, loteId, 'transportista-1', 'Ruta X', '48h'),
      ).rejects.toThrow(/se esperaba CERTIFICADO/)
    })
  })

  describe('RegisterExport y GetHistory', () => {
    async function loteEnTransporte(loteId = 'lote-exp') {
      await crearLoteBase(contract, cooperativaCtx, loteId)
      await contract.RegisterFermentation(cooperativaCtx, loteId, '300', '2026-07-10')
      await contract.RegisterCertification(certificadoraCtx, loteId, 'hash-abc', 'firma-xyz')
      await contract.RegisterTransport(transportistaCtx, loteId, 'transportista-1', 'Ruta X', '48h')
      return loteId
    }

    it('transiciona EN_TRANSPORTE → EXPORTADO', async () => {
      const loteId = await loteEnTransporte()
      await contract.RegisterExport(exportadorCtx, loteId, 'exportador-1', 'Bélgica', '2026-08-15')

      const lote: LoteOnChain = JSON.parse(await contract.QueryLote(exportadorCtx, loteId))
      expect(lote.estado).toBe(EstadoLote.EXPORTADO)
      expect(lote.paisDestino).toBe('Bélgica')
    })

    it('rechaza si la organización no es ExportadorMSP', async () => {
      const loteId = await loteEnTransporte('lote-exp-2')
      await expect(
        contract.RegisterExport(transportistaCtx, loteId, 'exportador-1', 'Bélgica', '2026-08-15'),
      ).rejects.toThrow(/ExportadorMSP/)
    })

    it('GetHistory devuelve los 5 eventos en orden tras el recorrido completo', async () => {
      const loteId = await loteEnTransporte('lote-exp-3')
      await contract.RegisterExport(exportadorCtx, loteId, 'exportador-1', 'Bélgica', '2026-08-15')

      const historial = JSON.parse(await contract.GetHistory(exportadorCtx, loteId))
      expect(historial.map((e: { tipo: string }) => e.tipo)).toEqual([
        TipoEvento.CREACION,
        TipoEvento.FERMENTACION,
        TipoEvento.CERTIFICACION,
        TipoEvento.TRANSPORTE,
        TipoEvento.EXPORTACION,
      ])
    })

    it('rechaza exportar dos veces (EXPORTADO es terminal)', async () => {
      const loteId = await loteEnTransporte('lote-exp-4')
      await contract.RegisterExport(exportadorCtx, loteId, 'exportador-1', 'Bélgica', '2026-08-15')
      await expect(
        contract.RegisterExport(exportadorCtx, loteId, 'exportador-1', 'Bélgica', '2026-08-16'),
      ).rejects.toThrow(/se esperaba EN_TRANSPORTE/)
    })
  })

  describe('consultas sobre un lote inexistente', () => {
    it('GetHistory rechaza si el lote no existe', async () => {
      await expect(contract.GetHistory(cooperativaCtx, 'no-existe')).rejects.toThrow(/no existe/)
    })
  })
})
