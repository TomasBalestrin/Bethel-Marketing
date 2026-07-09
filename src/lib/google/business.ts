// Cliente das APIs do Google Business Profile (contas + informações dos locais).
// Usa as APIs novas (a v4 única foi fragmentada).

const ACCOUNT_MGMT = 'https://mybusinessaccountmanagement.googleapis.com/v1'
const BUSINESS_INFO = 'https://mybusinessbusinessinformation.googleapis.com/v1'

export class GoogleApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'GoogleApiError'
  }
}

async function gget(url: string, accessToken: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) {
    const body = await res.text()
    throw new GoogleApiError(res.status, `${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

async function gpatch(url: string, accessToken: string, body: unknown) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new GoogleApiError(res.status, `${res.status}: ${t.slice(0, 300)}`)
  }
  return res.json()
}

export type GbpAccount = { name: string; accountName?: string; type?: string }

export async function listAccounts(accessToken: string): Promise<GbpAccount[]> {
  const data = await gget(`${ACCOUNT_MGMT}/accounts`, accessToken)
  return (data.accounts ?? []) as GbpAccount[]
}

export type GbpRemoteLocation = {
  accountName: string
  locationName: string // ex: "locations/123"
  title: string
  primaryCategory: string | null
  placeId: string | null
  address: string | null
  phone: string | null
  website: string | null
}

function formatAddress(a: Record<string, unknown> | undefined): string | null {
  if (!a) return null
  const lines = Array.isArray(a.addressLines) ? (a.addressLines as string[]) : []
  const parts = [lines.join(', '), a.locality as string, a.administrativeArea as string, a.postalCode as string]
  return parts.filter(Boolean).join(' — ') || null
}

export async function listLocations(accessToken: string, accountName: string): Promise<GbpRemoteLocation[]> {
  const readMask = 'name,title,storefrontAddress,phoneNumbers,categories,websiteUri,metadata'
  const url = `${BUSINESS_INFO}/${accountName}/locations?readMask=${encodeURIComponent(readMask)}&pageSize=100`
  const data = await gget(url, accessToken)
  const locations = (data.locations ?? []) as Record<string, unknown>[]
  return locations.map(l => {
    const categories = l.categories as Record<string, unknown> | undefined
    const primary = categories?.primaryCategory as Record<string, unknown> | undefined
    const phones = l.phoneNumbers as Record<string, unknown> | undefined
    const metadata = l.metadata as Record<string, unknown> | undefined
    return {
      accountName,
      locationName: String(l.name ?? ''),
      title: String(l.title ?? '(sem nome)'),
      primaryCategory: primary?.displayName ? String(primary.displayName) : null,
      placeId: metadata?.placeId ? String(metadata.placeId) : null,
      address: formatAddress(l.storefrontAddress as Record<string, unknown> | undefined),
      phone: phones?.primaryPhone ? String(phones.primaryPhone) : null,
      website: l.websiteUri ? String(l.websiteUri) : null,
    }
  })
}

// ── Detalhes completos + edição de um local ───────────────────────────────────

export type GbpCategory = { name: string; displayName: string }

export type GbpHoursPeriod = {
  openDay: string       // ex: "MONDAY"
  openTime: string      // "HH:MM"
  closeDay: string
  closeTime: string
}

export type GbpLocationDetails = {
  locationName: string
  title: string
  primaryCategory: string | null
  additionalCategories: string[]
  primaryCategoryName: string | null              // gcid da categoria principal
  additionalCategoriesFull: GbpCategory[]          // { name(gcid), displayName }
  address: string | null
  city: string | null
  lat: number | null
  lng: number | null
  // endereço estruturado (para edição)
  addressLines: string[]
  locality: string
  adminArea: string
  postalCode: string
  regionCode: string
  phone: string | null
  website: string | null
  description: string | null
  regularHours: GbpHoursPeriod[]
}

function fmtTime(t: Record<string, unknown> | undefined): string {
  if (!t) return ''
  const h = String(Number(t.hours ?? 0)).padStart(2, '0')
  const m = String(Number(t.minutes ?? 0)).padStart(2, '0')
  return `${h}:${m}`
}

export async function getLocationDetails(accessToken: string, locationName: string): Promise<GbpLocationDetails> {
  const readMask = 'name,title,storefrontAddress,phoneNumbers,categories,websiteUri,regularHours,profile,latlng'
  const url = `${BUSINESS_INFO}/${locationName}?readMask=${encodeURIComponent(readMask)}`
  const l = (await gget(url, accessToken)) as Record<string, unknown>
  const categories = l.categories as Record<string, unknown> | undefined
  const primary = categories?.primaryCategory as Record<string, unknown> | undefined
  const additional = Array.isArray(categories?.additionalCategories)
    ? (categories!.additionalCategories as Record<string, unknown>[]) : []
  const phones = l.phoneNumbers as Record<string, unknown> | undefined
  const profile = l.profile as Record<string, unknown> | undefined
  const hours = l.regularHours as Record<string, unknown> | undefined
  const periods = Array.isArray(hours?.periods) ? (hours!.periods as Record<string, unknown>[]) : []
  const addr = l.storefrontAddress as Record<string, unknown> | undefined
  const latlng = l.latlng as Record<string, unknown> | undefined
  return {
    locationName: String(l.name ?? locationName),
    title: String(l.title ?? ''),
    primaryCategory: primary?.displayName ? String(primary.displayName) : null,
    additionalCategories: additional.map(c => String(c.displayName ?? '')).filter(Boolean),
    primaryCategoryName: primary?.name ? String(primary.name) : null,
    additionalCategoriesFull: additional
      .map(c => ({ name: String(c.name ?? ''), displayName: String(c.displayName ?? '') }))
      .filter(c => c.name && c.displayName),
    address: formatAddress(addr),
    city: addr?.locality ? String(addr.locality) : null,
    lat: latlng?.latitude != null ? Number(latlng.latitude) : null,
    lng: latlng?.longitude != null ? Number(latlng.longitude) : null,
    addressLines: Array.isArray(addr?.addressLines) ? (addr!.addressLines as unknown[]).map(String) : [],
    locality: addr?.locality ? String(addr.locality) : '',
    adminArea: addr?.administrativeArea ? String(addr.administrativeArea) : '',
    postalCode: addr?.postalCode ? String(addr.postalCode) : '',
    regionCode: addr?.regionCode ? String(addr.regionCode) : 'BR',
    phone: phones?.primaryPhone ? String(phones.primaryPhone) : null,
    website: l.websiteUri ? String(l.websiteUri) : null,
    description: profile?.description ? String(profile.description) : null,
    regularHours: periods.map(p => ({
      openDay: String(p.openDay ?? ''),
      openTime: fmtTime(p.openTime as Record<string, unknown> | undefined),
      closeDay: String(p.closeDay ?? ''),
      closeTime: fmtTime(p.closeTime as Record<string, unknown> | undefined),
    })),
  }
}

export type GbpLocationPatch = {
  title?: string
  phone?: string
  website?: string
  description?: string
}

// Atualiza apenas os campos fornecidos (updateMask com notação de ponto).
export async function updateLocationDetails(
  accessToken: string, locationName: string, patch: GbpLocationPatch,
): Promise<void> {
  const fields: string[] = []
  const body: Record<string, unknown> = {}
  if (patch.title !== undefined) { fields.push('title'); body.title = patch.title }
  if (patch.phone !== undefined) { fields.push('phoneNumbers.primaryPhone'); body.phoneNumbers = { primaryPhone: patch.phone } }
  if (patch.website !== undefined) { fields.push('websiteUri'); body.websiteUri = patch.website }
  if (patch.description !== undefined) { fields.push('profile.description'); body.profile = { description: patch.description } }
  if (fields.length === 0) return
  const url = `${BUSINESS_INFO}/${locationName}?updateMask=${encodeURIComponent(fields.join(','))}`
  await gpatch(url, accessToken, body)
}

export type GbpTimeOfDay = { hours: number; minutes: number }
export type GbpHoursPeriodInput = {
  openDay: string; openTime: GbpTimeOfDay; closeDay: string; closeTime: GbpTimeOfDay
}

// Atualiza os horários regulares (substitui todos). periods vazio = sem horários.
export async function updateLocationHours(
  accessToken: string, locationName: string, periods: GbpHoursPeriodInput[],
): Promise<void> {
  const url = `${BUSINESS_INFO}/${locationName}?updateMask=regularHours`
  await gpatch(url, accessToken, { regularHours: { periods } })
}

// ── Categorias ─────────────────────────────────────────────────────────────────

// Cache em memória da lista de categorias (BR). A API não tem busca por substring,
// então baixamos a lista uma vez e filtramos localmente.
let CAT_CACHE: GbpCategory[] | null = null
let CAT_AT = 0

async function loadCategories(accessToken: string): Promise<GbpCategory[]> {
  if (CAT_CACHE && Date.now() - CAT_AT < 24 * 3600e3) return CAT_CACHE
  const out: GbpCategory[] = []
  let pageToken = ''
  for (let i = 0; i < 12; i++) {
    const url = `${BUSINESS_INFO}/categories?regionCode=BR&languageCode=pt-BR&view=BASIC&pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`
    const data = (await gget(url, accessToken)) as Record<string, unknown>
    const cats = Array.isArray(data.categories) ? (data.categories as Record<string, unknown>[]) : []
    for (const c of cats) if (c.name && c.displayName) out.push({ name: String(c.name), displayName: String(c.displayName) })
    pageToken = data.nextPageToken ? String(data.nextPageToken) : ''
    if (!pageToken) break
  }
  CAT_CACHE = out; CAT_AT = Date.now()
  return out
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export async function searchCategories(accessToken: string, term: string): Promise<GbpCategory[]> {
  const t = norm(term.trim())
  if (t.length < 2) return []
  const all = await loadCategories(accessToken)
  return all.filter(c => norm(c.displayName).includes(t)).slice(0, 15)
}

// Atualiza categorias (substitui). primaryName obrigatório; additionalNames opcional.
export async function updateLocationCategories(
  accessToken: string, locationName: string, primaryName: string, additionalNames: string[],
): Promise<void> {
  const url = `${BUSINESS_INFO}/${locationName}?updateMask=categories`
  await gpatch(url, accessToken, {
    categories: {
      primaryCategory: { name: primaryName },
      additionalCategories: additionalNames.filter(Boolean).map(n => ({ name: n })),
    },
  })
}

export type GbpAddressInput = {
  regionCode: string; addressLines: string[]; locality: string; administrativeArea: string; postalCode: string
}

// Atualiza o endereço do local. Pode disparar reverificação do perfil no Google.
export async function updateLocationAddress(
  accessToken: string, locationName: string, address: GbpAddressInput,
): Promise<void> {
  const url = `${BUSINESS_INFO}/${locationName}?updateMask=storefrontAddress`
  await gpatch(url, accessToken, {
    storefrontAddress: {
      regionCode: address.regionCode || 'BR',
      languageCode: 'pt-BR',
      addressLines: address.addressLines.filter(Boolean),
      locality: address.locality,
      administrativeArea: address.administrativeArea,
      postalCode: address.postalCode,
    },
  })
}

// Lista todos os locais de todas as contas do usuário.
export async function listAllLocations(accessToken: string): Promise<GbpRemoteLocation[]> {
  const accounts = await listAccounts(accessToken)
  const all: GbpRemoteLocation[] = []
  for (const acc of accounts) {
    try {
      const locs = await listLocations(accessToken, acc.name)
      all.push(...locs)
    } catch (e) {
      if (e instanceof GoogleApiError && e.status === 403) throw e // sem acesso à API: propaga
      // outras contas com erro: ignora e segue
    }
  }
  return all
}
