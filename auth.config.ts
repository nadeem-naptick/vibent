import type { NextAuthConfig } from 'next-auth';

const PROTECTED_PREFIXES = ['/dashboard', '/rooms'];

export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/signin' },
  callbacks: {
    async authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected = PROTECTED_PREFIXES.some((p) =>
        nextUrl.pathname.startsWith(p),
      );
      if (isProtected && !isLoggedIn) return false;
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token?.id) session.user.id = token.id as string;
      return session;
    },
  },
  // Providers live in `auth.ts` — they import the DB which can't run on Edge.
  providers: [],
} satisfies NextAuthConfig;
