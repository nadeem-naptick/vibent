import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

// A snapshot is a JSON document describing every text file in the project at
// a moment in time. Binary assets are skipped for now (Vite React templates
// rarely have meaningful binary content during a working session).
export type Snapshot = {
  version: 1;
  files: { path: string; content: string }[];
  meta: {
    capturedAt: string;
    fileCount: number;
    totalBytes: number;
  };
};

// Pluggable storage so we can swap LocalDisk for S3 without touching callers.
// `save()` returns an opaque path-like identifier. For local disk this is the
// absolute file path; for S3 it's `s3://bucket/key`. The DB stores whichever
// string `save()` returns and passes it back to `load()` / `delete()`.
export interface SnapshotStore {
  save(roomId: string, versionId: string, snapshot: Snapshot): Promise<string>;
  load(snapshotPath: string): Promise<Snapshot>;
  delete(snapshotPath: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Local-disk implementation for dev fallback. Writes to ~/.agentic-snapshots.
// ---------------------------------------------------------------------------

class LocalDiskStore implements SnapshotStore {
  private root: string;

  constructor(root?: string) {
    this.root =
      root ?? process.env.SNAPSHOT_DIR ?? path.join(os.homedir(), '.agentic-snapshots');
  }

  async save(roomId: string, versionId: string, snapshot: Snapshot) {
    const dir = path.join(this.root, roomId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${versionId}.json`);
    await fs.writeFile(filePath, JSON.stringify(snapshot), 'utf8');
    return filePath;
  }

  async load(snapshotPath: string) {
    const raw = await fs.readFile(snapshotPath, 'utf8');
    return JSON.parse(raw) as Snapshot;
  }

  async delete(snapshotPath: string) {
    try {
      await fs.unlink(snapshotPath);
    } catch (err) {
      // File already gone — fine.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// S3-backed implementation. Same bucket works for local dev and prod — local
// uses the default AWS credential chain (env vars / ~/.aws/credentials);
// prod uses the EC2 instance role.
//
// Object key layout: <prefix>/<roomId>/<versionId>.json
// snapshotPath written to DB: s3://<bucket>/<key>
// ---------------------------------------------------------------------------

class S3Store implements SnapshotStore {
  private client: S3Client;
  private bucket: string;
  private prefix: string;

  constructor(opts: { bucket: string; region?: string; prefix?: string }) {
    this.bucket = opts.bucket;
    this.prefix = (opts.prefix ?? '').replace(/^\/+|\/+$/g, '');
    this.client = new S3Client({
      region: opts.region ?? process.env.AWS_REGION ?? 'ap-south-1',
      // Credentials come from the default chain: env vars, ~/.aws/credentials,
      // or the EC2 instance role in prod. Don't pass them explicitly here.
    });
  }

  private keyFor(roomId: string, versionId: string) {
    const parts = [this.prefix, roomId, `${versionId}.json`].filter(Boolean);
    return parts.join('/');
  }

  private parsePath(snapshotPath: string): { bucket: string; key: string } {
    // Accept s3://bucket/key form. Legacy local paths get rejected — callers
    // should migrate or fall through to LocalDiskStore.
    const m = snapshotPath.match(/^s3:\/\/([^/]+)\/(.+)$/);
    if (!m) {
      throw new Error(`Not an S3 snapshot path: ${snapshotPath}`);
    }
    return { bucket: m[1], key: m[2] };
  }

  async save(roomId: string, versionId: string, snapshot: Snapshot) {
    const key = this.keyFor(roomId, versionId);
    const body = JSON.stringify(snapshot);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: 'application/json',
      }),
    );
    return `s3://${this.bucket}/${key}`;
  }

  async load(snapshotPath: string) {
    const { bucket, key } = this.parsePath(snapshotPath);
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    // Body is a stream in the SDK v3; transformToString() is the convenience.
    const text = await res.Body!.transformToString('utf-8');
    return JSON.parse(text) as Snapshot;
  }

  async delete(snapshotPath: string) {
    const { bucket, key } = this.parsePath(snapshotPath);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key }),
    );
  }
}

// ---------------------------------------------------------------------------
// Selector — picks the store based on env. Defaults to S3 if SNAPSHOT_BUCKET
// is set (works in both local dev and prod), falls back to local disk.
// ---------------------------------------------------------------------------

let _store: SnapshotStore | null = null;

export function snapshotStore(): SnapshotStore {
  if (_store) return _store;
  const bucket = process.env.SNAPSHOT_BUCKET;
  const driver = process.env.SNAPSHOT_STORE; // 'local' | 's3' | undefined
  if (driver === 'local') {
    _store = new LocalDiskStore();
  } else if (driver === 's3' || (bucket && driver !== 'local')) {
    if (!bucket) {
      throw new Error('SNAPSHOT_STORE=s3 requires SNAPSHOT_BUCKET env var');
    }
    _store = new S3Store({
      bucket,
      region: process.env.AWS_REGION,
      prefix: process.env.SNAPSHOT_PREFIX || 'snapshots',
    });
  } else {
    _store = new LocalDiskStore();
  }
  return _store;
}

// For tests
export function _resetSnapshotStore() {
  _store = null;
}
