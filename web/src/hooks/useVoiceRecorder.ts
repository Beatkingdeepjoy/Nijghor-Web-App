// Web Audio API Voice Note Recorder Hook with Waveform Analysis

import { useState, useRef, useCallback } from 'react';

export interface VoiceRecording {
  blob: Blob;
  durationMs: number;
  waveform: number[]; // 30-sample normalized amplitude array
}

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const samplesRef = useRef<number[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      samplesRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(100);
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDurationMs(0);

      // Amplitude sampling timer for waveform
      timerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startTimeRef.current);

        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          // Compute average amplitude
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(Math.max(avg / 255, 0.1), 1.0);

          samplesRef.current.push(normalized);
          if (samplesRef.current.length > 30) {
            samplesRef.current.shift();
          }
          setWaveform([...samplesRef.current]);
        }
      }, 100);
    } catch (err) {
      console.error('[Voice] Failed to start recording:', err);
    }
  }, []);

  const stopRecording = useCallback((): Promise<VoiceRecording | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }

      if (timerRef.current) clearInterval(timerRef.current);

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const finalDuration = Date.now() - startTimeRef.current;

        // Clean up tracks
        streamRef.current?.getTracks().forEach((track) => track.stop());
        audioContextRef.current?.close();

        setIsRecording(false);
        resolve({
          blob,
          durationMs: finalDuration,
          waveform: samplesRef.current.length > 0 ? samplesRef.current : Array(24).fill(0.3),
        });
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  const cancelRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close();
    setIsRecording(false);
    setWaveform([]);
    setDurationMs(0);
  }, []);

  return {
    isRecording,
    durationMs,
    waveform,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
