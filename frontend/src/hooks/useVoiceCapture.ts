import { useCallback, useRef, useState } from "react";

interface UseVoiceCaptureResult {
  isRecording: boolean;
  elapsedMs: number;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
}

/** Wraps getUserMedia + MediaRecorder into start/stop calls that resolve with the
 * recorded blob, so callers don't deal with MediaRecorder's event-callback API directly. */
export function useVoiceCapture(): UseVoiceCaptureResult {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopResolverRef = useRef<((blob: Blob | null) => void) | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stopResolverRef.current?.(blob);
        stopResolverRef.current = null;
      };
      recorderRef.current = recorder;
      recorder.start();

      startTimeRef.current = performance.now();
      setElapsedMs(0);
      timerRef.current = setInterval(() => setElapsedMs(performance.now() - startTimeRef.current), 200);
      setIsRecording(true);
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access was denied. Allow microphone permission in your browser and try again."
          : err instanceof Error
            ? err.message
            : "Could not access the microphone."
      );
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        return;
      }
      stopResolverRef.current = resolve;
      recorder.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      clearTimer();
      setIsRecording(false);
    });
  }, []);

  return { isRecording, elapsedMs, error, startRecording, stopRecording };
}
