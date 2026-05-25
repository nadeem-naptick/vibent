import {
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { nanoid } from 'nanoid';
import type { AdapterAccountType } from 'next-auth/adapters';

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

export const verificationTokens = pgTable(
  'verificationTokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
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

export const rooms = pgTable('rooms', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid(12)),
  title: text('title').notNull(),
  objective: roomObjectiveEnum('objective').notNull(),
  outputType: roomOutputTypeEnum('output_type').notNull(),
  templateId: text('template_id'),
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
