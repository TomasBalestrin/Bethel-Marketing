'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateBriefingStatus, deleteBriefing } from '@/app/actions/briefing'

const STATUS = [
  { v: 'novo', label: 'Novo' },
  { v: 'em_andamento', label: 'Em andamento' },
  { v: 'concluido', label: 'Concluído' },
]

export function BriefingActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function mudarStatus(novo: string) {
    setSaving(true)
    await updateBriefingStatus(id, novo)
    setSaving(false)
    router.refresh()
  }
  async function excluir() {
    if (!confirm('Excluir este briefing? Esta ação não pode ser desfeita.')) return
    setSaving(true)
    await deleteBriefing(id)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <a href={`/dashboard/criar?briefingId=${id}`}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700">
        ✨ Criar site com este briefing
      </a>
      <select value={status} onChange={e => mudarStatus(e.target.value)} disabled={saving}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 disabled:opacity-50">
        {STATUS.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
      </select>
      <button onClick={excluir} disabled={saving} className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50">🗑️ Excluir</button>
    </div>
  )
}
