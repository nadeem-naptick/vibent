import type { DetectedIntent, TranscriptSegment } from '@/lib/db/mongo';
import type { TaskEvent } from '@/lib/db/schema';

export type LiveTask = {
  id: string;
  intentId: string | null;
  sourceIntentIds?: string[] | null;
  instruction: string;
  status: 'queued' | 'running' | 'complete' | 'failed' | 'cancelled';
  model?: string | null;
  summary?: string | null;
  error?: string | null;
  events: TaskEvent[];
  createdAt: string; // ISO from server
  startedAt?: string | null;
  completedAt?: string | null;
};

export type RoomFeed = {
  transcripts: TranscriptSegment[];
  intents: DetectedIntent[];
  tasks?: LiveTask[];
};

// Data channel message envelope. Single topic, discriminated by `kind`.
export type FeedMessage =
  | { kind: 'transcript'; payload: TranscriptSegment }
  | { kind: 'intent'; payload: DetectedIntent }
  | {
      kind: 'task_started';
      payload: {
        taskId: string;
        intentId: string | null;
        instruction: string;
        model: string;
      };
    }
  | {
      kind: 'task_event';
      payload: { taskId: string; event: TaskEvent };
    }
  | {
      kind: 'task_complete';
      payload: { taskId: string; intentId: string | null; summary: string | null };
    }
  | {
      kind: 'task_failed';
      payload: { taskId: string; intentId: string | null; error: string };
    };

export const FEED_TOPIC = 'agentic.feed';
