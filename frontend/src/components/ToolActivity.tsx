import type { ToolEvent } from '../types';

interface Props {
  events: ToolEvent[];
}

const toolLabels: Record<string, string> = {
  'resolve-geography-fips': 'Resolving geography',
  'fetch-aggregate-data': 'Fetching Census data',
  'list-datasets': 'Listing datasets',
  'fetch-dataset-geography': 'Checking geography levels',
  'search-data-tables': 'Searching data tables',
};

export function ToolActivity({ events }: Props) {
  if (events.length === 0) return null;

  return (
    <div className="mx-4 mb-2">
      <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs space-y-1">
        {events.map((event, i) => (
          <div key={i} className="flex items-center gap-2">
            {event.status === 'running' ? (
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            ) : event.status === 'done' ? (
              <span className="text-green-600">&#10003;</span>
            ) : (
              <span className="text-red-500">&#10007;</span>
            )}
            <span className={event.status === 'running' ? 'text-blue-700' : 'text-gray-500'}>
              {toolLabels[event.name] || event.name}
              {event.status === 'running' && '...'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
