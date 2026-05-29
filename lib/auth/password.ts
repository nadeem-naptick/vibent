import bcrypt from 'bcryptjs';

// 12 rounds = ~250ms on a modern CPU. Slow enough to make offline brute
// force impractical while staying responsive on signin.
const BCRYPT_ROUNDS = 12;

const MIN_LENGTH = 8;

export type PasswordStrengthError =
  | { ok: true }
  | { ok: false; reason: string };

// Server-side validation; the form validates client-side too but never
// trust the client.
export function checkPasswordStrength(password: string): PasswordStrengthError {
  if (typeof password !== 'string') {
    return { ok: false, reason: 'Password is required.' };
  }
  if (password.length < MIN_LENGTH) {
    return { ok: false, reason: `Password must be at least ${MIN_LENGTH} characters.` };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { ok: false, reason: 'Password must contain a letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, reason: 'Password must contain a number.' };
  }
  return { ok: true };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
