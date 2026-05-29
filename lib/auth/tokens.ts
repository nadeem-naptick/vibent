import crypto from 'crypto';
import { and, eq, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { verificationTokens } from '@/lib/db/schema';

export type TokenType = 'email_verification' | 'password_reset';

// 32 bytes (256 bits) of entropy. Encoded as URL-safe base64 so it can sit
// in a query string without escaping.
const TOKEN_BYTES = 32;

const EXPIRY_MS: Record<TokenType, number> = {
  email_verification: 24 * 60 * 60 * 1000, // 24h
  password_reset: 60 * 60 * 1000,          // 1h
};

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Create + persist a token, return the RAW token to put in the email link.
// The DB only sees the SHA-256 hash — a leaked DB dump can't be used to
// forge active links.
export async function createToken(
  email: string,
  type: TokenType,
): Promise<string> {
  const raw = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
  const tokenHash = hashToken(raw);
  const expires = new Date(Date.now() + EXPIRY_MS[type]);

  // Drop any existing tokens of the same type for this email — only one
  // valid link at a time, so resending a verification email invalidates
  // the previous one.
  await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.type, type),
      ),
    );

  await db.insert(verificationTokens).values({
    identifier: email,
    token: tokenHash,
    type,
    expires,
  });

  return raw;
}

// Single-use consumption — verifies + deletes in one transaction. Returns
// the email if the token is valid, null otherwise.
export async function consumeToken(
  raw: string,
  type: TokenType,
): Promise<string | null> {
  if (!raw || typeof raw !== 'string') return null;
  const tokenHash = hashToken(raw);

  const rows = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.token, tokenHash),
        eq(verificationTokens.type, type),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.expires.getTime() < Date.now()) {
    // Expired — clean up and reject.
    await db
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.token, tokenHash),
          eq(verificationTokens.type, type),
        ),
      );
    return null;
  }

  // Single-use guarantee — delete before returning.
  await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.token, tokenHash),
        eq(verificationTokens.type, type),
      ),
    );

  return row.identifier;
}

// Periodic cleanup — call from a cron or on app startup. Safe to call
// repeatedly.
export async function purgeExpiredTokens(): Promise<number> {
  const res = await db
    .delete(verificationTokens)
    .where(lt(verificationTokens.expires, new Date()))
    .returning({ token: verificationTokens.token });
  return res.length;
}
