import { MongoClient, type Collection, type Db } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'agentic_room';

const options = {
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

declare global {
  // eslint-disable-next-line no-var
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  if (!global.__mongoClientPromise) {
    const client = new MongoClient(uri, options);
    global.__mongoClientPromise = client.connect();
  }
  return global.__mongoClientPromise;
}

export async function getMongoDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(dbName);
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export type TranscriptSegment = {
  _id?: string;
  id: string;            // client-generated id (nanoid) so the publisher can de-dupe
  roomId: string;
  speakerId: string;     // LiveKit participant identity
  speakerName: string;
  text: string;
  isFinal: boolean;      // false for interim Deepgram results
  startMs: number;       // ms since room start
  endMs: number;
  createdAt: Date;
};

export type IntentType =
  | 'idea'
  | 'question'
  | 'decision'
  | 'instruction'
  | 'correction'
  | 'rejected_idea'
  | 'open_question'
  | 'constraint'
  | 'action_item'
  | 'reference'
  | 'approved_execution_task'
  | 'noise';

export type IntentStatus =
  | 'pending_approval'
  | 'approved'
  | 'ignored'
  | 'applied'
  | 'noted';

export type DetectedIntent = {
  _id?: string;
  id: string;            // nanoid
  roomId: string;
  type: IntentType;
  status: IntentStatus;
  confidence: number;    // 0..1
  summary: string;       // short, action-oriented summary of the intent
  rawText: string;       // the original utterance(s) it was derived from
  sourceTranscriptIds: string[];
  speakerId: string;
  speakerName: string;
  shouldExecute: boolean;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;   // userId of host who acted on it
};

export async function getTranscriptsCollection(): Promise<Collection<TranscriptSegment>> {
  const db = await getMongoDb();
  return db.collection<TranscriptSegment>('transcripts');
}

export async function getIntentsCollection(): Promise<Collection<DetectedIntent>> {
  const db = await getMongoDb();
  return db.collection<DetectedIntent>('intents');
}

// Idempotent index setup. Call once on first use per process.
let indexesEnsured = false;
export async function ensureIndexes() {
  if (indexesEnsured) return;
  const transcripts = await getTranscriptsCollection();
  const intents = await getIntentsCollection();

  await Promise.all([
    transcripts.createIndex({ roomId: 1, createdAt: 1 }),
    transcripts.createIndex({ id: 1 }, { unique: true }),
    intents.createIndex({ roomId: 1, createdAt: -1 }),
    intents.createIndex({ id: 1 }, { unique: true }),
    intents.createIndex({ roomId: 1, status: 1 }),
  ]);
  indexesEnsured = true;
}
