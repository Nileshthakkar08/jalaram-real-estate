'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

/* Minimal typings for the Web Speech API (not in TypeScript's DOM lib). */
interface SpeechRecognitionResultEvent {
  results: { length: number; [index: number]: { 0: { transcript: string } } };
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionConstructor = new () => SpeechRecognitionLike;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface VoiceInputButtonProps {
  /** Called with the final spoken text. */
  onText: (text: string) => void;
  /** What is being filled, for the button's accessible label (e.g. "name"). */
  label: string;
  lang?: string;
  onError?: (message: string) => void;
}

/**
 * Microphone button that fills a field from speech. Renders nothing where the browser has no
 * speech recognition (e.g. Firefox, some in-app browsers); the keyboard's own mic still works there.
 */
export function VoiceInputButton({ onText, label, lang = 'en-IN', onError }: VoiceInputButtonProps) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  // Detected after mount so server and client render the same markup.
  useEffect(() => setSupported(recognitionConstructor() !== null), []);
  useEffect(() => () => recognition.current?.stop(), []);

  if (!supported) return null;

  const toggle = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Recognition = recognitionConstructor();
    if (!Recognition) return;

    const r = new Recognition();
    r.lang = lang;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (event) => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
      if (text.trim()) onText(text.trim());
    };
    r.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        onError?.('Microphone access is blocked. Allow it in your browser settings, or type instead.');
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        onError?.('Could not hear that. Please try again or type instead.');
      }
    };
    r.onend = () => setListening(false);
    recognition.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? `Stop recording ${label}` : `Speak your ${label}`}
      aria-pressed={listening}
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors',
        listening ? 'animate-pulse border-destructive bg-destructive text-destructive-foreground' : 'border-input bg-background text-primary hover:bg-muted'
      )}
    >
      {listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}
