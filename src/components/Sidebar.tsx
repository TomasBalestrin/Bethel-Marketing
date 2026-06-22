'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, LogOut, ShieldCheck, Instagram, Radar, Sparkles, MapPin } from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import { UserAvatar } from './UserAvatar'
import { cn } from '@/lib/utils'

type Props = {
  userName: string
  userEmail: string
  isAdmin?: boolean
}

export function Sidebar({ userName, userEmail, isAdmin }: Props) {
  const pathname = usePathname()

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col min-h-screen flex-shrink-0">
      <div className="px-5 py-5 border-b border-gray-100">
        <span className="text-lg font-bold text-gray-900">Bethel Marketing</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <Link
          href="/dashboard"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
            pathname === '/dashboard'
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <LayoutDashboard className="w-4 h-4" />
          Meu Site
        </Link>

        <Link
          href="/dashboard/conteudo"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
            pathname.startsWith('/dashboard/conteudo')
              ? 'bg-indigo-50 text-indigo-700 font-medium'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <Sparkles className="w-4 h-4" />
          Gerador de Conteúdo
        </Link>

        <Link
          href="/dashboard/instagram"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
            pathname.startsWith('/dashboard/instagram')
              ? 'bg-pink-50 text-pink-700 font-medium'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <Instagram className="w-4 h-4" />
          Instagram
        </Link>

        <Link
          href="/dashboard/google"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
            pathname.startsWith('/dashboard/google')
              ? 'bg-green-50 text-green-700 font-medium'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <MapPin className="w-4 h-4" />
          Google Meu Negócio
        </Link>

        <Link
          href="/dashboard/rastreamento"
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
            pathname.startsWith('/dashboard/rastreamento')
              ? 'bg-orange-50 text-orange-700 font-medium'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <Radar className="w-4 h-4" />
          Rastreamento
        </Link>

        {isAdmin && (
          <Link
            href="/admin"
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname.startsWith('/admin')
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <ShieldCheck className="w-4 h-4" />
            Admin
          </Link>
        )}
      </nav>

      <div className="px-4 py-4 border-t border-gray-100 space-y-3">
        <UserAvatar name={userName} email={userEmail} />
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </form>
      </div>
    </aside>
  )
}
