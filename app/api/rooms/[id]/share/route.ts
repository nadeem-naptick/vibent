import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rooms, shares } from '@/lib/db/schema';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { buildAndCollect, BuildError } from '@/lib/exec/build-and-collect';
import { listVersions } from '@/lib/snapshots/manager';

// Public-readable assets live under this prefix in the bucket. The bucket
// policy (configured once via AWS Console) grants s3:GetObject to "*" on
// arn:aws:s3:::<bucket>/shares/* — see docs.
const SHARES_PREFIX = 'shares';

// POST /api/rooms/[id]/share
// Builds the current artifact with base=/shares/<slug>/, uploads each file
// to S3 with public-read access (relying on bucket policy), persists a
// `shares` row, and returns the public URL.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const [room] = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  if (!room) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (room.hostUserId !== session.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!room.sandboxId) {
    return NextResponse.json({ error: 'no sandbox provisioned' }, { status: 400 });
  }

  const sandbox = sandboxManager.getProvider(room.sandboxId);
  if (!sandbox) {
    return NextResponse.json(
      { error: 'sandbox not currently attached — open the room first and try again' },
      { status: 503 },
    );
  }

  const bucket = process.env.SNAPSHOT_BUCKET;
  const region = process.env.AWS_REGION ?? 'ap-south-1';
  if (!bucket) {
    return NextResponse.json(
      { error: 'sharing is not configured (SNAPSHOT_BUCKET unset)' },
      { status: 503 },
    );
  }

  // 1. Generate slug + S3 prefix
  const slug = nanoid(10);
  const s3Prefix = `${SHARES_PREFIX}/${slug}/`;
  const basePath = `/${s3Prefix}`;

  // 2. Build with the correct base path so all asset references resolve
  //    when served from s3://<bucket>/shares/<slug>/.
  let files;
  try {
    files = await buildAndCollect(sandbox, { base: basePath });
  } catch (err) {
    if (err instanceof BuildError) {
      console.warn('[share] build failed:', err.message);
      return NextResponse.json(
        { error: 'build_failed', detail: err.message },
        { status: 500 },
      );
    }
    console.error('[share] unexpected build error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'build failed' },
      { status: 500 },
    );
  }

  // 3. Upload each file to S3 under shares/<slug>/. Don't pass ACL — modern
  //    buckets default to BucketOwnerEnforced which blocks per-object ACLs;
  //    public-read comes from the bucket policy instead.
  const s3 = new S3Client({ region });
  let totalBytes = 0;
  try {
    for (const f of files) {
      const key = `${s3Prefix}${f.path}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: f.content,
          ContentType: f.contentType,
          // Hashed asset filenames (e.g. index-abc.js) are content-addressed —
          // safe to cache forever. index.html should NOT be cached forever so
          // future updates take effect; cap it at 1 hour for the HTML.
          CacheControl: f.path.endsWith('.html')
            ? 'public, max-age=300, must-revalidate'
            : 'public, max-age=31536000, immutable',
        }),
      );
      totalBytes += f.content.length;
    }
  } catch (err) {
    console.error('[share] s3 upload failed:', err);
    return NextResponse.json(
      {
        error: 'upload_failed',
        detail: err instanceof Error ? err.message : 'S3 PutObject failed',
      },
      { status: 500 },
    );
  }

  // 4. Find the most recent version to associate with this share (if any).
  const versions = await listVersions(room.id);
  const latestVersionId = versions[0]?.id ?? null;

  // 5. Persist the share row.
  await db.insert(shares).values({
    slug,
    roomId: room.id,
    versionId: latestVersionId,
    createdBy: session.user.id,
    s3Prefix,
    fileCount: files.length,
    totalBytes,
  });

  // 6. Construct the public URL. Direct-object S3 URL pattern is:
  //    https://<bucket>.s3.<region>.amazonaws.com/<key>
  const url = `https://${bucket}.s3.${region}.amazonaws.com/${s3Prefix}index.html`;

  return NextResponse.json(
    { slug, url, fileCount: files.length, totalBytes },
    { status: 201 },
  );
}
