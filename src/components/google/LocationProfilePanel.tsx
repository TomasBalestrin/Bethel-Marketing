'use client'

import { useState, useEffect } from 'react'
import { getLocationProfile, saveLocationProfile, type GbpLocationDetails } from '@/app/actions/google'

const DIAS: Record<string, string> = {
  MONDAY: 'Seg', TUESDAY: 'Ter', WEDNESDAY: 'Qua', THURSDAY: 'Qui',
  FRIDAY: 'Sex', SATURDAY: 'Sáb', SUNDAY: 'Dom',
}
const ORDEM = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

function horariosPorDia(det: GbpLocationDetails): { dia: string; texto: string }[] {
  const map: Record<string, string[]> = {}
  for (const p of det.regularHours) {
    if (!p.openDay) continue
    ;(map[p.openDay] ??= []).push(`${p.openTime}–${p.closeTime}`)
  }
  return ORDEM.filter(d => map[d]).map(d => ({ dia: DIAS[d] ?? d, texto: map[d].join(', ') }))
}

export function LocationProfilePanel({ id }: { id: string }) {
  const [det, setDet] = useState<GbpLocationDetails | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  // campos editáveis
  const [title, setTitle] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    (async () => {
      setCarregando(true); setErro('')
      const res = await getLocationProfile(id)
      if (res.success) {
        setDet(res.data)
        setTitle(res.data.title ?? '')
        setPhone(res.data.phone ?? '')
        setWebsite(res.data.website ?? '')
        setDescription(res.data.description ?? '')
      } else {
        setErro(res.error)
      }
      setCarregando(false)
    })()
  }, [id])

  async function salvar() {
    if (!det) return
    setSalvando(true); setMsg('')
    const patch: { title?: string; phone?: string; website?: string; description?: string } = {}
    if (title !== (det.title ?? '')) patch.title = title
    if (phone !== (det.phone ?? '')) patch.phone = phone
    if (website !== (det.website ?? '')) patch.website = website
    if (description !== (det.description ?? '')) patch.description = description
    if (Object.keys(patch).length === 0) { setMsg('Nada foi alterado.'); setSalvando(false); return }
    const res = await saveLocationProfile(id, patch)
    if (res.success) {
      setMsg('✅ Salvo no Google! Pode levar alguns minutos para refletir no perfil público.')
      setDet({ ...det, ...patch })
    } else {
      setMsg('❌ ' + res.error)
    }
    setSalvando(false)
  }

  if (carregando) return <div className="text-xs text-gray-400 py-3">Carregando perfil do Google...</div>
  if (erro) return <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 my-2">{erro}</div>
  if (!det) return null

  const horarios = horariosPorDia(det)
  const alterado =
    title !== (det.title ?? '') || phone !== (det.phone ?? '') ||
    website !== (det.website ?? '') || description !== (det.description ?? '')

  const label = 'block text-[11px] font-medium text-gray-500 mb-1'
  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300'

  return (
    <div className="mt-3 border-t border-gray-100 pt-3 space-y-3">
      {/* Editáveis */}
      <div>
        <label className={label}>Nome do negócio</label>
        <input className={input} value={title} onChange={e => setTitle(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={label}>Telefone</label>
          <input className={input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="(83) 90000-0000" />
        </div>
        <div>
          <label className={label}>Site</label>
          <input className={input} value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
        </div>
      </div>
      <div>
        <label className={label}>Descrição do negócio</label>
        <textarea className={input + ' resize-y min-h-[80px]'} value={description} maxLength={750}
          onChange={e => setDescription(e.target.value)} placeholder="Conte sobre o negócio (até 750 caracteres)" />
        <p className="text-[10px] text-gray-400 mt-0.5 text-right">{description.length}/750</p>
      </div>

      {/* Somente leitura */}
      <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-xs text-gray-600">
        {det.primaryCategory && <p><span className="text-gray-400">Categoria principal:</span> {det.primaryCategory}</p>}
        {det.additionalCategories.length > 0 && (
          <p><span className="text-gray-400">Outras categorias:</span> {det.additionalCategories.join(', ')}</p>
        )}
        {det.address && <p><span className="text-gray-400">Endereço:</span> {det.address}</p>}
        {horarios.length > 0 && (
          <div>
            <span className="text-gray-400">Horários:</span>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
              {horarios.map(h => <span key={h.dia}>{h.dia}: {h.texto}</span>)}
            </div>
          </div>
        )}
        <p className="text-[10px] text-gray-400 pt-1">Categoria, endereço e horários serão editáveis em breve.</p>
      </div>

      {msg && <p className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-2">{msg}</p>}

      <div className="flex justify-end">
        <button onClick={salvar} disabled={salvando || !alterado}
          className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 disabled:opacity-40">
          {salvando ? 'Salvando...' : 'Salvar no Google'}
        </button>
      </div>
    </div>
  )
}
