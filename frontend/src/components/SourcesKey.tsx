import { useState, useEffect } from 'react';

interface Source {
  id: string;
  name: string;
  description: string;
  connected: boolean;
}

// Sources that can be toggled on/off by the user
const TOGGLEABLE_SOURCES = new Set(['fema']);

interface Props {
  disabledSources: string[];
  onToggleSource: (sourceId: string) => void;
}

export function SourcesKey({ disabledSources, onToggleSource }: Props) {
  const [sources, setSources] = useState<Source[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(data => {
        if (data.sources) setSources(data.sources);
      })
      .catch(() => {});
  }, []);

  if (!sources.length) return null;

  const activeCount = sources.filter(
    s => s.connected && !disabledSources.includes(s.id)
  ).length;

  return (
    <div className="mt-6 max-w-5xl mx-auto">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mx-auto text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
          {activeCount} active
        </span>
        <span className="text-gray-300">|</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
          {sources.length - activeCount} off
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {sources.map(src => {
            const isToggleable = TOGGLEABLE_SOURCES.has(src.id);
            const isDisabled = disabledSources.includes(src.id);
            const isActive = src.connected && !isDisabled;

            return (
              <div
                key={src.id}
                className={`flex items-start gap-2 px-3 py-2 rounded-lg border shadow-sm ${
                  isActive
                    ? 'bg-white border-gray-100'
                    : 'bg-gray-50 border-gray-100 opacity-60'
                }`}
              >
                <span
                  className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${
                    isActive ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-700 truncate">{src.name}</p>
                  <p className="text-[10px] text-gray-400 leading-tight">{src.description}</p>
                </div>
                {isToggleable && src.connected && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleSource(src.id); }}
                    className={`flex-shrink-0 mt-0.5 w-8 h-4 rounded-full transition-colors relative ${
                      isActive ? 'bg-emerald-400' : 'bg-gray-300'
                    }`}
                    title={isActive ? `Disable ${src.name}` : `Enable ${src.name}`}
                  >
                    <span
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                        isActive ? 'left-4' : 'left-0.5'
                      }`}
                    />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
