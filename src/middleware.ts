import { createServerClient, type SetAllCookies } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Subdomínios de <appDomain> que redirecionam para um site externo já hospedado
// em outro lugar (ex: HostGator). Chave = subdomínio, valor = URL de destino.
const EXTERNAL_REDIRECTS: Record<string, string> = {
  itils: 'https://itils.com.br',
}

export async function middleware(request: NextRequest) {
  // Serve client sites via subdomain (e.g. clinic.bethelapps.com)
  const hostname = request.headers.get('host') ?? ''
  const appDomain = process.env.MENTOR_DOMAIN
    || (process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : null)

  if (appDomain && hostname.endsWith(`.${appDomain}`)) {
    const slug = hostname.slice(0, hostname.length - appDomain.length - 1)
    if (slug && slug !== 'www') {
      const external = EXTERNAL_REDIRECTS[slug]
      if (external) {
        // 307 (temporário) de propósito: se um dia o site migrar para o Bethel,
        // o navegador não fica com o redirect cacheado permanentemente.
        const target = new URL(request.nextUrl.pathname + request.nextUrl.search, external)
        return NextResponse.redirect(target, 307)
      }
      return NextResponse.rewrite(new URL(`/s/${slug}`, request.url))
    }
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const protectedPaths = ['/dashboard', '/admin']
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p))
  const isAuthPage = pathname.startsWith('/auth')

  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  if (user && isAuthPage && !pathname.startsWith('/auth/callback')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
