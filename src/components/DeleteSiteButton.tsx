'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, Loader2 } from 'lucide-react'
import { deleteSite } from '@/app/actions/site'
import { Button } from '@/components/ui/button'

export function DeleteSiteButton({
  siteId, nome, publicado,
}: { siteId: string; nome: string; publicado: boolean }) {
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const confere = texto.trim().toLowerCase() === nome.trim().toLowerCase()

  function excluir() {
    if (!confere) return
    startTransition(async () => {
      const res = await deleteSite(siteId)
      if (!res.success) toast.error(res.error)
      else {
        toast.success('Site excluído.')
        setAberto(false)
        router.refresh()
      }
    })
  }

  if (!aberto) {
    return (
      <Button variant="outline" size="sm" onClick={() => setAberto(true)}
        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
        <Trash2 />
        Excluir
      </Button>
    )
  }

  return (
    <div className="w-full mt-2 border border-red-200 bg-red-50 rounded-lg p-3 space-y-2">
      <p className="text-sm font-semibold text-red-800">Excluir “{nome}” definitivamente?</p>
      <p className="text-xs text-red-700 leading-relaxed">
        Esta ação <b>não pode ser desfeita</b>. Serão apagados os dados do formulário, o site gerado, depoimentos e resultados.
        {publicado && <> O endereço publicado <b>sai do ar</b> imediatamente.</>}
      </p>
      <div>
        <label className="block text-[11px] font-medium text-red-800 mb-1">
          Para confirmar, digite: <b>{nome}</b>
        </label>
        <input
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder={nome}
          className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-100"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={excluir} disabled={!confere || pending}
          className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-40">
          {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
          {pending ? 'Excluindo...' : 'Excluir definitivamente'}
        </Button>
        <button type="button" onClick={() => { setAberto(false); setTexto('') }}
          className="text-xs text-gray-500 hover:underline">Cancelar</button>
      </div>
    </div>
  )
}
