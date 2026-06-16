'use client'

import { useState, useEffect } from 'react'
import {
  listContentProfiles,
  getContentProfile,
  saveContentProfile,
  deleteContentProfile,
  savePlan,
  listPlans,
  getPlan,
  deletePlan,
  savePlanItemRoteiro,
  type ContentProfileInput,
  type ProfileSummary,
  type PlanListItem,
  type PlanItem,
  type PlanItemRoteiro,
} from '@/app/actions/conteudo'

const EMPTY_PROFILE: ContentProfileInput = { id: undefined, instagram: '', negocio: '', nicho: '', servicos: '', sobre: '' }

const QUANTIDADES = [8, 12, 16, 20, 30]

const FORMATO_META: Record<string, { emoji: string; label: string }> = {
  reels: { emoji: '🎬', label: 'Reels' },
  carrossel: { emoji: '🖼️', label: 'Carrossel' },
  imagem: { emoji: '📸', label: 'Imagem' },
}
const FUNIL_META: Record<string, { label: string; cls: string }> = {
  topo: { label: 'Topo', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  meio: { label: 'Meio', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  fundo: { label: 'Fundo', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}
const CATEGORIA_META: Record<string, { emoji: string; label: string }> = {
  conexao: { emoji: '💛', label: 'Conexão' },
  educacional: { emoji: '💡', label: 'Educacional' },
  viral: { emoji: '🔥', label: 'Viral' },
  venda: { emoji: '🎯', label: 'Venda' },
}

function profileLabel(p: ProfileSummary) {
  return p.instagram ? `@${p.instagram}` : (p.negocio || p.nicho)
}

export default function ConteudoPage() {
  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [profile, setProfile] = useState<ContentProfileInput>(EMPTY_PROFILE)
  const [profileAberto, setProfileAberto] = useState(false)
  const [salvandoPerfil, setSalvandoPerfil] = useState(false)
  const [carregandoPerfil, setCarregandoPerfil] = useState(true)

  const [quantidade, setQuantidade] = useState(12)
  const [gerandoPlano, setGerandoPlano] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [erro, setErro] = useState('')

  const [planId, setPlanId] = useState<string | null>(null)
  const [planTitulo, setPlanTitulo] = useState('')
  const [itens, setItens] = useState<PlanItem[]>([])
  const [expandido, setExpandido] = useState<number | null>(null)
  const [gerandoItem, setGerandoItem] = useState<number | null>(null)
  const [copiado, setCopiado] = useState('')

  const [showHistorico, setShowHistorico] = useState(false)
  const [historico, setHistorico] = useState<PlanListItem[]>([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)

  useEffect(() => {
    (async () => {
      const res = await listContentProfiles()
      if (res.success && res.data.length > 0) {
        setProfiles(res.data)
        await carregarPerfil(res.data[0].id)
      } else {
        setProfileAberto(true)
      }
      setCarregandoPerfil(false)
    })()
  }, [])

  async function refreshProfiles(): Promise<ProfileSummary[]> {
    const res = await listContentProfiles()
    if (res.success) { setProfiles(res.data); return res.data }
    return []
  }

  async function carregarPerfil(id: string) {
    const res = await getContentProfile(id)
    if (res.success && res.data) {
      setProfile(res.data)
      setActiveId(id)
      setProfileAberto(false)
      // troca de Instagram limpa o plano atual em tela
      setItens([]); setPlanId(null); setExpandido(null); setErro('')
    }
  }

  function novoPerfil() {
    setProfile({ ...EMPTY_PROFILE })
    setActiveId(null)
    setProfileAberto(true)
    setItens([]); setPlanId(null); setExpandido(null); setErro('')
  }

  async function salvarPerfil() {
    setSalvandoPerfil(true); setErro('')
    try {
      const res = await saveContentProfile({ ...profile, id: activeId ?? undefined })
      if (res.success) {
        setActiveId(res.data.id)
        await refreshProfiles()
        setProfile(p => ({ ...p, id: res.data.id }))
        setProfileAberto(false)
      } else setErro(res.error)
    } finally { setSalvandoPerfil(false) }
  }

  async function excluirPerfil() {
    if (!activeId) { novoPerfil(); return }
    if (!confirm('Excluir este Instagram e seus dados?')) return
    const res = await deleteContentProfile(activeId)
    if (!res.success) { alert(res.error); return }
    const list = await refreshProfiles()
    if (list.length > 0) await carregarPerfil(list[0].id)
    else novoPerfil()
  }

  async function gerarPlano() {
    if (!profile.nicho?.trim()) { setErro('Preencha pelo menos o nicho.'); setProfileAberto(true); return }
    setGerandoPlano(true); setErro(''); setItens([]); setPlanId(null); setExpandido(null)
    const msgs = ['🧠 Analisando o negócio...', '🗓️ Montando o calendário de 30 dias...', '🎯 Distribuindo topo, meio e fundo...', '🚀 Finalizando o plano...']
    let i = 0; setLoadingMsg(msgs[0])
    const interval = setInterval(() => { i = (i + 1) % msgs.length; setLoadingMsg(msgs[i]) }, 2500)
    try {
      const res = await fetch('/api/conteudo/plano', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, quantidade }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar plano')
      setItens(data.itens); setPlanTitulo(data.titulo)
      const saved = await savePlan({ quantidade, itens: data.itens, titulo: data.titulo, profileId: activeId ?? undefined, instagram: profile.instagram })
      if (saved.success) setPlanId(saved.data.id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao gerar plano')
    } finally {
      clearInterval(interval); setGerandoPlano(false); setLoadingMsg('')
    }
  }

  async function gerarRoteiro(item: PlanItem) {
    setGerandoItem(item.ordem); setErro('')
    try {
      const tema = `${item.titulo}. Objetivo: ${item.objetivo}. Use como base este gancho: ${item.gancho}`
      const res = await fetch('/api/conteudo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, funil: item.funil, categoria: item.categoria, formato: item.formato, servico: '', tema }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar roteiro')
      const roteiro: PlanItemRoteiro = data.conteudo
      setItens(prev => prev.map(it => it.ordem === item.ordem ? { ...it, roteiro } : it))
      setExpandido(item.ordem)
      if (planId) savePlanItemRoteiro(planId, item.ordem, roteiro)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao gerar roteiro')
    } finally { setGerandoItem(null) }
  }

  async function abrirHistorico() {
    setShowHistorico(true); setCarregandoHistorico(true)
    try { const res = await listPlans(); if (res.success) setHistorico(res.data) }
    finally { setCarregandoHistorico(false) }
  }
  async function carregarPlano(id: string) {
    const res = await getPlan(id)
    if (!res.success) { alert(res.error); return }
    setPlanId(res.data.id); setPlanTitulo(res.data.titulo); setItens(res.data.itens)
    setQuantidade(res.data.quantidade); setExpandido(null); setShowHistorico(false); setErro('')
  }
  async function excluirPlano(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Excluir este plano?')) return
    const res = await deletePlan(id)
    if (res.success) { setHistorico(prev => prev.filter(p => p.id !== id)); if (planId === id) { setPlanId(null); setItens([]) } }
    else alert(res.error)
  }

  function copiar(texto: string, tag: string) {
    navigator.clipboard.writeText(texto); setCopiado(tag); setTimeout(() => setCopiado(''), 2000)
  }
  function copiarRoteiro(it: PlanItem) {
    const r = it.roteiro; if (!r) return
    const txt = [
      `GANCHO: ${r.gancho}`, '',
      ...r.estrutura.map(s => [
        s.secao,
        s.fala ? `  Falar: ${s.fala}` : '',
        s.conteudo ? `  ${s.fala ? 'Texto na tela' : 'Texto'}: ${s.conteudo}` : '',
        s.imagem ? `  Imagem: ${s.imagem}` : '',
      ].filter(Boolean).join('\n')), '',
      `CTA: ${r.cta}`, '', 'LEGENDA:', r.legenda, '',
      r.hashtags.map(h => `#${h}`).join(' '),
    ].join('\n')
    copiar(txt, `r${it.ordem}`)
  }

  return (
    <div className="py-8 px-6">
      <div className="max-w-4xl mx-auto">

        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-xl flex-shrink-0">✨</div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gerador de Conteúdo</h1>
            <p className="text-sm text-gray-500">Um plano de Instagram de 30 dias — a IA monta tudo pra você</p>
          </div>
          <button onClick={abrirHistorico}
            className="ml-auto px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors">
            📁 Meus planos
          </button>
        </div>

        {/* Seletor de Instagram / perfis */}
        {!carregandoPerfil && profiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide mr-1">Instagram:</span>
            {profiles.map(p => {
              const ativo = activeId === p.id
              return (
                <span key={p.id}
                  className={`inline-flex items-center rounded-full text-sm font-medium border transition-colors ${ativo ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  <button onClick={() => carregarPerfil(p.id)} className="pl-3 py-1.5 pr-1">
                    {profileLabel(p)}
                  </button>
                  {p.instagram && (
                    <a href={`https://instagram.com/${p.instagram}`} target="_blank" rel="noopener noreferrer"
                      title="Abrir no Instagram"
                      className={`pr-3 pl-1 py-1.5 ${ativo ? 'text-white/80 hover:text-white' : 'text-gray-400 hover:text-indigo-600'}`}>
                      ↗
                    </a>
                  )}
                </span>
              )
            })}
            <button onClick={novoPerfil}
              className="px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-colors">
              + Adicionar Instagram
            </button>
          </div>
        )}

        {/* Perfil */}
        <div className="bg-white border border-gray-200 rounded-xl mb-5">
          <button onClick={() => setProfileAberto(o => !o)} className="w-full flex items-center justify-between px-5 py-4 text-left">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧠</span>
              <div>
                <p className="font-semibold text-gray-900 text-sm">
                  {activeId ? (profile.instagram ? `@${profile.instagram}` : profile.negocio || 'Perfil') : 'Novo Instagram'}
                </p>
                <p className="text-xs text-gray-500">
                  {carregandoPerfil ? 'Carregando...' : activeId ? '✅ Perfil salvo' : '⚠️ Preencha e salve para gerar o plano'}
                </p>
              </div>
            </div>
            <span className="text-gray-400 text-sm">{profileAberto ? '▲ fechar' : '▼ editar'}</span>
          </button>
          {profileAberto && (
            <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Instagram (@)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                    <input value={profile.instagram ?? ''} onChange={e => setProfile(p => ({ ...p, instagram: e.target.value.replace('@', '') }))}
                      placeholder="seuperfil"
                      className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Nome do negócio</label>
                  <input value={profile.negocio ?? ''} onChange={e => setProfile(p => ({ ...p, negocio: e.target.value }))}
                    placeholder="Ex: Espaço Liss"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Nicho *</label>
                  <input value={profile.nicho} onChange={e => setProfile(p => ({ ...p, nicho: e.target.value }))}
                    placeholder="Ex: Estética"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Serviços / produtos</label>
                <textarea value={profile.servicos ?? ''} onChange={e => setProfile(p => ({ ...p, servicos: e.target.value }))} rows={2}
                  placeholder="Liste os principais serviços ou produtos, separados por vírgula"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Sobre o negócio, público e foco</label>
                <textarea value={profile.sobre ?? ''} onChange={e => setProfile(p => ({ ...p, sobre: e.target.value }))} rows={4}
                  placeholder="Fale sobre o negócio, quem é o público e qual foco quer seguir"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={salvarPerfil} disabled={salvandoPerfil}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 transition-all">
                  {salvandoPerfil ? '⏳ Salvando...' : '💾 Salvar'}
                </button>
                {(activeId || profiles.length > 0) && (
                  <button onClick={excluirPerfil}
                    className="px-3 py-2.5 rounded-xl text-sm text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all">
                    🗑️ Excluir
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Gerar plano */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quantos conteúdos para o mês?</label>
            <div className="flex gap-1.5 mt-2">
              {QUANTIDADES.map(q => (
                <button key={q} onClick={() => setQuantidade(q)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${quantidade === q ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                  {q}
                </button>
              ))}
            </div>
          </div>
          <button onClick={gerarPlano} disabled={gerandoPlano}
            className="py-3 px-6 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-sm">
            {gerandoPlano ? '⏳ Gerando...' : '✨ Gerar plano do mês'}
          </button>
        </div>

        {gerandoPlano && (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center space-y-5">
            <div className="text-5xl animate-pulse">🗓️</div>
            <p className="text-indigo-600 font-medium">{loadingMsg}</p>
            <div className="flex justify-center gap-2">
              {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />)}
            </div>
          </div>
        )}

        {erro && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center mb-4"><p className="text-red-600 text-sm">❌ {erro}</p></div>}

        {!gerandoPlano && itens.length === 0 && !erro && (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center space-y-3">
            <div className="text-5xl opacity-20">🗓️</div>
            <p className="text-gray-400 text-sm">Escolha a quantidade e clique em <span className="font-medium text-gray-600">Gerar plano do mês</span><br />A IA decide formato, funil e categoria de cada conteúdo.</p>
          </div>
        )}

        {/* Calendário */}
        {itens.length > 0 && !gerandoPlano && (
          <div className="space-y-3">
            <p className="font-semibold text-gray-900">{planTitulo || 'Plano de conteúdo'} <span className="text-gray-400 font-normal text-sm">• {itens.length} conteúdos</span></p>

            {itens.map(item => {
              const fmt = FORMATO_META[item.formato] ?? { emoji: '📄', label: item.formato }
              const fun = FUNIL_META[item.funil] ?? { label: item.funil, cls: 'bg-gray-50 text-gray-600 border-gray-200' }
              const cat = CATEGORIA_META[item.categoria] ?? { emoji: '•', label: item.categoria }
              const aberto = expandido === item.ordem
              return (
                <div key={item.ordem} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center justify-center w-11 flex-shrink-0">
                        <span className="text-[10px] text-gray-400 uppercase">Dia</span>
                        <span className="text-lg font-bold text-indigo-600 leading-none">{item.dia}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">{fmt.emoji} {fmt.label}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${fun.cls}`}>{fun.label}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">{cat.emoji} {cat.label}</span>
                        </div>
                        <p className="font-semibold text-gray-900 text-sm">{item.titulo}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.objetivo}</p>
                        <p className="text-sm text-gray-700 mt-1.5"><span className="text-gray-400">Gancho:</span> {item.gancho}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {item.roteiro ? (
                        <>
                          <button onClick={() => setExpandido(aberto ? null : item.ordem)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100">
                            {aberto ? '▲ Ocultar roteiro' : '▼ Ver roteiro'}
                          </button>
                          <button onClick={() => copiarRoteiro(item)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${copiado === `r${item.ordem}` ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            {copiado === `r${item.ordem}` ? '✅ Copiado' : '📋 Copiar'}
                          </button>
                        </>
                      ) : (
                        <button onClick={() => gerarRoteiro(item)} disabled={gerandoItem === item.ordem}
                          className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50">
                          {gerandoItem === item.ordem ? '⏳ Gerando roteiro...' : '✨ Gerar roteiro completo'}
                        </button>
                      )}
                    </div>
                  </div>

                  {aberto && item.roteiro && (
                    <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                      <div>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">🎣 Gancho</p>
                        <p className="text-sm text-gray-900 font-medium">{item.roteiro.gancho}</p>
                      </div>
                      <div className="space-y-2.5">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{item.formato === 'reels' ? '🎬 Roteiro por cena' : item.formato === 'carrossel' ? '🖼️ Slides' : '📝 Roteiro'}</p>
                        {item.roteiro.estrutura.map((s, i) => (
                          <div key={i} className="border-l-2 border-indigo-200 pl-3 py-0.5">
                            <p className="text-xs font-semibold text-indigo-600">{s.secao}</p>
                            {s.fala && <p className="text-sm text-gray-700 whitespace-pre-wrap mt-0.5"><span className="text-gray-400">🎙️ Falar:</span> {s.fala}</p>}
                            {s.conteudo && <p className="text-sm text-gray-700 whitespace-pre-wrap mt-0.5"><span className="text-gray-400">{s.fala ? '🔤 Texto na tela:' : '✍️ Texto:'}</span> {s.conteudo}</p>}
                            {s.imagem && <p className="text-xs text-gray-500 whitespace-pre-wrap mt-0.5"><span className="text-gray-400">🖼️ Imagem:</span> {s.imagem}</p>}
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">🎯 CTA</p>
                        <p className="text-sm text-gray-700">{item.roteiro.cta}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">📄 Legenda</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.roteiro.legenda}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {item.roteiro.hashtags.map((h, i) => <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600">#{h}</span>)}
                        </div>
                      </div>
                      {item.roteiro.dicas && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide mb-0.5">💡 Dicas</p>
                          <p className="text-sm text-amber-800 whitespace-pre-wrap">{item.roteiro.dicas}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal histórico */}
      {showHistorico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowHistorico(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <p className="font-semibold text-gray-900">Meus planos</p>
              <button onClick={() => setShowHistorico(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="p-3 overflow-y-auto">
              {carregandoHistorico ? (
                <p className="text-center text-gray-400 text-sm py-8">Carregando...</p>
              ) : historico.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">Nenhum plano salvo ainda.</p>
              ) : (
                <div className="space-y-1.5">
                  {historico.map(p => (
                    <div key={p.id} onClick={() => carregarPlano(p.id)}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-100 hover:bg-indigo-50 hover:border-indigo-200 transition-colors cursor-pointer flex items-center gap-3 group">
                      <span className="text-lg flex-shrink-0">🗓️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{p.titulo}</p>
                        <p className="text-xs text-gray-400">{p.instagram ? `@${p.instagram} • ` : ''}{p.quantidade} conteúdos • {new Date(p.createdAt).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <button onClick={e => excluirPlano(p.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all flex-shrink-0 px-2 text-lg">🗑️</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
