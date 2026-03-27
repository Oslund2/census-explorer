import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatSession } from '../hooks/useChatSession';
import { ChatMessage } from './ChatMessage';
import { ToolActivity } from './ToolActivity';
import { VoiceInput } from './VoiceInput';
import { SalesPrompts } from './SalesPrompts';
import { SourcesKey } from './SourcesKey';
import { PromptBuilder } from './PromptBuilder';

export function ChatShell() {
  const { messages, isLoading, toolEvents, sendMessage } = useChatSession();
  const [input, setInput] = useState('');
  const [showPromptBuilder, setShowPromptBuilder] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, toolEvents]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage(text);
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = useCallback((text: string) => {
    if (isLoading) return;
    sendMessage(text);
  }, [isLoading, sendMessage]);

  const handleVoiceTranscript = useCallback((text: string) => {
    setInput(prev => prev + text);
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {showPromptBuilder && (
        <PromptBuilder
          onSelect={handleSuggestionClick}
          onClose={() => setShowPromptBuilder(false)}
        />
      )}
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-xl flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Market Connect</h1>
            <p className="text-xs text-gray-500">Federal Data &middot; AI-Powered Sales Intelligence</p>
          </div>
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className={`mx-auto ${messages.length === 0 ? 'max-w-5xl' : 'max-w-4xl'}`}>
          {messages.length === 0 && (
            <div className="text-center py-10">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18" />
                  <path d="m19 9-5 5-4-4-3 3" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to Market Connect</h2>
              <p className="text-gray-500 mb-4 max-w-lg mx-auto">
                12 data sources, one AI-powered platform. Pick a prompt or build your own.
              </p>
              <button
                onClick={() => setShowPromptBuilder(true)}
                className="mb-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
                </svg>
                Prompt Builder
              </button>
              <SalesPrompts onSelect={handleSuggestionClick} />
              <SourcesKey />
            </div>
          )}

          {messages.map(msg => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onSuggestionClick={handleSuggestionClick}
            />
          ))}

          {/* Tool activity */}
          <ToolActivity events={toolEvents} />

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-end gap-2">
          <button
            onClick={() => setShowPromptBuilder(true)}
            title="Prompt Builder"
            className="p-2.5 rounded-xl text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
            </svg>
          </button>
          <VoiceInput onTranscript={handleVoiceTranscript} />

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about any market, client, or data source..."
              rows={1}
              className="w-full resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
              style={{ maxHeight: '120px' }}
              disabled={isLoading}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
