import { z } from 'zod'

const AUTHORIZE_URL = 'https://oauth.yandex.ru/authorize'
const TOKEN_URL = 'https://oauth.yandex.ru/token'
const USER_INFO_URL = 'https://login.yandex.ru/info?format=json'

export interface YandexCredentials {
  clientId: string
  clientSecret: string
}

export function buildAuthorizeUrl(creds: YandexCredentials, redirectUri: string, state: string): string {
  const url = new URL(AUTHORIZE_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', creds.clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  return url.toString()
}

const tokenResponseSchema = z.object({ access_token: z.string().min(1) })

const userInfoSchema = z.object({
  id: z.string().min(1),
  login: z.string().optional(),
  display_name: z.string().optional(),
  real_name: z.string().optional(),
  default_email: z.string().optional(),
  default_avatar_id: z.string().optional(),
  is_avatar_empty: z.boolean().optional(),
})

export interface YandexProfile {
  id: string
  name: string | null
  email: string | null
  image: string | null
}

/** Обменивает code на токен и загружает профиль пользователя */
export async function fetchYandexProfile(creds: YandexCredentials, code: string): Promise<YandexProfile> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!tokenRes.ok) throw new Error(`Yandex token exchange failed: ${tokenRes.status}`)
  const { access_token } = tokenResponseSchema.parse(await tokenRes.json())

  const infoRes = await fetch(USER_INFO_URL, {
    headers: { Authorization: `OAuth ${access_token}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!infoRes.ok) throw new Error(`Yandex user info failed: ${infoRes.status}`)
  const info = userInfoSchema.parse(await infoRes.json())

  return {
    id: info.id,
    name: info.display_name || info.real_name || info.login || null,
    email: info.default_email ?? null,
    image:
      info.default_avatar_id && !info.is_avatar_empty
        ? `https://avatars.yandex.net/get-yapic/${info.default_avatar_id}/islands-200`
        : null,
  }
}
