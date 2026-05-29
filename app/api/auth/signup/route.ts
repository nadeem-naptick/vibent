import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { checkPasswordStrength, hashPassword } from '@/lib/auth/password';
import { createToken } from '@/lib/auth/tokens';
import { sendVerificationEmail } from '@/lib/auth/emails';

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  // Validation — fail fast with specific messages on input shape, but
  // generic messages on existence checks (enumeration protection).
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 });
  }
  if (!EMAIL_RX.test(email) || email.length > 200) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }
  const strength = checkPasswordStrength(password);
  if (!strength.ok) {
    return NextResponse.json({ error: strength.reason }, { status: 400 });
  }

  // Existence check — for B2B email/password we DO surface "already
  // registered" because users genuinely need to know to use sign-in
  // instead. The signup form is the only place this leaks.
  const existing = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing[0]) {
    return NextResponse.json(
      { error: 'An account with this email already exists. Try signing in.' },
      { status: 409 },
    );
  }

  // Create + send verification email.
  const passwordHash = await hashPassword(password);
  await db.insert(users).values({
    name,
    email,
    passwordHash,
    // emailVerified stays null until they click the link.
  });

  let emailSent = true;
  let emailError: string | undefined;
  try {
    const rawToken = await createToken(email, 'email_verification');
    await sendVerificationEmail({ to: email, rawToken });
  } catch (err) {
    emailSent = false;
    // Pull the most useful error string we can — Resend SDK throws errors
    // whose .message often has the underlying status. JSON-stringify the
    // full thing in dev so we can see Resend's response shape.
    emailError =
      err instanceof Error ? err.message : String(err);
    console.error(
      '[signup] failed to send verification email:',
      JSON.stringify(err, Object.getOwnPropertyNames(err as object)),
    );
  }

  // Account is created either way. Surface emailSent so the UI can show a
  // clear message when delivery failed (e.g. Resend sandbox restriction
  // until a domain is verified).
  return NextResponse.json(
    { ok: true, email, emailSent, emailError },
    { status: 201 },
  );
}
