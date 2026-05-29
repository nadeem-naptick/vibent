import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { createToken } from '@/lib/auth/tokens';
import { sendVerificationEmail } from '@/lib/auth/emails';

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Resend a verification email. Returns generic success regardless of
// whether the email exists or is already verified — same enumeration
// protection as /forgot.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();

  if (EMAIL_RX.test(email)) {
    const u = await db
      .select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Only do work if the user exists AND isn't already verified.
    if (u[0] && !u[0].emailVerified) {
      try {
        const rawToken = await createToken(email, 'email_verification');
        await sendVerificationEmail({ to: email, rawToken });
      } catch (err) {
        console.error('[resend-verification] send failed:', err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
