import { z } from 'zod';

// Single source of truth for per-user preferences. Stored as jsonb on the
// users table; merged with DEFAULTS at read time so old rows with missing
// keys behave like brand-new rows.

const CAPTURE_STATES = ['listening', 'paused'] as const;

// 0 = never auto-pause. Otherwise minutes.
const IDLE_MINUTES_CHOICES = [0, 3, 5, 10, 15] as const;

export const userPreferencesSchema = z
  .object({
    // What captureState should new rooms this user creates default to?
    //   listening — room starts capturing the moment people join (default)
    //   paused    — room starts off the record; host clicks Vibe on when ready
    defaultCaptureState: z.enum(CAPTURE_STATES).default('listening'),

    // Minutes of silence before capture auto-pauses. 0 = disabled.
    idleAutoPauseMinutes: z
      .number()
      .int()
      .min(0)
      .max(60)
      .default(5),

    // How many intents to pool before the composer auto-fires a decision.
    // Mirrors the in-room threshold in useSettings but is per-user, so it
    // carries across browsers and seeds the localStorage default.
    autoComposeThreshold: z.number().int().min(3).max(20).default(7),
  })
  .strip(); // drop unknown keys so junk in the DB doesn't trip later reads

export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export const DEFAULT_PREFERENCES: UserPreferences = userPreferencesSchema.parse({});

export const IDLE_MINUTES_OPTIONS = IDLE_MINUTES_CHOICES;

// Reads from a potentially-null jsonb value and returns a fully-populated
// object with defaults filled in. Safe to call on rows where the column
// is null (older accounts) or partially populated.
export function withDefaults(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== 'object') return DEFAULT_PREFERENCES;
  const parsed = userPreferencesSchema.safeParse(raw);
  return parsed.success
    ? parsed.data
    : userPreferencesSchema.parse({ ...DEFAULT_PREFERENCES, ...raw });
}
