import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { consumeToken } from '@/lib/auth/tokens';

// GET so the link in the email can be opened directly. We redirect to a
// status page that tells the user what happened.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  const base = process.env.NEXTAUTH_URL ?? 'http://localhost:5173';

  if (!token) {
    return NextResponse.redirect(`${base}/verify-email/status?status=missing`);
  }

  const email = await consumeToken(token, 'email_verification');
  if (!email) {
    return NextResponse.redirect(`${base}/verify-email/status?status=invalid`);
  }

  await db
    .update(users)
    .set({ emailVerified: new Date() })
    .where(eq(users.email, email));

  return NextResponse.redirect(`${base}/verify-email/status?status=ok`);
}
