import { useState, useCallback } from 'react';

interface ScrippsStation {
  callsign: string;
  network: string;
  market: string;
  state: string;
  dma_rank: number;
}

const SCRIPPS_STATIONS: ScrippsStation[] = [
  { callsign: "WCPO", network: "ABC", market: "Cincinnati", state: "OH", dma_rank: 37 },
  { callsign: "WFTS", network: "ABC", market: "Tampa-St. Petersburg", state: "FL", dma_rank: 13 },
  { callsign: "KMGH", network: "ABC", market: "Denver", state: "CO", dma_rank: 16 },
  { callsign: "WTVF", network: "CBS", market: "Nashville", state: "TN", dma_rank: 27 },
  { callsign: "KNXV", network: "ABC", market: "Phoenix", state: "AZ", dma_rank: 11 },
  { callsign: "WXYZ", network: "ABC", market: "Detroit", state: "MI", dma_rank: 14 },
  { callsign: "WEWS", network: "ABC", market: "Cleveland-Akron", state: "OH", dma_rank: 19 },
  { callsign: "WPTV", network: "NBC", market: "West Palm Beach", state: "FL", dma_rank: 44 },
  { callsign: "WTMJ", network: "NBC", market: "Milwaukee", state: "WI", dma_rank: 36 },
  { callsign: "KTNV", network: "ABC", market: "Las Vegas", state: "NV", dma_rank: 38 },
  { callsign: "KSTU", network: "FOX", market: "Salt Lake City", state: "UT", dma_rank: 30 },
  { callsign: "KGUN", network: "ABC", market: "Tucson", state: "AZ", dma_rank: 60 },
  { callsign: "WTKR", network: "CBS", market: "Norfolk-Portsmouth", state: "VA", dma_rank: 45 },
  { callsign: "WTVR", network: "CBS", market: "Richmond", state: "VA", dma_rank: 59 },
  { callsign: "WMAR", network: "ABC", market: "Baltimore", state: "MD", dma_rank: 26 },
  { callsign: "WKBW", network: "ABC", market: "Buffalo", state: "NY", dma_rank: 51 },
  { callsign: "WSFL", network: "CW", market: "Miami-Ft. Lauderdale", state: "FL", dma_rank: 17 },
  { callsign: "WBAY", network: "ABC", market: "Green Bay-Appleton", state: "WI", dma_rank: 65 },
  { callsign: "WXMI", network: "FOX", market: "Grand Rapids", state: "MI", dma_rank: 42 },
  { callsign: "KOAA", network: "NBC", market: "Colorado Springs", state: "CO", dma_rank: 89 },
  { callsign: "WMYD", network: "MNT", market: "Detroit", state: "MI", dma_rank: 14 },
  { callsign: "WSYM", network: "FOX", market: "Lansing", state: "MI", dma_rank: 110 },
];

interface Props {
  onSelect: (prompt: string) => void;
  onClose: () => void;
}

export function StationPicker({ onSelect, onClose }: Props) {
  const [selected, setSelected] = useState<ScrippsStation | null>(null);

  const handleStationClick = useCallback((station: ScrippsStation) => {
    setSelected(station);
  }, []);

  const queryTemplates = selected ? [
    {
      label: "Full market profile",
      prompt: `Give me a complete market profile for the ${selected.market} DMA (${selected.callsign}, ${selected.network}) — population, median income, median age, housing stats, unemployment rate, GDP, and fair market rents for ${selected.state}`,
    },
    {
      label: "Auto dealer pitch prep",
      prompt: `I'm prepping a pitch for an auto dealer advertising on ${selected.callsign} (${selected.network} ${selected.market}) — how many auto dealers are in ${selected.state}, what's the local income and employment picture, and Google Trends for 'used cars' in ${selected.state}?`,
    },
    {
      label: "Restaurant/QSR pitch prep",
      prompt: `I have a QSR client meeting for ${selected.callsign} (${selected.network} ${selected.market}) — how many restaurants are in ${selected.state}, what's the population and median income, and Google Trends for 'restaurants near me' in the ${selected.market} area?`,
    },
    {
      label: "Healthcare pitch prep",
      prompt: `Building a healthcare pitch for ${selected.callsign} (${selected.network} ${selected.market}) — what's the median age, how many hospitals and doctor offices are in ${selected.state}, and what does CDC data show for obesity and diabetes rates?`,
    },
    {
      label: "Home services pitch prep",
      prompt: `Prepping for a home services advertiser on ${selected.callsign} (${selected.network} ${selected.market}) — show me housing stats, HUD fair market rents, number of home improvement stores in ${selected.state}, and Google Trends for 'plumber near me' in ${selected.state}`,
    },
    {
      label: "Market comparison vs competitor",
      prompt: `Compare the ${selected.market} DMA against the national average — population, median household income, unemployment rate, GDP per capita, and housing costs. How does ${selected.callsign}'s market stack up?`,
    },
  ] : [];

  const handleQuerySelect = (prompt: string) => {
    onSelect(prompt);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Scripps Station Picker</h2>
            <p className="text-xs text-gray-500">
              {selected
                ? `${selected.callsign} (${selected.network}) — ${selected.market}, ${selected.state} — DMA #${selected.dma_rank}`
                : 'Select a station to auto-generate market queries'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {!selected ? (
          /* Station grid */
          <div className="px-6 py-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {SCRIPPS_STATIONS.sort((a, b) => a.dma_rank - b.dma_rank).map(station => (
                <button
                  key={station.callsign}
                  onClick={() => handleStationClick(station)}
                  className="text-left p-3 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-800 group-hover:text-blue-700">{station.callsign}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">{station.network}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{station.market}</p>
                  <p className="text-[10px] text-gray-300">DMA #{station.dma_rank}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Query options for selected station */
          <div className="px-6 py-5">
            <button
              onClick={() => setSelected(null)}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Pick a different station
            </button>

            <div className="space-y-2">
              {queryTemplates.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleQuerySelect(q.prompt)}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30 transition-all group"
                >
                  <p className="text-sm font-medium text-gray-700 group-hover:text-blue-700">{q.label}</p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">{q.prompt}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
