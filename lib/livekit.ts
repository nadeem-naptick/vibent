import { AccessToken } from 'livekit-server-sdk';

const apiKey = process.env.LIVEKIT_API_KEY!;
const apiSecret = process.env.LIVEKIT_API_SECRET!;

type MintOptions = {
  roomId: string;
  identity: string;
  name: string;
  role: 'host' | 'collaborator' | 'viewer' | 'agent';
};

export async function mintLiveKitToken({
  roomId,
  identity,
  name,
  role,
}: MintOptions) {
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    // 8 hour TTL — long enough for any single meeting
    ttl: 60 * 60 * 8,
  });

  at.addGrant({
    room: roomId,
    roomJoin: true,
    canPublish: role !== 'viewer',
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
  });

  return at.toJwt();
}

export const livekitUrl = process.env.LIVEKIT_URL!;
export const publicLiveKitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL!;
