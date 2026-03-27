import { useState } from 'react';

const CLIENT_TYPES = [
  "Auto Dealer",
  "Restaurant / QSR",
  "Healthcare / Hospital",
  "Insurance",
  "Real Estate",
  "Home Services / Home Improvement",
  "Legal / Law Firm",
  "Retail",
  "Grocery / CPG",
  "Fitness / Wellness",
  "Pharma",
  "Financial Services",
  "Travel / Hospitality",
  "Education",
  "Other",
];

const SOURCE_COLORS: Record<string, string> = {
  Census: "bg-violet-100 text-violet-700",
  BLS: "bg-blue-100 text-blue-700",
  FRED: "bg-emerald-100 text-emerald-700",
  BEA: "bg-rose-100 text-rose-700",
  CBP: "bg-indigo-100 text-indigo-700",
  CDC: "bg-pink-100 text-pink-700",
  Trends: "bg-yellow-100 text-yellow-700",
  HUD: "bg-teal-100 text-teal-700",
  FEMA: "bg-orange-100 text-orange-700",
  FCC: "bg-gray-100 text-gray-700",
};

interface GeneratedPrompt {
  title: string;
  prompt: string;
  sources: string[];
  rationale: string;
}

interface Props {
  onSelect: (prompt: string) => void;
  onClose: () => void;
}

export function PromptBuilder({ onSelect, onClose }: Props) {
  const [clientName, setClientName] = useState('');
  const [clientType, setClientType] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [prompts, setPrompts] = useState<GeneratedPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'results'>('form');

  const canSubmit = clientName.trim() && clientType && location.trim();

  const handleGenerate = async () => {
    if (!canSubmit) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/prompt-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: clientName,
          client_type: clientType,
          location: location,
          notes: notes,
        }),
      });
      const data = await res.json();
      setPrompts(data.prompts || []);
      setStep('results');
    } catch {
      setPrompts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (prompt: string) => {
    onSelect(prompt);
    onClose();
  };

  const handleBack = () => {
    setStep('form');
    setPrompts([]);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Prompt Builder</h2>
            <p className="text-xs text-gray-500">
              {step === 'form'
                ? 'Tell us about your client and we\'ll generate tailored research prompts'
                : 'Pick a prompt to run — or go back to edit'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {step === 'form' ? (
          <div className="px-6 py-5 space-y-4">
            {/* Client Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="e.g. AutoNation Tampa, Baptist Health"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Client Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Type / Industry</label>
              <select
                value={clientType}
                onChange={e => setClientType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Select industry...</option>
                {CLIENT_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location / Region</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Tampa, FL or Cincinnati DMA or Statewide Ohio"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional Context <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. They're considering increasing spend for Q4, worried about market saturation, expanding to 3 new locations..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleGenerate}
              disabled={!canSubmit || isLoading}
              className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating prompts...
                </>
              ) : (
                'Generate Research Prompts'
              )}
            </button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-3">
            {/* Back button */}
            <button
              onClick={handleBack}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Edit client info
            </button>

            {/* Client context reminder */}
            <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 mb-3">
              {clientName} &middot; {clientType} &middot; {location}
              {notes && <> &middot; {notes}</>}
            </div>

            {/* Generated prompts */}
            {prompts.map((p, i) => (
              <button
                key={i}
                onClick={() => handleSelect(p.prompt)}
                className="w-full text-left p-4 rounded-xl border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30 transition-all shadow-sm group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-700 mb-1">{p.title}</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{p.prompt}</p>
                    <p className="text-xs text-gray-400 mt-2 italic">{p.rationale}</p>
                  </div>
                  <div className="flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 group-hover:text-blue-500">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </div>
                <div className="flex gap-1 mt-2">
                  {p.sources.map(s => (
                    <span
                      key={s}
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${SOURCE_COLORS[s] || 'bg-gray-100 text-gray-600'}`}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </button>
            ))}

            {prompts.length === 0 && !isLoading && (
              <p className="text-sm text-gray-400 text-center py-4">No prompts generated. Try again.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
