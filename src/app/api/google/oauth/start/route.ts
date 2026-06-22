import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { googleConfigured, getRedirectUri, buildAuthUrl } from '@/lib/google/oauth'

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/auth/login', origin))
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL('/dashboard/google?erro=nao_configurado', origin))
  }

  const state = crypto.randomBytes(16).toString('hex')
  const redirectUri = getRedirectUri(origin)
  const res = NextResponse.redirect(buildAuthUrl(redirectUri, state))
  res.cookies.set('g_oauth_state', state, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600,
  })
  return res
}
