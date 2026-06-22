'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getGoogleStatus, disconnectGoogle, type GoogleStatus } from '@/app/actions/google'

const MODULOS = [
  { emoji: '🏢', titulo: 'Perfil', desc: 'Ver e editar nome, categorias, horários, telefone, descrição e atributos' },
  { emoji: '⭐', titulo: 'Avaliações', desc: 'Listar avaliações e responder (com rascunho da IA, você aprova)' },
  { emoji: '📣', titulo: 'Postagens', desc: 'Criar, agendar e publicar postagens no perfil' },
  { emoji: '📈', titulo: 'Desempenho', desc: 'Dashboard mês a mês: impressões, cliques, ligações, rotas' },
  { emoji: '✨', titulo: 'Recomendações IA', desc: 'Análise do perfil com sugestões priorizadas e acionáveis' },
  { emoji: '🔍', titulo: 'Concorrentes', desc: 'Comparar dados públicos (nota, nº de avaliações, fotos)' },
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

  const connected = params.get('connected') === '1'
  const erro = params.get('erro')

  useEffect(() => {
    (async () => {
      const res = await getGoogleStatus()
      if (res.success) setStatus(res.data)
      setCarregando(false)
    })()
  }, [])

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
                <p className="text-sm font-semibold text-gray-900">✅ Conta conectada</p>
                <p className="text-xs text-gray-500">{status.locationsCount} perfil(is) conectado(s)</p>
              </div>
              <button onClick={desconectar} disabled={desconectando}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all disabled:opacity-50">
                {desconectando ? '...' : 'Desconectar'}
              </button>
            </div>
          </div>
        )}

        {/* Visão geral dos módulos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
          {MODULOS.map(m => (
            <div key={m.titulo} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3 opacity-80">
              <span className="text-xl">{m.emoji}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{m.titulo} <span className="text-[10px] font-medium text-gray-400 align-middle">em breve</span></p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
