import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db/prisma';
import { isGoogleOAuthConfigured } from '@/lib/env';
import { logger } from '@/lib/logger';
import { RATE_LIMITS, consumeRateLimit } from '@/lib/rate-limit';
import { emailSchema, verifyPassword } from './password';

/**
 * Auth.js configuration.
 *
 * Session strategy is JWT: credentials sign-in requires it, and it keeps route
 * handlers free of a database round-trip just to read the viewer's id. The
 * Prisma adapter is still wired so Google accounts persist properly when the
 * provider is configured.
 */

const providers: NextAuthConfig['providers'] = [
  Credentials({
    id: 'credentials',
    name: 'E-mail',
    credentials: {
      email: { label: 'E-mail', type: 'email' },
      password: { label: 'Mot de passe', type: 'password' },
    },
    async authorize(raw) {
      const email = emailSchema.safeParse(raw?.email);
      const password = typeof raw?.password === 'string' ? raw.password : '';
      if (!email.success || password.length === 0) return null;

      // Brute-force protection is keyed on the account being attacked, so it
      // survives an attacker rotating IP addresses.
      const limit = await consumeRateLimit(RATE_LIMITS.login, `email:${email.data}`);
      if (!limit.allowed) {
        logger.warn('auth.login.rate_limited', { retryAfterSeconds: limit.retryAfterSeconds });
        throw new Error('RATE_LIMITED');
      }

      const user = await prisma.user.findUnique({
        where: { email: email.data },
        select: { id: true, email: true, name: true, image: true, passwordHash: true },
      });

      const valid = await verifyPassword(password, user?.passwordHash ?? null);
      if (!user || !valid) {
        logger.info('auth.login.failed', { reason: user ? 'bad_password' : 'unknown_email' });
        return null;
      }

      logger.info('auth.login.succeeded', { userId: user.id });
      return { id: user.id, email: user.email, name: user.name, image: user.image };
    },
  }),
];

if (isGoogleOAuthConfigured()) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: false,
    }),
  );
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  // Read, never demanded, at module scope: `next build` imports this file to
  // collect route metadata, and a build must not require production secrets.
  // A production boot without AUTH_SECRET is caught by `instrumentation.ts`,
  // and Auth.js itself refuses to sign a session without one.
  secret:
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === 'production' ? undefined : 'development-only-secret'),
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  pages: {
    signIn: '/connexion',
    error: '/connexion',
  },
  providers,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
