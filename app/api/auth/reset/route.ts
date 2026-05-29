import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { checkPasswordStrength, hashPassword } from '@/lib/auth/password';
import { consumeToken } from '@/lib/auth/tokens';
import { sendPasswordChangedEmail } from '@/lib/auth/emails';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? '');
  const password = String(body?.password ?? '');

  if (!token) {
    return NextResponse.json({ error: 'Missing or invalid token.' }, { status: 400 });
  }

  const strength = checkPasswordStrength(password);
  if (!strength.ok) {
    return NextResponse.json({ error: strength.reason }, { status: 400 });
  }

  const email = await consumeToken(token, 'password_reset');
  if (!email) {
    return NextResponse.json(
      { error: 'This reset link is invalid or has expired. Request a new one.' },
      { status: 400 },
    );
  }

  const newHash = await hashPassword(password);
  await db
    .update(users)
    .set({
      passwordHash: newHash,
      // If the account was unverified, completing a password reset proves
      // they control the inbox — verify the email too.
      emailVerified: new Date(),
    })
    .where(eq(users.email, email));

  // Notify the user (best effort).
  try {
    await sendPasswordChangedEmail({ to: email });
  } catch (err) {
    console.error('[reset] notification email failed:', err);
  }

  return NextResponse.json({ ok: true, email });
}
