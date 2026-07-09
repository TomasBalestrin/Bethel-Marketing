'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  getGoogleStatus, disconnectGoogle,
  listAvailableLocations, connectLocation, listConnectedLocations, removeLocation,
  type GoogleStatus, type AvailableLocation, type ConnectedLocation,
} from '@/app/actions/google'
import { LocationProfilePanel } from '@/components/google/LocationProfilePanel'
import { RecommendationsPanel } from '@/components/google/RecommendationsPanel'
import { PerformancePanel } from '@/components/google/PerformancePanel'
import { CompetitorsPanel } from '@/components/google/CompetitorsPanel'

const MODULOS = [
  { emoji: '🏢', titulo: 'Perfil', desc: 'Ver e editar nome, telefone, site e descrição (categorias e horários em breve)', pronto: true },
  { emoji: '⭐', titulo: 'Avaliações', desc: 'Listar avaliações e responder (com rascunho da IA, você aprova)' },
  { emoji: '📣', titulo: 'Postagens', desc: 'Criar, agendar e publicar postagens no perfil' },
  { emoji: '📈', titulo: 'Desempenho', desc: 'Visualizações, ligações, rotas, cliques e conversas (30 dias vs. anteriores)', pronto: true },
  { emoji: '✨', titulo: 'Recomendações IA', desc: 'Análise do perfil com sugestões priorizadas e acionáveis', pronto: true },
  { emoji: '🔍', titulo: 'Concorrentes', desc: 'Comparar nota e nº de avaliações com concorrentes da sua cidade', pronto: true },
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
  const [perfilAberto, setPerfilAberto] = useState<string | null>(null)
  const [recsAberto, setRecsAberto] = useState<string | null>(null)
  const [desempenhoAberto, setDesempenhoAberto] = useState<string | null>(null)
  const [concorrentesAberto, setConcorrentesAberto] = useState<string | null>(null)

  function fecharTodos() {
    setPerfilAberto(null); setDesempenhoAberto(null); setConcorrentesAberto(null); setRecsAberto(null)
  }

  const connected = params.get('connected') === '1'
  const erro = params.get('erro')

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
      } else {
        setLocMsg(res.error)
      }
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

  async function removerLocal(id: string) {
    if (!confirm('Remover este perfil?')) return
    const res = await removeLocation(id)
    if (res.success) setConectados(prev => prev.filter(c => c.id !== id))
    else alert(res.error)
  }

  async function desconectar() {
    if (!confirm('Desconectar a conta do Google?')) return
    setDesconectando(true)
    try {
      await disconnectGoogle()
      const res = await getGoogleStatus()
      if (res.success) setStatus(res.data)
    } finally { setDesconectando(false) }
  }

  return (
    <div className="py-8 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center text-xl flex-shrink-0">📍</div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Google Meu Negócio</h1>
            <p className="text-sm text-gray-500">Gestão e análise do Perfil da Empresa no Google</p>
          </div>
        </div>

        {connected && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 text-sm text-green-700">✅ Conta do Google conectada com sucesso!</div>
        )}
        {erro === 'nao_configurado' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-700">⚠️ A integração com o Google ainda não foi configurada no servidor (credenciais pendentes).</div>
        )}
        {erro && erro !== 'nao_configurado' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">❌ Não foi possível concluir a conexão ({erro}). Tente novamente.</div>
        )}

        {carregando ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 text-sm">Carregando...</div>
        ) : !status?.configured ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 space-y-3">
            <p className="font-semibold text-gray-900">Integração em preparação</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              A estrutura já está pronta, mas a conexão com o Google depende da liberação de acesso à <b>Business Profile API</b> pelo Google (projeto no Google Cloud, solicitação de acesso e verificação do app — pode levar semanas).
              Assim que as credenciais estiverem configuradas, o botão de conexão aparece aqui.
            </p>
          </div>
        ) : !status.connected ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center space-y-4">
            <p className="font-semibold text-gray-900">Conecte a conta do Google do negócio</p>
            <p className="text-sm text-gray-600">Você será levado ao Google para autorizar o acesso ao perfil da empresa.</p>
            <a href="/api/google/oauth/start"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 transition-all">
              🔗 Conectar com Google
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">✅ Conta Google conectada</p>
                <p className="text-xs text-gray-500">{conectados.length} perfil(is) conectado(s)</p>
              </div>
              <button onClick={desconectar} disabled={desconectando}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all disabled:opacity-50">
                {desconectando ? '...' : 'Desconectar'}
              </button>
            </div>

            {/* Perfis conectados */}
            {conectados.map(loc => (
              <div key={loc.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">🏢 {loc.title}</p>
                    <p className="text-xs text-gray-500">{[loc.primaryCategory, loc.address].filter(Boolean).join(' • ')}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    <button onClick={() => { const o = perfilAberto === loc.id; fecharTodos(); if (!o) setPerfilAberto(loc.id) }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100">
                      {perfilAberto === loc.id ? 'Fechar' : '✏️ Ver / editar perfil'}
                    </button>
                    <button onClick={() => { const o = desempenhoAberto === loc.id; fecharTodos(); if (!o) setDesempenhoAberto(loc.id) }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-green-200 text-green-700 bg-green-50 hover:bg-green-100">
                      {desempenhoAberto === loc.id ? 'Fechar' : '📈 Desempenho'}
                    </button>
                    <button onClick={() => { const o = concorrentesAberto === loc.id; fecharTodos(); if (!o) setConcorrentesAberto(loc.id) }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100">
                      {concorrentesAberto === loc.id ? 'Fechar' : '🔍 Concorrentes'}
                    </button>
                    <button onClick={() => { const o = recsAberto === loc.id; fecharTodos(); if (!o) setRecsAberto(loc.id) }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100">
                      {recsAberto === loc.id ? 'Fechar' : '✨ Recomendações IA'}
                    </button>
                    <button onClick={() => removerLocal(loc.id)}
                      className="text-gray-300 hover:text-red-500 text-sm">🗑️</button>
                  </div>
                </div>
                {perfilAberto === loc.id && <LocationProfilePanel id={loc.id} />}
                {desempenhoAberto === loc.id && <PerformancePanel id={loc.id} />}
                {concorrentesAberto === loc.id && <CompetitorsPanel id={loc.id} />}
                {recsAberto === loc.id && <RecommendationsPanel id={loc.id} />}
              </div>
            ))}

            {/* Selecionar/adicionar perfil */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">{conectados.length ? 'Adicionar outro perfil' : 'Conecte um perfil do Google'}</p>
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
                        {conectandoLoc === d.locationName ? '⏳' : 'Conectar'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Visão geral dos módulos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
          {MODULOS.map(m => (
            <div key={m.titulo} className={`bg-white border rounded-xl p-4 flex items-start gap-3 ${m.pronto ? 'border-green-200' : 'border-gray-200 opacity-80'}`}>
              <span className="text-xl">{m.emoji}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {m.titulo}{' '}
                  <span className={`text-[10px] font-medium align-middle ${m.pronto ? 'text-green-600' : 'text-gray-400'}`}>
                    {m.pronto ? '✅ ativo' : 'em breve'}
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
