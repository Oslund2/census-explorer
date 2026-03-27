import { useVoiceInput } from '../hooks/useVoiceInput';
import { useEffect } from 'react';

interface Props {
  onTranscript: (text: string) => void;
}

export function VoiceInput({ onTranscript }: Props) {
  const { isListening, transcript, isSupported, startListening, stopListening } = useVoiceInput();

  useEffect(() => {
    if (transcript && !isListening) {
      onTranscript(transcript);
    }
  }, [transcript, isListening, onTranscript]);

  if (!isSupported) return null;

  return (
    <button
      onClick={isListening ? stopListening : startListening}
      className={`p-2 rounded-full transition-all ${
        isListening
          ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
      }`}
      title={isListening ? 'Stop listening' : 'Voice input'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
    </button>
  );
}
