'use client';

import { useEffect, useRef } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { createClient, LiveTranscriptionEvents, type LiveClient } from '@deepgram/sdk';
import { nanoid } from 'nanoid';
import { FEED_TOPIC, type FeedMessage } from './types';
import type { TranscriptSegment } from '@/lib/db/mongo';

type Options = {
  roomId: string;
  speakerName: string;
  enabled: boolean;
};

/**
 * Browser-side live transcription via Deepgram. Each participant transcribes
 * their own microphone audio — speaker identity is therefore unambiguous and
 * we don't need a server-side audio pipeline.
 *
 * Flow per utterance:
 *   1. mic audio chunk → Deepgram WebSocket
 *   2. on final transcript → POST /api/transcripts (persist + classify)
 *   3. on response → publish {transcript, intent?} via LiveKit data channel
 *      so other participants see the same feed in real time
 */
export function useBrowserSTT({ roomId, speakerName, enabled }: Options) {
  const { localParticipant } = useLocalParticipant();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const connectionRef = useRef<LiveClient | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!enabled || !localParticipant) return;

    let cancelled = false;

    (async () => {
      // 1. Get a scoped Deepgram key from our backend.
      const tokenRes = await fetch('/api/deepgram/token', { method: 'POST' });
      if (!tokenRes.ok) {
        console.error('[stt] failed to mint Deepgram token', await tokenRes.text());
        return;
      }
      const { key } = (await tokenRes.json()) as { key: string };
      if (cancelled) return;

      // 2. Open Deepgram WebSocket.
      const deepgram = createClient(key);
      const connection = deepgram.listen.live({
        model: 'nova-3',
        language: 'en-US',
        smart_format: true,
        interim_results: true,
        endpointing: 500,
        utterance_end_ms: 1200,
      });
      connectionRef.current = connection;

      connection.on(LiveTranscriptionEvents.Open, async () => {
        if (cancelled) return;

        // 3. Capture mic and stream via MediaRecorder.
        const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = mediaStream;

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

        const recorder = new MediaRecorder(mediaStream, { mimeType });
        recorderRef.current = recorder;
        startedAtRef.current = Date.now();

        recorder.addEventListener('dataavailable', (e) => {
          if (e.data.size > 0 && connection.getReadyState() === 1) {
            connection.send(e.data);
          }
        });
        recorder.start(250);
      });

      connection.on(LiveTranscriptionEvents.Transcript, async (data: any) => {
        const alt = data?.channel?.alternatives?.[0];
        const text: string = alt?.transcript ?? '';
        const isFinal: boolean = Boolean(data?.is_final);
        if (!text.trim()) return;

        // We only publish/persist final results to keep the feed clean.
        // Interim results could be shown in a "live" preview line later.
        if (!isFinal) return;

        const segmentId = nanoid();
        const elapsed = Date.now() - startedAtRef.current;
        const startMs = elapsed - Math.round((data.duration ?? 0) * 1000);

        const segment: TranscriptSegment = {
          id: segmentId,
          roomId,
          speakerId: localParticipant.identity,
          speakerName,
          text,
          isFinal: true,
          startMs: Math.max(0, startMs),
          endMs: elapsed,
          createdAt: new Date(),
        };

        try {
          const res = await fetch('/api/transcripts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(segment),
          });
          if (!res.ok) {
            console.error('[stt] transcripts POST failed', await res.text());
            return;
          }
          const { intent } = (await res.json()) as {
            transcript: TranscriptSegment;
            intent: FeedMessage['payload'] | null;
          };

          // Publish to other participants via the LiveKit data channel.
          const transcriptMsg: FeedMessage = { kind: 'transcript', payload: segment };
          await publishFeedMessage(localParticipant, transcriptMsg);
          if (intent) {
            const intentMsg: FeedMessage = {
              kind: 'intent',
              payload: intent as any,
            };
            await publishFeedMessage(localParticipant, intentMsg);
          }
        } catch (err) {
          console.error('[stt] persist failed:', err);
        }
      });

      connection.on(LiveTranscriptionEvents.Error, (err) => {
        console.error('[stt] Deepgram error:', err);
      });

      connection.on(LiveTranscriptionEvents.Close, () => {
        // Auto-reconnect could go here. For M2 we just stop.
      });
    })();

    return () => {
      cancelled = true;
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      connectionRef.current?.requestClose();
      recorderRef.current = null;
      streamRef.current = null;
      connectionRef.current = null;
    };
  }, [enabled, localParticipant, roomId, speakerName]);
}

async function publishFeedMessage(
  localParticipant: ReturnType<typeof useLocalParticipant>['localParticipant'],
  msg: FeedMessage,
) {
  const encoder = new TextEncoder();
  await localParticipant.publishData(encoder.encode(JSON.stringify(msg)), {
    topic: FEED_TOPIC,
    reliable: true,
  });
}
