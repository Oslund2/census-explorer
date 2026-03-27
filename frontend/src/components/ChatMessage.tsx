import type { ChatMessage as ChatMessageType } from '../types';
import { ChartPanel } from './ChartPanel';
import { DataTable } from './DataTable';
import { SuggestedQuestions } from './SuggestedQuestions';

interface Props {
  message: ChatMessageType;
  onSuggestionClick: (text: string) => void;
}

export function ChatMessage({ message, onSuggestionClick }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Avatar + name */}
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'justify-end' : ''}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            isUser ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
          }`}>
            {isUser ? 'U' : 'C'}
          </div>
          <span className="text-xs text-gray-400 font-medium">
            {isUser ? 'You' : 'Census Explorer'}
          </span>
        </div>

        {/* Message bubble */}
        <div className={`rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white rounded-tr-sm'
            : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
        }`}>
          {/* Text content */}
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
            {message.isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse" />
            )}
          </div>
        </div>

        {/* Charts */}
        {message.charts?.map((chart, i) => (
          <ChartPanel key={i} chart={chart} />
        ))}

        {/* Tables */}
        {message.tables?.map((table, i) => (
          <DataTable key={i} table={table} />
        ))}

        {/* Suggested follow-ups */}
        {message.suggestions && !message.isStreaming && (
          <SuggestedQuestions
            suggestions={message.suggestions}
            onSelect={onSuggestionClick}
          />
        )}
      </div>
    </div>
  );
}
