import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, ToolEvent, ChartData, TableData } from '../types';
import { streamChat } from '../api/client';

let nextId = 1;
const genId = () => String(nextId++);

export function useChatSession() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: ChatMessage = { id: genId(), role: 'user', content };
    const assistantMsg: ChatMessage = {
      id: genId(),
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);
    setToolEvents([]);

    // Build message history (last 20 messages)
    const history = [...messages, userMsg]
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    let fullText = '';

    try {
      for await (const event of streamChat(history)) {
        switch (event.type) {
          case 'text_delta':
            fullText += event.text || '';
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMsg.id ? { ...m, content: fullText } : m
              )
            );
            break;

          case 'tool_start':
            setToolEvents(prev => [
              ...prev,
              { name: event.name || '', status: 'running' },
            ]);
            break;

          case 'tool_result':
            setToolEvents(prev =>
              prev.map(t =>
                t.name === event.name && t.status === 'running'
                  ? { ...t, status: 'done', result: event.result }
                  : t
              )
            );
            break;

          case 'tool_error':
            setToolEvents(prev =>
              prev.map(t =>
                t.name === event.name && t.status === 'running'
                  ? { ...t, status: 'error', result: event.error }
                  : t
              )
            );
            break;

          case 'error':
            fullText += `\n\n*Error: ${event.message}*`;
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMsg.id ? { ...m, content: fullText } : m
              )
            );
            break;

          case 'done':
            break;
        }
      }
    } catch (err) {
      fullText += `\n\n*Connection error: ${err}*`;
    }

    // Parse structured data from the response
    const parsed = parseStructuredData(fullText);

    setMessages(prev =>
      prev.map(m =>
        m.id === assistantMsg.id
          ? {
              ...m,
              content: parsed.text,
              charts: parsed.charts,
              tables: parsed.tables,
              suggestions: parsed.suggestions,
              isStreaming: false,
            }
          : m
      )
    );
    setIsLoading(false);
    setToolEvents([]);
  }, [messages]);

  return { messages, isLoading, toolEvents, sendMessage };
}

interface ParsedResponse {
  text: string;
  charts: ChartData[];
  tables: TableData[];
  suggestions: string[];
}

function parseStructuredData(text: string): ParsedResponse {
  const result: ParsedResponse = {
    text: text,
    charts: [],
    tables: [],
    suggestions: [],
  };

  // Extract JSON blocks from the text
  const jsonRegex = /```json\s*([\s\S]*?)```/g;
  let match;

  while ((match = jsonRegex.exec(text)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (data.charts) result.charts = data.charts;
      if (data.tables) result.tables = data.tables;
      if (data.suggestions) result.suggestions = data.suggestions;
    } catch {
      // Skip invalid JSON
    }
  }

  // Remove JSON blocks from displayed text
  result.text = text.replace(/```json\s*[\s\S]*?```/g, '').trim();

  return result;
}
