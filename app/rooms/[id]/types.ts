import type { DetectedIntent, TranscriptSegment } from '@/lib/db/mongo';

export type RoomFeed = {
  transcripts: TranscriptSegment[];
  intents: DetectedIntent[];
};

// Data channel message envelope. We use a single topic ('agentic.feed') and
// discriminate by `kind` so other clients can apply the right reducer.
export type FeedMessage =
  | { kind: 'transcript'; payload: TranscriptSegment }
  | { kind: 'intent'; payload: DetectedIntent };

export const FEED_TOPIC = 'agentic.feed';
