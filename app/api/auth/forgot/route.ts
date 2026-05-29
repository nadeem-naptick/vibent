import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { createToken } from '@/lib/auth/tokens';
import { sendPasswordResetEmail } from '@/lib/auth/emails';

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Always returns success so attackers can't enumerate which emails exist
// in our database.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();

  if (EMAIL_RX.test(email)) {
    const u = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (u[0]) {
      try {
        const rawToken = await createToken(email, 'password_reset');
        await sendPasswordResetEmail({ to: email, rawToken });
      } catch (err) {
        console.error('[forgot] send failed:', err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
