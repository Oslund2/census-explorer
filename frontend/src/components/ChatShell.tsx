import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatSession } from '../hooks/useChatSession';
import { ChatMessage } from './ChatMessage';
import { ToolActivity } from './ToolActivity';
import { VoiceInput } from './VoiceInput';

const WELCOME_SUGGESTIONS = [
  "What's the population of New York City?",
  "Compare Austin, TX and Denver, CO on income and education",
  "Find cities with population over 500k and high median income",
  "Generate a demographic report for California",
];

export function ChatShell() {
  const { messages, isLoading, toolEvents, sendMessage } = useChatSession();
  const [input, setInput] = useState('');
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
            <h1 className="text-lg font-bold text-gray-900">Census Explorer</h1>
            <p className="text-xs text-gray-500">U.S. Census Bureau Data &middot; AI-Powered Analysis</p>
          </div>
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18" />
                  <path d="m19 9-5 5-4-4-3 3" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to Census Explorer</h2>
              <p className="text-gray-500 mb-8 max-w-lg mx-auto">
                Ask anything about U.S. Census data. I can look up demographics, compare cities,
                find locations matching your criteria, and generate reports.
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
                {WELCOME_SUGGESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(q)}
                    className="text-sm bg-white hover:bg-blue-50 text-gray-700 hover:text-blue-700 px-4 py-2 rounded-full border border-gray-200 hover:border-blue-200 transition-all shadow-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
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
          <VoiceInput onTranscript={handleVoiceTranscript} />

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about Census data..."
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
