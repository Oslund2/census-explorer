export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  charts?: ChartData[];
  tables?: TableData[];
  suggestions?: string[];
  isStreaming?: boolean;
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar';
  title: string;
  data: {
    labels: string[];
    datasets: DatasetConfig[];
  };
}

export interface DatasetConfig {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
}

export interface TableData {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface ToolEvent {
  name: string;
  status: 'running' | 'done' | 'error';
  result?: string;
}

export interface SSEEvent {
  type: 'text_delta' | 'tool_start' | 'tool_result' | 'tool_error' | 'done' | 'error';
  text?: string;
  name?: string;
  result?: string;
  error?: string;
  message?: string;
}
