'use client'

import { useState } from 'react'
import { submitBriefing, type BriefingInput } from '@/app/actions/briefing'

async function uploadImagem(file: File): Promise<string | null> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/briefing/upload', { method: 'POST', body: fd })
  const data = await res.json()
  return res.ok ? data.url : null
}

function GrupoFotos({ label, ajuda, max, urls, onChange }: {
  label: string; ajuda?: string; max: number; urls: string[]; onChange: (u: string[]) => void
}) {
  const [enviando, setEnviando] = useState(false)
  async function add(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setEnviando(true)
    const novos: string[] = []
    for (const f of files.slice(0, max - urls.length)) {
      const u = await uploadImagem(f)
      if (u) novos.push(u)
    }
    onChange([...urls, ...novos])
    setEnviando(false)
    e.target.value = ''
  }
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label} <span className="text-gray-400 font-normal">(até {max})</span></label>
      {ajuda && <p className="text-xs text-gray-400 mb-1.5">{ajuda}</p>}
      <div className="flex flex-wrap gap-2 mt-1.5">
        {urls.map((u, i) => (
          <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 group">
            <img src={u} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => onChange(urls.filter((_, j) => j !== i))}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-lg">×</button>
          </div>
        ))}
        {urls.length < max && (
          <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 hover:border-indigo-400 flex items-center justify-center cursor-pointer text-gray-400 hover:text-indigo-500 text-xs text-center">
            {enviando ? '...' : '+ foto'}
            <input type="file" accept="image/*" multiple className="hidden" onChange={add} disabled={enviando} />
          </label>
        )}
      </div>
    </div>
  )
}

const EMPTY: BriefingInput = {
  nomeEmpresa: '', email: '', whatsapp: '', endereco: '', instagram: '', horario: '',
  servicos: '', servicoCarroChefe: '', anosMercado: '', clientesAtendidos: '',
  logoUrl: '', fotosEmpresa: [], fotosDepoimento: [], fotosAntesDepois: [], observacoes: '',
}

