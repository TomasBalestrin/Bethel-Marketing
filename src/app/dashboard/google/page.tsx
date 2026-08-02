'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  getGoogleStatus, disconnectGoogle,
  listAvailableLocations, connectLocation, listConnectedLocations, removeLocation,
  type GoogleStatus, type AvailableLocation, type ConnectedLocation,
} from '@/app/actions/google'
import { Modal } from '@/components/google/Modal'
import { LocationProfilePanel } from '@/components/google/LocationProfilePanel'
import { AuditPanel } from '@/components/google/AuditPanel'
import { PerformancePanel } from '@/components/google/PerformancePanel'
import { CompetitorsPanel } from '@/components/google/CompetitorsPanel'
import { ReviewsPanel } from '@/components/google/ReviewsPanel'
import { RankPanel } from '@/components/google/RankPanel'
import { AnaliseMercadoPanel } from '@/components/google/AnaliseMercadoPanel'

type FeatureKey = 'perfil' | 'avaliacoes' | 'desempenho' | 'recomendacoes' | 'concorrentes' | 'rank' | 'mercado' | 'postagens'

const FEATURES: {
  key: FeatureKey; emoji: string; titulo: string; desc: string; pronto: boolean; accent: string; hover: string
}[] = [
  { key: 'perfil', emoji: '🏢', titulo: 'Perfil', desc: 'Ver e editar nome, telefone, site e descrição', pronto: true, accent: 'bg-blue-50', hover: 'hover:border-blue-200' },
  { key: 'avaliacoes', emoji: '⭐', titulo: 'Avaliações', desc: 'Listar e responder (com rascunho da IA)', pronto: true, accent: 'bg-amber-50', hover: 'hover:border-amber-200' },
  { key: 'desempenho', emoji: '📈', titulo: 'Desempenho', desc: 'Visualizações, ligações, rotas e cliques', pronto: true, accent: 'bg-green-50', hover: 'hover:border-green-200' },
  { key: 'recomendacoes', emoji: '🩺', titulo: 'Auditoria', desc: 'Nota do perfil, checklist e plano de ação da IA', pronto: true, accent: 'bg-purple-50', hover: 'hover:border-purple-200' },
  { key: 'concorrentes', emoji: '🔍', titulo: 'Concorrentes', desc: 'Compare seu perfil com a concorrência', pronto: true, accent: 'bg-orange-50', hover: 'hover:border-orange-200' },
  { key: 'rank', emoji: '🎯', titulo: 'Rank no Mapa', desc: 'Sua posição no Maps por palavra-chave (SerpApi)', pronto: true, accent: 'bg-teal-50', hover: 'hover:border-teal-200' },
  { key: 'mercado', emoji: '🔎', titulo: 'Análise Mercado', desc: 'Rank de qualquer negócio + concorrentes por palavra-chave', pronto: true, accent: 'bg-indigo-50', hover: 'hover:border-indigo-200' },
  { key: 'postagens', emoji: '📣', titulo: 'Postagens', desc: 'Criar e agendar postagens no perfil', pronto: false, accent: 'bg-gray-100', hover: '' },
]

export default function GooglePage() {
  return (
    <Suspense fallback={<div className="py-8 px-6 text-sm text-gray-400">Carregando...</div>}>
      <GoogleInner />
    </Suspense>
  )
}

