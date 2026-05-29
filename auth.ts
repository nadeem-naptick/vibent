import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { verifyPassword } from '@/lib/auth/password';
import { authConfig } from './auth.config';

declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user'];
  }
}

// Surface a typed error code to the signin page so it can show the right
// banner ("invalid credentials" vs "verify your email").
export const AUTH_ERROR_UNVERIFIED = 'EMAIL_NOT_VERIFIED';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '').trim().toLowerCase();
        const password = String(credentials?.password ?? '');
        if (!email || !password) return null;

        const rows = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            passwordHash: users.passwordHash,
            emailVerified: users.emailVerified,
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        const user = rows[0];
        // Same response shape for wrong-email and wrong-password so an
        // attacker can't enumerate which emails are registered.
        if (!user || !user.passwordHash) return null;
        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        // Strict gate: must verify email before sign-in. We surface this
        // through a thrown error with a specific code so the signin page
        // can show a "Resend verification" banner instead of the generic
        // invalid-credentials message.
        if (!user.emailVerified) {
          throw new Error(AUTH_ERROR_UNVERIFIED);
        }

        return { id: user.id, name: user.name ?? user.email, email: user.email };
      },
    }),
  ],
});