export default function BriefingPage() {
  const [f, setF] = useState<BriefingInput>(EMPTY)
  const [logoEnviando, setLogoEnviando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  const set = (k: keyof BriefingInput, v: string | string[]) => setF(prev => ({ ...prev, [k]: v }))

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setLogoEnviando(true)
    const u = await uploadImagem(file)
    if (u) set('logoUrl', u)
    setLogoEnviando(false); e.target.value = ''
  }

  async function enviar() {
    if (!f.nomeEmpresa?.trim() || !f.whatsapp?.trim()) { setErro('Preencha pelo menos o nome da empresa e o WhatsApp.'); return }
    setEnviando(true); setErro('')
    try {
      const res = await submitBriefing(f)
      if (res.success) setEnviado(true)
      else setErro(res.error)
    } finally { setEnviando(false) }
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300'
  const labelCls = 'text-sm font-medium text-gray-700 mb-1.5 block'

  if (enviado) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-10 max-w-md text-center space-y-3">
          <div className="text-5xl">✅</div>
          <h1 className="text-xl font-bold text-gray-900">Briefing enviado!</h1>
          <p className="text-sm text-gray-500">Recebemos suas informações. Em breve seu site será criado. Obrigado!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <span className="text-lg font-bold text-gray-900">Bethel Marketing</span>
          <h1 className="text-2xl font-bold text-gray-900 mt-3">Formulário para criação do seu site</h1>
          <p className="text-sm text-gray-500 mt-1">Preencha os dados e envie as fotos do seu negócio. Campos com * são obrigatórios.</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
          {/* Dados básicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nome da empresa *</label>
              <input className={inputCls} value={f.nomeEmpresa} onChange={e => set('nomeEmpresa', e.target.value)} placeholder="Ex: Clínica Sorria" />
            </div>
            <div>
              <label className={labelCls}>WhatsApp de atendimento *</label>
              <input className={inputCls} value={f.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className={labelCls}>E-mail (para contato)</label>
              <input className={inputCls} value={f.email} onChange={e => set('email', e.target.value)} placeholder="seu@email.com" />
            </div>
            <div>
              <label className={labelCls}>Instagram</label>
              <input className={inputCls} value={f.instagram} onChange={e => set('instagram', e.target.value)} placeholder="@seuperfil" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Endereço completo</label>
            <input className={inputCls} value={f.endereco} onChange={e => set('endereco', e.target.value)} placeholder="Rua, número, bairro, cidade - UF (deixe vazio se for home office/online)" />
          </div>

          <div>
            <label className={labelCls}>Horário de funcionamento</label>
            <input className={inputCls} value={f.horario} onChange={e => set('horario', e.target.value)} placeholder="Ex: Seg a Sex 8h-18h, Sáb 8h-12h" />
          </div>

          {/* Logo */}
          <div>
            <label className={labelCls}>Logo da empresa</label>
            {f.logoUrl ? (
              <div className="flex items-center gap-3">
                <img src={f.logoUrl} alt="" className="w-16 h-16 object-contain rounded-lg border border-gray-200" />
                <button type="button" onClick={() => set('logoUrl', '')} className="text-xs text-gray-500 hover:text-red-500">Remover</button>
              </div>
            ) : (
              <label className="inline-flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-2.5 cursor-pointer text-sm text-gray-500 hover:border-indigo-400">
                {logoEnviando ? 'Enviando...' : '📁 Enviar logo'}
                <input type="file" accept="image/*" className="hidden" onChange={uploadLogo} disabled={logoEnviando} />
              </label>
            )}
          </div>

          {/* Serviços */}
          <div>
            <label className={labelCls}>Serviços / produtos que faz</label>
            <textarea className={inputCls} rows={3} value={f.servicos} onChange={e => set('servicos', e.target.value)} placeholder="Liste seus principais serviços ou produtos" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className={labelCls}>Serviço carro-chefe</label>
              <input className={inputCls} value={f.servicoCarroChefe} onChange={e => set('servicoCarroChefe', e.target.value)} placeholder="O que mais vende" />
            </div>
            <div>
              <label className={labelCls}>Anos no mercado</label>
              <input className={inputCls} value={f.anosMercado} onChange={e => set('anosMercado', e.target.value)} placeholder="Ex: 8" />
            </div>
            <div>
              <label className={labelCls}>Clientes atendidos (aprox.)</label>
              <input className={inputCls} value={f.clientesAtendidos} onChange={e => set('clientesAtendidos', e.target.value)} placeholder="Ex: 500+" />
            </div>
          </div>

          {/* Fotos */}
          <div className="border-t border-gray-100 pt-5 space-y-5">
            <GrupoFotos label="Fotos da empresa (estrutura)" ajuda="Mostre o espaço, ambiente, equipe." max={5}
              urls={f.fotosEmpresa ?? []} onChange={u => set('fotosEmpresa', u)} />
            <GrupoFotos label="Fotos de depoimentos" ajuda="Prints de conversas, avaliações (se tiver)." max={5}
              urls={f.fotosDepoimento ?? []} onChange={u => set('fotosDepoimento', u)} />
            <GrupoFotos label="Fotos de antes e depois" ajuda="Para estética ou similar (se aplicável)." max={5}
              urls={f.fotosAntesDepois ?? []} onChange={u => set('fotosAntesDepois', u)} />
          </div>

          <div>
            <label className={labelCls}>Observações (opcional)</label>
            <textarea className={inputCls} rows={2} value={f.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder="Algo mais que queira nos contar" />
          </div>

          {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{erro}</p>}

          <button onClick={enviar} disabled={enviando}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 transition-all">
            {enviando ? 'Enviando...' : 'Enviar briefing'}
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">Bethel Marketing — seus dados são usados apenas para criação do site.</p>
      </div>
    </div>
  )
}