function GoogleInner() {
  const params = useSearchParams()
  const [status, setStatus] = useState<GoogleStatus | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [desconectando, setDesconectando] = useState(false)

  const [conectados, setConectados] = useState<ConnectedLocation[]>([])
  const [disponiveis, setDisponiveis] = useState<AvailableLocation[] | null>(null)
  const [carregandoLocais, setCarregandoLocais] = useState(false)
  const [conectandoLoc, setConectandoLoc] = useState<string | null>(null)
  const [locMsg, setLocMsg] = useState('')

  const [modal, setModal] = useState<FeatureKey | null>(null)

  const connected = params.get('connected') === '1'
  const erro = params.get('erro')
  const ativo = conectados[0] ?? null

  useEffect(() => {
    (async () => {
      const res = await getGoogleStatus()
      if (res.success) {
        setStatus(res.data)
        if (res.data.connected) {
          const l = await listConnectedLocations()
          if (l.success) setConectados(l.data)
        }
      }
      setCarregando(false)
    })()
  }, [])

  async function carregarDisponiveis() {
    setCarregandoLocais(true); setLocMsg(''); setDisponiveis(null)
    try {
      const res = await listAvailableLocations()
      if (res.success) {
        setDisponiveis(res.data)
        if (res.data.length === 0) setLocMsg('Nenhum local encontrado nessa conta Google.')
      } else setLocMsg(res.error)
    } finally { setCarregandoLocais(false) }
  }

  async function conectarLocal(locationName: string) {
    setConectandoLoc(locationName); setLocMsg('')
    try {
      const res = await connectLocation(locationName)
      if (res.success) {
        const l = await listConnectedLocations()
        if (l.success) setConectados(l.data)
        setDisponiveis(null)
      } else setLocMsg(res.error)
    } finally { setConectandoLoc(null) }
  }

  async function trocarPerfil() {
    if (!ativo) return
    if (!confirm('Trocar de perfil? Você poderá escolher outro do Google.')) return
    const res = await removeLocation(ativo.id)
    if (res.success) { setConectados([]); setDisponiveis(null) }
    else alert(res.error)
  }

  async function desconectar() {
    if (!confirm('Desconectar a conta do Google?')) return
    setDesconectando(true)
    try {
      await disconnectGoogle()
      const res = await getGoogleStatus()
      if (res.success) setStatus(res.data)
      setConectados([])
    } finally { setDesconectando(false) }
  }

  const feature = FEATURES.find(f => f.key === modal)

  return (
    <div className="py-8 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Cabeçalho */}
        <div className="mb-6 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center text-xl flex-shrink-0 shadow-sm">📍</div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Google Meu Negócio</h1>
            <p className="text-sm text-gray-500">Gestão e crescimento do Perfil da Empresa no Google</p>
          </div>
        </div>

        {connected && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 text-sm text-green-700">✅ Conta do Google conectada com sucesso!</div>
        )}
        {erro === 'nao_configurado' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-700">⚠️ A integração com o Google ainda não foi configurada no servidor.</div>
        )}
        {erro && erro !== 'nao_configurado' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">❌ Não foi possível concluir a conexão ({erro}). Tente novamente.</div>
        )}

        {carregando ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400 text-sm">Carregando...</div>
        ) : !status?.configured ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 space-y-3">
            <p className="font-semibold text-gray-900">Integração em preparação</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              A conexão com o Google depende da liberação de acesso à <b>Business Profile API</b>. Assim que as credenciais estiverem configuradas, o botão de conexão aparece aqui.
            </p>
          </div>
        ) : !status.connected ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-green-500 grid place-items-center text-2xl mx-auto shadow-sm">🔗</div>
            <div>
              <p className="font-semibold text-gray-900">Conecte a conta do Google do negócio</p>
              <p className="text-sm text-gray-500 mt-1">Você será levado ao Google para autorizar o acesso ao perfil da empresa.</p>
            </div>
            <a href="/api/google/oauth/start"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 transition-all shadow-sm">
              Conectar com Google
            </a>
          </div>
        ) : !ativo ? (
          /* Conectado no Google, mas sem perfil escolhido ainda */
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Escolha o perfil da empresa</p>
                <p className="text-xs text-gray-500">Selecione o Perfil de Empresa que você quer gerenciar.</p>
              </div>
              <button onClick={carregarDisponiveis} disabled={carregandoLocais}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 disabled:opacity-50">
                {carregandoLocais ? '⏳ Buscando...' : '🔄 Buscar perfis'}
              </button>
            </div>
            {locMsg && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">{locMsg}</p>}
            {disponiveis && disponiveis.length > 0 && (
              <div className="space-y-1.5">
                {disponiveis.map(d => (
                  <div key={d.locationName} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{d.title}</p>
                      <p className="text-xs text-gray-400 truncate">{[d.primaryCategory, d.address].filter(Boolean).join(' • ')}</p>
                    </div>
                    <button onClick={() => conectarLocal(d.locationName)} disabled={conectandoLoc === d.locationName}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 flex-shrink-0">
                      {conectandoLoc === d.locationName ? '⏳' : 'Selecionar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={desconectar} disabled={desconectando}
              className="text-xs text-gray-400 hover:text-red-600">{desconectando ? '...' : 'Desconectar conta Google'}</button>
          </div>
        ) : (
          /* Painel principal: perfil ativo + grid de funcionalidades */
          <div className="space-y-5">
            <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-green-500 grid place-items-center text-xl flex-shrink-0">🏢</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-base font-bold text-gray-900 truncate">{ativo.title}</p>
                  <span className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 flex-shrink-0">Conectado</span>
                </div>
                <p className="text-xs text-gray-500 truncate">{[ativo.primaryCategory, ativo.address].filter(Boolean).join(' • ') || 'Perfil do Google'}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <button onClick={trocarPerfil} className="text-[11px] text-gray-400 hover:text-gray-700">Trocar perfil</button>
                <button onClick={desconectar} disabled={desconectando} className="text-[11px] text-gray-400 hover:text-red-600">{desconectando ? '...' : 'Desconectar'}</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FEATURES.map(f => (
                <button key={f.key} disabled={!f.pronto}
                  onClick={() => f.pronto && setModal(f.key)}
                  className={`group text-left bg-white border border-gray-200 rounded-2xl p-5 flex items-start gap-3 transition-all ${
                    f.pronto ? `${f.hover} hover:shadow-md hover:-translate-y-0.5 cursor-pointer` : 'opacity-60 cursor-default'
                  }`}>
                  <div className={`w-11 h-11 rounded-xl grid place-items-center text-xl flex-shrink-0 ${f.accent}`}>{f.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{f.titulo}</h3>
                      {!f.pronto && <span className="text-[10px] font-medium text-gray-400">em breve</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                  {f.pronto && <span className="text-gray-300 group-hover:text-gray-500 transition-colors self-center">→</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Modal da funcionalidade */}
        <Modal
          open={modal !== null && ativo !== null}
          onClose={() => setModal(null)}
          title={feature?.titulo ?? ''}
          subtitle={ativo?.title}
          icon={feature?.emoji}
          accent={feature?.accent}
        >
          {ativo && modal === 'perfil' && <LocationProfilePanel id={ativo.id} />}
          {ativo && modal === 'avaliacoes' && <ReviewsPanel id={ativo.id} />}
          {ativo && modal === 'desempenho' && <PerformancePanel id={ativo.id} />}
          {ativo && modal === 'recomendacoes' && <AuditPanel id={ativo.id} />}
          {ativo && modal === 'concorrentes' && <CompetitorsPanel id={ativo.id} />}
          {ativo && modal === 'rank' && <RankPanel id={ativo.id} />}
          {ativo && modal === 'mercado' && <AnaliseMercadoPanel />}
        </Modal>
      </div>
    </div>
  )
}
