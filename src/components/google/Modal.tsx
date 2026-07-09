'use client'

import { useEffect } from 'react'

export function Modal({
  open, onClose, title, subtitle, icon, accent = 'bg-gray-100', children,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  icon?: string
  accent?: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-[fadeIn_.15s_ease]" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[86vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-[popIn_.18s_ease]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          {icon && (
            <div className={`w-10 h-10 rounded-xl grid place-items-center text-xl flex-shrink-0 ${accent}`}>{icon}</div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900 truncate">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Fechar"
            className="w-8 h-8 rounded-lg grid place-items-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors flex-shrink-0">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">
          {children}
        </div>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes popIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}`}</style>
    </div>
  )
}
