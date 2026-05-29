import {
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
  jsonb,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { nanoid } from 'nanoid';
import type { AdapterAccountType } from 'next-auth/adapters';
import type { UserPreferences } from '@/lib/user-preferences';

// ---------------------------------------------------------------------------
// Auth.js v5 tables (shape required by @auth/drizzle-adapter)
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  // bcrypt hash of the user's password. Nullable for back-compat with
  // existing accounts created via the dev name-only flow; new accounts
  // through email/password signup always have one.
  passwordHash: text('password_hash'),
  // Per-user app preferences (default room behavior, idle thresholds, etc.).
  // Shape is enforced by Zod at the boundary — see lib/user-preferences.ts.
  // Stored as jsonb so new keys can be added without migrations. The type
  // is Partial<> so a literal {} default is legal; reads pass through
  // withDefaults() to fill in missing keys.
  preferences: jsonb('preferences').$type<Partial<UserPreferences>>().default({}),
});

export const accounts = pgTable(
  'accounts',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable('sessions', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

// Token purposes — keeps verification + reset on the same table without
// confusing the two. We always look up by (token hash, type) and delete on
// use so a single-use guarantee is enforced.
export const tokenTypeEnum = pgEnum('verification_token_type', [
  'email_verification',
  'password_reset',
]);

export const verificationTokens = pgTable(
  'verificationTokens',
  {
    identifier: text('identifier').notNull(), // user email
    // SHA-256 hash of the raw token. The raw token is in the email link;
    // the DB only stores the hash so a leaked DB dump can't be used to
    // forge active links.
    token: text('token').notNull(),
    type: tokenTypeEnum('type').notNull().default('email_verification'),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ---------------------------------------------------------------------------
// Agentic Room domain tables
// ---------------------------------------------------------------------------

export const roomObjectiveEnum = pgEnum('room_objective', [
  'landing_page',
  'mobile_app_flow',
  'product_concept',
  'website',
  'customer_journey',
  'ux_copy',
  'business_solution',
]);

export const roomOutputTypeEnum = pgEnum('room_output_type', [
  'react_landing_page',
  'react_website',
  'react_mobile_screens',
  'react_dashboard',
  'react_product_flow',
  'html_static',
]);

export const roomStatusEnum = pgEnum('room_status', [
  'provisioning',
  'active',
  'archived',
  'error',
]);

export const participantRoleEnum = pgEnum('participant_role', [
  'host',
  'collaborator',
  'viewer',
  'agent',
]);

export const taskStatusEnum = pgEnum('task_status', [
  'queued',
  'running',
  'complete',
  'failed',
  'cancelled',
]);

// Host-controlled toggle: 'listening' streams mic→Deepgram + drives the
// intent/decision/task pipeline; 'paused' closes the Deepgram WS so no new
// transcripts enter. Anything already queued (decisions awaiting approval,
// running tasks) keeps flowing — only new mic capture stops.
export const roomCaptureStateEnum = pgEnum('room_capture_state', [
  'listening',
  'paused',
]);

export const rooms = pgTable('rooms', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid(12)),
  title: text('title').notNull(),
  // Legacy enum context — kept nullable for back-compat. New rooms drive
  // artifact decisions entirely off templateId + instructions instead.
  objective: roomObjectiveEnum('objective'),
  outputType: roomOutputTypeEnum('output_type'),
  templateId: text('template_id'),
  // Optional free-form instructions the host writes at creation time.
  // Appended to the executor's system prompt for the first task.
  instructions: text('instructions'),
  hostUserId: text('host_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: roomStatusEnum('status').notNull().default('provisioning'),
  // Sandbox provisioning details — populated when the per-room workspace boots
  sandboxId: text('sandbox_id'),
  sandboxUrl: text('sandbox_url'),
  // Free-form context the host supplies at room creation (audience, tone,
  // brand colors, reference links, problem statement, etc.)
  context: jsonb('context').$type<RoomContext>().default({}),
  // Host-controlled mic capture state — see roomCaptureStateEnum.
  captureState: roomCaptureStateEnum('capture_state').notNull().default('listening'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  archivedAt: timestamp('archived_at', { mode: 'date' }),
});

export type TaskEvent = {
  ts: number;
  kind: 'text' | 'tool_call' | 'tool_result' | 'error';
  toolName?: string;
  text?: string;
  data?: unknown;
};

export const tasks = pgTable('tasks', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  roomId: text('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  // Legacy single-intent linkage from the auto-approve flow. New compose
  // flow uses sourceIntentIds (jsonb) so one task can be built from many.
  intentId: text('intent_id'),
  sourceIntentIds: jsonb('source_intent_ids').$type<string[]>().default([]),
  instruction: text('instruction').notNull(),
  status: taskStatusEnum('status').notNull().default('queued'),
  summary: text('summary'),
  model: text('model'),
  // Per-task thinking mode toggle. When true, the executing agent uses
  // extended reasoning (slower, deeper). When false, it runs in fast mode.
  thinkingMode: integer('thinking_mode').notNull().default(1),
  events: jsonb('events').$type<TaskEvent[]>().default([]),
  error: text('error'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { mode: 'date' }),
  completedAt: timestamp('completed_at', { mode: 'date' }),
});

export const participants = pgTable('participants', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  roomId: text('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  displayName: text('display_name').notNull(),
  role: participantRoleEnum('role').notNull(),
  livekitIdentity: text('livekit_identity').notNull(),
  joinedAt: timestamp('joined_at', { mode: 'date' }).notNull().defaultNow(),
  leftAt: timestamp('left_at', { mode: 'date' }),
});

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type RoomContext = {
  companyName?: string;
  productDescription?: string;
  audience?: string;
  problemStatement?: string;
  brandColors?: string[];
  tone?: string;
  referenceLinks?: string[];
  existingCopy?: string;
  additionalNotes?: string;
};

export type User = typeof users.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type Participant = typeof participants.$inferSelect;
export type NewParticipant = typeof participants.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

// ---------------------------------------------------------------------------
// Versions — point-in-time snapshots of the sandbox project files
// ---------------------------------------------------------------------------

export const versions = pgTable('versions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  roomId: text('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  // Per-room sequential number — v0 is the initial template snapshot.
  versionNumber: integer('version_number').notNull(),
  // Source task that produced this version. NULL for v0 and for rollbacks.
  taskId: text('task_id'),
  // For rollbacks: which version this one was rolled back FROM.
  rolledBackFromVersionId: text('rolled_back_from_version_id'),
  summary: text('summary').notNull(),
  snapshotPath: text('snapshot_path').notNull(),
  fileCount: integer('file_count').notNull().default(0),
  totalBytes: integer('total_bytes').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

export type Version = typeof versions.$inferSelect;
export type NewVersion = typeof versions.$inferInsert;

// ---------------------------------------------------------------------------
// Shares — public, externally-shareable URLs to a built snapshot of the room
// at a moment in time. Each share is its own immutable build pushed to S3.
// ---------------------------------------------------------------------------

export const shares = pgTable('shares', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  // URL-safe slug used in the public share URL.
  slug: text('slug').notNull().unique(),
  roomId: text('room_id')
    .notNull()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  // Source version this share was built from. Nullable so a share can be
  // created from the live sandbox before a version is persisted.
  versionId: text('version_id'),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  // S3 key prefix (bucket comes from env), e.g. "shares/abc123/".
  s3Prefix: text('s3_prefix').notNull(),
  fileCount: integer('file_count').notNull(),
  totalBytes: integer('total_bytes').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

export type Share = typeof shares.$inferSelect;
export type NewShare = typeof shares.$inferInsert;
