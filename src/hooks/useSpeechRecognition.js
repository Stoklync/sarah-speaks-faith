/**
 * useSpeechRecognition - Web Speech API for real-time transcriptions.
 * Powers One-Tap Caption for ministry reels.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export function useSpeechRecognition(options = {}) {
  const { onResult, onFinal, continuous = true, interimResults = true, lang = 'en-US' } = options;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(!!SpeechRecognition);
  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);

  const start = useCallback(() => {
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser');
      return;
    }
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;
    recognition.onresult = (e) => {
      let final = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0].transcript;
        if (res.isFinal) {
          final += text;
          onResult?.(text, true);
        } else {
          interim += text;
        }
      }
      if (final) {
        setTranscript((t) => t + final);
        onFinal?.(final);
      }
      setInterimTranscript(interim);
    };
    recognition.onerror = (e) => {
      if (e.error !== 'aborted' && e.error !== 'no-speech') setError(e.error);
      if (e.error === 'not-allowed') setIsListening(false);
    };
    recognition.onend = () => {
      if (listeningRef.current && recognitionRef.current === recognition) {
        try { recognition.start(); } catch (_) {}
      }
    };
    recognition.start();
    recognitionRef.current = recognition;
    listeningRef.current = true;
    setIsListening(true);
  }, [continuous, interimResults, lang, onResult, onFinal]);

  const stop = useCallback(() => {
    listeningRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const reset = useCallback(() => {
    stop();
    setTranscript('');
  }, [stop]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, []);

  const displayText = (transcript + (interimTranscript ? ` ${interimTranscript}` : '')).trim();

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    displayText,
    error,
    start,
    stop,
    reset,
  };
}
