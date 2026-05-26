// Round-trip test for the S3 snapshot store.
// Run: npx tsx scripts/test-s3.ts
//
// Verifies that the configured creds + bucket can save, load, and delete a
// snapshot. Detects bucket region mismatch and prints a fix hint.
import 'dotenv/config';
import {
  S3Client,
  GetBucketLocationCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { snapshotStore } from '../lib/snapshots/store';

async function main() {
  const bucket = process.env.SNAPSHOT_BUCKET;
  const region = process.env.AWS_REGION ?? 'ap-south-1';

  if (!bucket) {
    console.error('SNAPSHOT_BUCKET is not set');
    process.exit(1);
  }

  // 1. Detect bucket region
  console.log(`\n[1/4] Detecting region for bucket "${bucket}"...`);
  const probe = new S3Client({ region });
  try {
    const loc = await probe.send(new GetBucketLocationCommand({ Bucket: bucket }));
    // us-east-1 returns null
    const actual = loc.LocationConstraint || 'us-east-1';
    console.log(`      bucket region: ${actual}`);
    if (actual !== region) {
      console.warn(
        `      ⚠ region mismatch — your AWS_REGION is "${region}" but the bucket is in "${actual}".`,
      );
      console.warn(`      Updating in-process for this test. To persist: set AWS_REGION=${actual} in .env`);
      process.env.AWS_REGION = actual;
    }
  } catch (err) {
    console.error('      could not read bucket location:', (err as Error).message);
    process.exit(1);
  }

  // 2. HEAD bucket — confirms creds + bucket access
  console.log(`\n[2/4] HEAD bucket to confirm access...`);
  const ok = new S3Client({ region: process.env.AWS_REGION! });
  await ok.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log('      ✓ access OK');

  // 3. Reset cached store so it picks up the corrected region
  const { _resetSnapshotStore } = await import('../lib/snapshots/store');
  _resetSnapshotStore();

  // 4. Save / load / delete round-trip via the SnapshotStore
  console.log(`\n[3/4] Saving test snapshot...`);
  const store = snapshotStore();
  const snap = {
    version: 1 as const,
    files: [{ path: 'README.md', content: 'hello from s3 test' }],
    meta: {
      capturedAt: new Date().toISOString(),
      fileCount: 1,
      totalBytes: 18,
    },
  };
  const saved = await store.save('test-room', 'test-version-' + Date.now(), snap);
  console.log('      ✓ saved at:', saved);

  console.log(`\n[4/4] Loading + deleting...`);
  const loaded = await store.load(saved);
  if (loaded.files[0].content !== snap.files[0].content) {
    console.error('      ✗ content mismatch after round-trip');
    process.exit(1);
  }
  console.log('      ✓ loaded back, content matches');
  await store.delete(saved);
  console.log('      ✓ deleted');

  console.log('\nAll good — S3 store is wired correctly.\n');
}

main().catch((err) => {
  console.error('\nFAILED:', err.message ?? err);
  if (err.name === 'CredentialsProviderError') {
    console.error('Hint: check AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in .env');
  }
  process.exit(1);
});
