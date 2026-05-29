import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import {
  withDefaults,
  userPreferencesSchema,
} from '@/lib/user-preferences';

// GET /api/user/preferences
// Returns the signed-in user's preferences, fully populated with defaults.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const [row] = await db
    .select({ preferences: users.preferences, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({
    preferences: withDefaults(row.preferences),
    name: row.name,
    email: row.email,
  });
}

// POST /api/user/preferences
// Accepts a partial patch — only the keys present in the body are updated.
// Body may also include `name` to update the user's display name.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { preferences?: unknown; name?: unknown }
    | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  // Pull current value so we can merge against it (lets the client send only
  // the keys that changed without nuking everything else).
  const [row] = await db
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const current = withDefaults(row.preferences);
  const merged = userPreferencesSchema.safeParse({
    ...current,
    ...(body.preferences && typeof body.preferences === 'object' ? body.preferences : {}),
  });
  if (!merged.success) {
    return NextResponse.json(
      { error: 'invalid preferences', issues: merged.error.flatten() },
      { status: 400 },
    );
  }

  // Display name update — light validation. Email is intentionally not
  // editable here; that's a separate flow (would need re-verification).
  const update: Record<string, unknown> = { preferences: merged.data };
  if (typeof body.name === 'string') {
    const trimmed = body.name.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      return NextResponse.json({ error: 'invalid name' }, { status: 400 });
    }
    update.name = trimmed;
  }

  await db.update(users).set(update).where(eq(users.id, session.user.id));

  return NextResponse.json({ ok: true, preferences: merged.data });
}
