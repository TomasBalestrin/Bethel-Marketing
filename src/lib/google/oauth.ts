// Helpers de OAuth 2.0 do Google para o Business Profile.
// Sem SDK: chamadas diretas aos endpoints do Google (mantém o projeto leve).

export const GOOGLE_BUSINESS_SCOPE = 'https://www.googleapis.com/auth/business.manage'
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET)
}

// URL de redirect do callback (usa NEXT_PUBLIC_APP_URL ou a origem da requisição)
export function getRedirectUri(origin?: string): string {
  const base = process.env.GOOGLE_OAUTH_REDIRECT_URI
    || (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/google/oauth/callback` : null)
    || (origin ? `${origin}/api/google/oauth/callback` : null)
  if (!base) throw new Error('Não foi possível determinar a redirect URI do Google')
  return base
}

export function buildAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_BUSINESS_SCOPE,
    access_type: 'offline', // garante refresh_token
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
  token_type: string
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Falha ao trocar code por token: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Falha ao renovar token: ${res.status} ${await res.text()}`)
  return res.json()
}
