import { getServerSession, type NextAuthOptions } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import YandexProvider from 'next-auth/providers/yandex'
import { db } from '@/lib/db'
import { ensureDemoUser } from '@/lib/seed'

const yandexId = process.env.YANDEX_CLIENT_ID
const yandexSecret = process.env.YANDEX_CLIENT_SECRET

export const isYandexConfigured = Boolean(yandexId && yandexSecret)

// Панель предпросмотра открывает приложение в кросс-доменном iframe.
// Куки с SameSite=Lax в таком iframe не отправляются — вход падает с CSRF-ошибкой.
// Поэтому для https (внешний домен предпросмотра) используем SameSite=None.
const secureCookies = (process.env.NEXTAUTH_URL ?? '').startsWith('https://')
const cookiePrefix = secureCookies ? '__Secure-' : ''
const cookieSameSite = secureCookies ? ('none' as const) : ('lax' as const)

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET ?? 'lifebalance-dev-secret-change-me',
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: { httpOnly: true, sameSite: cookieSameSite, path: '/', secure: secureCookies },
    },
    callbackUrl: {
      name: `${cookiePrefix}next-auth.callback-url`,
      options: { httpOnly: true, sameSite: cookieSameSite, path: '/', secure: secureCookies },
    },
    csrfToken: {
      name: `${secureCookies ? '__Host-' : ''}next-auth.csrf-token`,
      options: { httpOnly: true, sameSite: cookieSameSite, path: '/', secure: secureCookies },
    },
    pkceCodeVerifier: {
      name: `${cookiePrefix}next-auth.pkce.code_verifier`,
      options: { httpOnly: true, sameSite: cookieSameSite, path: '/', secure: secureCookies, maxAge: 60 * 15 },
    },
    state: {
      name: `${cookiePrefix}next-auth.state`,
      options: { httpOnly: true, sameSite: cookieSameSite, path: '/', secure: secureCookies, maxAge: 60 * 15 },
    },
    nonce: {
      name: `${cookiePrefix}next-auth.nonce`,
      options: { httpOnly: true, sameSite: cookieSameSite, path: '/', secure: secureCookies },
    },
  },
  providers: [
    // Яндекс ID OAuth — подключается автоматически при наличии ключей в .env
    ...(isYandexConfigured && yandexId && yandexSecret
      ? [
          YandexProvider({
            clientId: yandexId,
            clientSecret: yandexSecret,
          }),
        ]
      : []),
    // Демо-вход для предпросмотра без настройки Яндекс-приложения
    Credentials({
      id: 'demo',
      name: 'Демо-вход',
      credentials: {
        name: { label: 'Имя', type: 'text', placeholder: 'Ваше имя (необязательно)' },
      },
      async authorize(credentials) {
        const name = typeof credentials?.name === 'string' ? credentials.name.trim() : ''
        const user = await ensureDemoUser(name || null)
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: null,
          image: null,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Для Яндекс-входа создаём пользователя в БД при первом входе
      if (account?.provider === 'yandex' && user.email) {
        const existing = await db.user.findUnique({ where: { email: user.email } })
        if (!existing) {
          await db.user.create({
            data: {
              email: user.email,
              name: user.name ?? 'Пользователь Яндекса',
              image: user.image ?? null,
            },
          })
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === 'demo') {
          // authorize() вернул id пользователя из нашей БД
          token.uid = user.id
        } else if (user.email) {
          // OAuth-вход: сопоставляем по email
          const dbUser = await db.user.findUnique({ where: { email: user.email } })
          if (dbUser) token.uid = dbUser.id
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        session.user.id = String(token.uid)
      }
      return session
    },
  },
}

export async function getAuthSession() {
  return getServerSession(authOptions)
}

export async function getSessionUserId(): Promise<string | null> {
  const session = await getAuthSession()
  return session?.user?.id ?? null
}
