import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { authConfig } from './auth.config';

declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user'];
  }
}

const DEV_EMAIL_DOMAIN = 'local.dev';

function deriveEmail(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug || 'guest'}@${DEV_EMAIL_DOMAIN}`;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'Name',
      credentials: {
        name: { label: 'Your name', type: 'text', placeholder: 'Nadeem' },
      },
      async authorize(credentials) {
        const name = String(credentials?.name ?? '').trim();
        if (name.length < 2) return null;

        const email = deriveEmail(name);
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        let user = existing[0];
        if (!user) {
          const inserted = await db
            .insert(users)
            .values({ name, email })
            .returning();
          user = inserted[0];
        }

        return { id: user.id, name: user.name ?? name, email: user.email };
      },
    }),
  ],
});
