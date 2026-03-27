interface Props {
  suggestions: string[];
  onSelect: (question: string) => void;
}

export function SuggestedQuestions({ suggestions, onSelect }: Props) {
  if (!suggestions.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {suggestions.map((q, i) => (
        <button
          key={i}
          onClick={() => onSelect(q)}
          className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200 transition-colors cursor-pointer"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
