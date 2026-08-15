import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { BriefingActions } from '@/components/BriefingActions'

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  novo: { label: 'Novo', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  em_andamento: { label: 'Em andamento', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  concluido: { label: 'Concluído', cls: 'bg-green-50 text-green-700 border-green-200' },
}

function Galeria({ titulo, urls }: { titulo: string; urls: string[] }) {
  if (!urls || urls.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{titulo} ({urls.length})</p>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-lg overflow-hidden border border-gray-200 hover:ring-2 hover:ring-indigo-300">
            <img src={u} alt="" className="w-full h-full object-cover" />
          </a>
        ))}
      </div>
    </div>
  )
}

function Campo({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  if (!valor) return null
  return <p className="text-sm text-gray-700"><span className="text-gray-400">{rotulo}: </span>{valor}</p>
}

export default async function AdminBriefingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const dbUser = await prisma.user.findFirst({ where: { OR: [{ id: user.id }, { email: user.email! }] } })
  if (dbUser?.role !== 'ADMIN') redirect('/dashboard')

  const briefings = await prisma.briefing.findMany({ orderBy: { createdAt: 'desc' } })

  return (
    <div className="py-8 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Briefings recebidos</h1>
            <p className="text-sm text-gray-500">{briefings.length} formulário(s) enviado(s) pelos mentorados</p>
          </div>
          <a href="/admin" className="text-sm text-gray-500 hover:text-gray-900">← Voltar ao admin</a>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6 text-sm text-indigo-800">
          🔗 Link do formulário para enviar aos mentorados: <span className="font-mono font-medium">/briefing</span> (ex: https://www.bethelapp.com.br/briefing)
        </div>

        {briefings.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 text-sm">Nenhum briefing recebido ainda.</div>
        ) : (
          <div className="space-y-4">
            {briefings.map(b => {
              const st = STATUS_LABEL[b.status] ?? STATUS_LABEL.novo
              return (
                <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      {b.logoUrl && <img src={b.logoUrl} alt="Logo" title="Logo" className="w-12 h-12 object-contain rounded-lg border border-gray-200" />}
                      {b.fotoProfissionalUrl && <img src={b.fotoProfissionalUrl} alt="Foto do profissional" title="Foto do profissional" className="w-12 h-12 object-cover rounded-lg border border-gray-200" />}
                      <div>
                        <p className="font-semibold text-gray-900">{b.nomeEmpresa}</p>
                        <p className="text-xs text-gray-400">{new Date(b.createdAt).toLocaleString('pt-BR')}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                    </div>
                    <BriefingActions id={b.id} status={b.status} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                    <Campo rotulo="WhatsApp" valor={b.whatsapp} />
                    <Campo rotulo="E-mail" valor={b.email} />
                    <Campo rotulo="Instagram" valor={b.instagram ? `@${b.instagram}` : null} />
                    <Campo rotulo="Endereço" valor={b.endereco} />
                    <Campo rotulo="Horário" valor={b.horario} />
                    <Campo rotulo="Anos no mercado" valor={b.anosMercado} />
                    <Campo rotulo="Clientes atendidos" valor={b.clientesAtendidos} />
                    <Campo rotulo="Carro-chefe" valor={b.servicoCarroChefe} />
                  </div>
                  <Campo rotulo="Serviços/produtos" valor={b.servicos} />
                  <Campo rotulo="Observações" valor={b.observacoes} />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-gray-100 pt-4">
                    <Galeria titulo="Fotos da empresa" urls={b.fotosEmpresa} />
                    <Galeria titulo="Depoimentos" urls={b.fotosDepoimento} />
                    <Galeria titulo="Antes e depois" urls={b.fotosAntesDepois} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
