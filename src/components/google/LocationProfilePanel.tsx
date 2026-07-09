'use client'

import { useState, useEffect } from 'react'
import { getLocationProfile, saveLocationProfile, saveLocationHours, type GbpLocationDetails } from '@/app/actions/google'

const DIAS: Record<string, string> = {
  MONDAY: 'Segunda', TUESDAY: 'Terça', WEDNESDAY: 'Quarta', THURSDAY: 'Quinta',
  FRIDAY: 'Sexta', SATURDAY: 'Sábado', SUNDAY: 'Domingo',
}
const ORDEM = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

// ── Editor de horários ─────────────────────────────────────────────────────────

type Interval = { open: string; close: string }
type DayHours = { day: string; open: boolean; intervals: Interval[] }

function initHours(periods: GbpLocationDetails['regularHours']): DayHours[] {
  const byDay: Record<string, Interval[]> = {}
  for (const p of periods) {
    if (!p.openDay) continue
    ;(byDay[p.openDay] ??= []).push({ open: p.openTime || '09:00', close: p.closeTime || '18:00' })
  }
  return ORDEM.map(day => {
    const iv = byDay[day]
    return { day, open: (iv?.length ?? 0) > 0, intervals: iv && iv.length ? iv : [{ open: '08:00', close: '18:00' }] }
  })
}

function HoursEditor({ id, initial }: { id: string; initial: GbpLocationDetails['regularHours'] }) {
  const [dias, setDias] = useState<DayHours[]>(() => initHours(initial))
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  const upd = (i: number, fn: (d: DayHours) => DayHours) =>
    setDias(prev => prev.map((x, idx) => (idx === i ? fn(x) : x)))

  async function salvar() {
    setSalvando(true); setMsg('')
    const payload = dias.map(d => ({ day: d.day, intervals: d.open ? d.intervals : [] }))
    const res = await saveLocationHours(id, payload)
    setMsg(res.success ? '✅ Horários salvos! Pode levar alguns minutos para refletir.' : '❌ ' + res.error)
    setSalvando(false)
  }

  const timeCls = 'border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100'

  return (
    <div className="space-y-2">
      {dias.map((d, i) => (
        <div key={d.day} className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
          <span className="w-20 text-xs text-gray-700 pt-1.5 flex-shrink-0">{DIAS[d.day]}</span>
          <button type="button" onClick={() => upd(i, x => ({ ...x, open: !x.open }))}
            className={`text-[11px] font-semibold px-2 py-1 rounded-md border flex-shrink-0 ${
              d.open ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'
            }`}>
            {d.open ? 'Aberto' : 'Fechado'}
          </button>
          {d.open ? (
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              {d.intervals.map((iv, j) => (
                <div key={j} className="flex items-center gap-1.5">
                  <input type="time" value={iv.open} className={timeCls}
                    onChange={e => upd(i, x => ({ ...x, intervals: x.intervals.map((v, jj) => jj === j ? { ...v, open: e.target.value } : v) }))} />
                  <span className="text-gray-400 text-xs">às</span>
                  <input type="time" value={iv.close} className={timeCls}
                    onChange={e => upd(i, x => ({ ...x, intervals: x.intervals.map((v, jj) => jj === j ? { ...v, close: e.target.value } : v) }))} />
                  {d.intervals.length > 1 && (
                    <button type="button" onClick={() => upd(i, x => ({ ...x, intervals: x.intervals.filter((_, jj) => jj !== j) }))}
                      className="text-gray-300 hover:text-red-500 text-sm">✕</button>
                  )}
                </div>
              ))}
              {d.intervals.length < 3 && (
                <button type="button" onClick={() => upd(i, x => ({ ...x, intervals: [...x.intervals, { open: '14:00', close: '18:00' }] }))}
                  className="text-[11px] text-blue-600 hover:underline text-left">+ intervalo (ex: fecha pro almoço)</button>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-300 pt-1.5">Fechado o dia todo</span>
          )}
        </div>
      ))}
      {msg && <p className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-2">{msg}</p>}
      <div className="flex justify-end">
        <button onClick={salvar} disabled={salvando}
          className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 disabled:opacity-40">
          {salvando ? 'Salvando...' : 'Salvar horários'}
        </button>
      </div>
    </div>
  )
}

// ── Painel do perfil ───────────────────────────────────────────────────────────

export function LocationProfilePanel({ id }: { id: string }) {
  const [det, setDet] = useState<GbpLocationDetails | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

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
      } else setErro(res.error)
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
    if (res.success) { setMsg('✅ Salvo no Google! Pode levar alguns minutos para refletir.'); setDet({ ...det, ...patch }) }
    else setMsg('❌ ' + res.error)
    setSalvando(false)
  }

  if (carregando) return <div className="text-xs text-gray-400 py-3">Carregando perfil do Google...</div>
  if (erro) return <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 my-2">{erro}</div>
  if (!det) return null

  const alterado =
    title !== (det.title ?? '') || phone !== (det.phone ?? '') ||
    website !== (det.website ?? '') || description !== (det.description ?? '')

  const label = 'block text-[11px] font-medium text-gray-500 mb-1'
  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300'

  return (
    <div className="space-y-5">
      {/* Dados básicos */}
      <div className="space-y-3">
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
        {msg && <p className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-2">{msg}</p>}
        <div className="flex justify-end">
          <button onClick={salvar} disabled={salvando || !alterado}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 disabled:opacity-40">
            {salvando ? 'Salvando...' : 'Salvar dados'}
          </button>
        </div>
      </div>

      {/* Horários */}
      <div>
        <label className={label}>Horários de funcionamento</label>
        <HoursEditor id={id} initial={det.regularHours} />
      </div>

      {/* Somente leitura */}
      <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-xs text-gray-600">
        {det.primaryCategory && <p><span className="text-gray-400">Categoria principal:</span> {det.primaryCategory}</p>}
        {det.additionalCategories.length > 0 && (
          <p><span className="text-gray-400">Outras categorias:</span> {det.additionalCategories.join(', ')}</p>
        )}
        {det.address && <p><span className="text-gray-400">Endereço:</span> {det.address}</p>}
        <p className="text-[10px] text-gray-400 pt-1">Categoria e endereço serão editáveis em breve.</p>
      </div>
    </div>
  )
}
