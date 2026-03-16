/**
 * Server-Sent Events hook for real-time scan status updates.
 *
 * Opens an EventSource connection to /api/scans/{id}/events
 * and dispatches typed events to the caller.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

interface UseSSEOptions {
  scanId: number | null;
  onEvent: (event: SSEEvent) => void;
  onComplete?: () => void;
  onError?: (error: Event) => void;
}

export function useSSE({ scanId, onEvent, onComplete, onError }: UseSSEOptions) {
  const sourceRef = useRef<EventSource | null>(null);
  const [connected, setConnected] = useState(false);

  const close = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    if (!scanId) return;

    const source = new EventSource(`/api/scans/${scanId}/events`);
    sourceRef.current = source;

    source.onopen = () => setConnected(true);

    // Listen for specific event types
    const eventTypes = ['status', 'progress', 'finding', 'complete', 'error'];
    eventTypes.forEach((type) => {
      source.addEventListener(type, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          onEvent({ type, data });

          if (type === 'status' && (data.status === 'complete' || data.status === 'failed')) {
            onComplete?.();
            close();
          }
        } catch {
          // Ignore parse errors
        }
      });
    });

    source.onerror = (e) => {
      onError?.(e);
      // EventSource auto-reconnects, but if the scan is done the server closes it
      if (source.readyState === EventSource.CLOSED) {
        setConnected(false);
      }
    };

    return () => {
      source.close();
      sourceRef.current = null;
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId]);

  return { connected, close };
}
