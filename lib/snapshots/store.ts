import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

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
export interface SnapshotStore {
  save(roomId: string, versionId: string, snapshot: Snapshot): Promise<string>;
  load(snapshotPath: string): Promise<Snapshot>;
  delete(snapshotPath: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Local-disk implementation for dev. Writes to ~/.agentic-snapshots/{roomId}.
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

let _store: SnapshotStore | null = null;
export function snapshotStore(): SnapshotStore {
  if (_store) return _store;
  // Future: if (process.env.SNAPSHOT_STORE === 's3') _store = new S3Store(...)
  _store = new LocalDiskStore();
  return _store;
}
