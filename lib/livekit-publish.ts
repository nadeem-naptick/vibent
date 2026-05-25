import { RoomServiceClient, DataPacket_Kind } from 'livekit-server-sdk';

// Server-side data channel publisher. Lets the execution agent (running in
// our Next.js backend, not in a browser) push real-time progress events to
// every participant in a room without needing to join as a fake participant.
//
// The HTTP-style API URL is derived from the WSS URL LiveKit Cloud gives us.

function deriveApiUrl(wssUrl: string) {
  // wss://x.livekit.cloud -> https://x.livekit.cloud
  return wssUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
}

let _client: RoomServiceClient | null = null;

function getClient() {
  if (_client) return _client;
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) {
    throw new Error('LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET not set');
  }
  _client = new RoomServiceClient(deriveApiUrl(url), apiKey, apiSecret);
  return _client;
}

export async function publishToRoom(
  roomId: string,
  topic: string,
  payload: unknown,
) {
  const data = new TextEncoder().encode(JSON.stringify(payload));
  try {
    await getClient().sendData(roomId, data, DataPacket_Kind.RELIABLE, {
      topic,
    });
  } catch (err) {
    // Common case: the LiveKit room doesn't exist yet because no one has
    // joined. That's not an error worth bubbling up — the receiver isn't
    // there to receive anyway.
    if (err instanceof Error && /room\s+not\s+found/i.test(err.message)) {
      return;
    }
    console.warn('[livekit-publish] sendData failed:', err);
  }
}
