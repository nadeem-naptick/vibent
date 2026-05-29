import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { verifyPassword } from '@/lib/auth/password';

// Pre-flight credential check so the signin UI can distinguish:
//   - invalid:    wrong email or wrong password (same response — no leak)
//   - unverified: correct creds, but email not verified yet
//   - ok:         correct creds, verified — safe to call signIn()
//
// Why: NextAuth v5 throws-then-collapses authorize() errors into a generic
// "CredentialsSignin" code by the time they reach the client, so we can't
// distinguish "wrong password" from "unverified email" through it. This
// endpoint runs the same logic before the signIn() handshake.
//
// Timing safety: even when the user doesn't exist we still run a bcrypt
// compare against a dummy hash so the response time doesn't leak whether
// the email exists.
const DUMMY_HASH = '$2a$12$0000000000000000000000000000000000000000000000000000';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');

  if (!email || !password) {
    return NextResponse.json({ status: 'invalid' });
  }

  const rows = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = rows[0];
  if (!user || !user.passwordHash) {
    // Burn time so we don't leak existence by responding faster.
    await verifyPassword(password, DUMMY_HASH).catch(() => false);
    return NextResponse.json({ status: 'invalid' });
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    return NextResponse.json({ status: 'invalid' });
  }

  if (!user.emailVerified) {
    return NextResponse.json({ status: 'unverified' });
  }

  return NextResponse.json({ status: 'ok' });
}
