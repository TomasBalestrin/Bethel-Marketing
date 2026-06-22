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
