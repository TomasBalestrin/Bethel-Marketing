import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getRedirectUri, exchangeCodeForTokens } from '@/lib/google/oauth'
import { encryptToken } from '@/lib/google/crypto'

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const cookieState = req.cookies.get('g_oauth_state')?.value

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/auth/login', origin))
  if (!code || !state || state !== cookieState) {
    return NextResponse.redirect(new URL('/dashboard/google?erro=state', origin))
  }

  try {
    const tokens = await exchangeCodeForTokens(code, getRedirectUri(origin))

    const dbUser =
      (await prisma.user.findFirst({ where: { OR: [{ id: user.id }, { email: user.email! }] } })) ??
      (await prisma.user.create({ data: { id: user.id, email: user.email!, name: user.user_metadata?.name || user.email! } }))

    const expiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000)
    await prisma.googleConnection.upsert({
      where: { userId: dbUser.id },
      create: {
        userId: dbUser.id,
        accessToken: encryptToken(tokens.access_token),
        refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
        tokenExpiry: expiry,
        scopes: tokens.scope ?? null,
      },
      update: {
        accessToken: encryptToken(tokens.access_token),
        // só sobrescreve refresh_token se o Google devolver um novo
        ...(tokens.refresh_token ? { refreshToken: encryptToken(tokens.refresh_token) } : {}),
        tokenExpiry: expiry,
        scopes: tokens.scope ?? null,
      },
    })

    const res = NextResponse.redirect(new URL('/dashboard/google?connected=1', origin))
    res.cookies.delete('g_oauth_state')
    return res
  } catch (e) {
    console.error('Google OAuth callback error:', e)
    return NextResponse.redirect(new URL('/dashboard/google?erro=token', origin))
  }
}
