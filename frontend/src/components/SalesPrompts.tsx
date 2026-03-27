interface SalesPrompt {
  text: string;
  description: string;
  sources: string[];
}

const SOURCE_COLORS: Record<string, string> = {
  BLS: "bg-blue-100 text-blue-700",
  FEMA: "bg-orange-100 text-orange-700",
  FRED: "bg-emerald-100 text-emerald-700",
  Census: "bg-violet-100 text-violet-700",
  BEA: "bg-rose-100 text-rose-700",
  Trends: "bg-yellow-100 text-yellow-700",
  HUD: "bg-teal-100 text-teal-700",
  CBP: "bg-indigo-100 text-indigo-700",
  CDC: "bg-pink-100 text-pink-700",
};

const LOCAL_PROMPTS: SalesPrompt[] = [
  {
    text: "I'm an AE at WFTS (ABC Tampa) meeting with a car dealer tomorrow — how many auto dealers are in Florida, what's Tampa's population and income, fair market rents, and Google Trends for 'used cars' vs 'new cars'?",
    description: "WFTS Tampa — auto advertiser prep",
    sources: ["CBP", "Census", "HUD", "Trends"],
  },
  {
    text: "Pitching a home services company on KMGH (ABC Denver) — how many home improvement stores are in Colorado, show me housing stats, HUD rents, and Google Trends for 'plumber near me' in the Denver DMA",
    description: "KMGH Denver — home services pitch",
    sources: ["CBP", "Census", "HUD", "Trends"],
  },
  {
    text: "Building a pitch for a hospital system on WTVF (CBS Nashville) — how many hospitals are in Tennessee, what's the median age, and what does CDC data show for obesity and diabetes rates by county?",
    description: "WTVF Nashville — healthcare vertical",
    sources: ["CBP", "Census", "CDC"],
  },
  {
    text: "My client is a personal injury firm wanting to buy WPTV (NBC West Palm Beach) — show me recent FEMA disasters in Florida, CDC health data for the area, and Google Trends for 'personal injury lawyer' by Florida DMA",
    description: "WPTV West Palm — legal advertiser",
    sources: ["FEMA", "CDC", "Trends"],
  },
  {
    text: "Pitching a restaurant group on WXYZ (ABC Detroit) — how many restaurants and fast food places are in Michigan, what's the Detroit DMA size, and Google Trends for 'restaurants near me' vs 'food delivery'?",
    description: "WXYZ Detroit — QSR expansion pitch",
    sources: ["CBP", "Census", "Trends"],
  },
  {
    text: "A fitness chain wants to advertise on KNXV (ABC Phoenix) — how many fitness centers are in Arizona, what are CDC physical inactivity rates, and Google Trends for 'gym near me' by DMA?",
    description: "KNXV Phoenix — fitness/wellness pitch",
    sources: ["CBP", "CDC", "Trends"],
  },
  {
    text: "Building a storm-season one-pager for a roofing company on WEWS (ABC Cleveland) — recent Ohio FEMA disasters, housing units, HUD rents, and how many real estate and home improvement businesses are in Ohio?",
    description: "WEWS Cleveland — storm-driven advertiser",
    sources: ["FEMA", "Census", "HUD", "CBP"],
  },
];

const NATIONAL_PROMPTS: SalesPrompt[] = [
  {
    text: "Upfront pitch for a national auto brand across Scripps ABC stations (WCPO, WXYZ, KNXV, WFTS, KMGH, WEWS, KTNV) — how many auto dealers are in each state, GDP trend, and Google Trends for 'buy a car' over 5 years?",
    description: "Scripps ABC portfolio — auto upfront",
    sources: ["CBP", "BEA", "Trends"],
  },
  {
    text: "A national insurance carrier wants Scripps' Florida stations (WFTS Tampa, WPTV West Palm, WSFL Miami) — FEMA disaster history, number of insurance agencies in FL, and Google Trends for 'home insurance' by DMA",
    description: "Scripps Florida cluster — insurance",
    sources: ["FEMA", "CBP", "Trends"],
  },
  {
    text: "Rank all Scripps DMA markets — compare population, median income, GDP, and number of business establishments for Cincinnati, Tampa, Denver, Nashville, Phoenix, Detroit, Cleveland, Milwaukee, Las Vegas, and West Palm Beach",
    description: "Scripps portfolio market ranking",
    sources: ["Census", "BEA", "CBP"],
  },
  {
    text: "A CPG brand wants Scripps Midwest (WCPO Cincinnati, WXYZ Detroit, WEWS Cleveland, WTMJ Milwaukee) — how many grocery stores are in each state, CPI for food, and Google Trends for 'grocery deals' across those markets?",
    description: "Scripps Midwest cluster — CPG pitch",
    sources: ["CBP", "BLS", "Trends"],
  },
  {
    text: "A pharma company wants Scripps NBC stations (WPTV, WTMJ, WBAY Green Bay) — show me CDC obesity and diabetes rates, number of pharmacies by state, median age, and Google Trends for 'weight loss' by state",
    description: "Scripps NBC portfolio — pharma targeting",
    sources: ["CDC", "CBP", "Census", "Trends"],
  },
  {
    text: "Home improvement pitch across Scripps Sun Belt markets — how many home improvement stores per state, housing stats, HUD rents, and Google Trends for 'home renovation' for Denver, Phoenix, Tampa, Nashville, and Salt Lake City",
    description: "Scripps Sun Belt — home improvement",
    sources: ["CBP", "Census", "HUD", "Trends"],
  },
  {
    text: "Full market scorecard for a national QSR client across all Scripps DMAs — number of restaurants per market, population, income, GDP, employment, CDC health data, HUD rents, FEMA risk, and Google Trends for 'fast food'",
    description: "Scripps full portfolio — all 12 sources",
    sources: ["CBP", "Census", "BEA", "BLS", "CDC", "HUD", "FEMA", "Trends"],
  },
];

interface Props {
  onSelect: (text: string) => void;
}

function SourceBadge({ name }: { name: string }) {
  const colors = SOURCE_COLORS[name] || "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${colors}`}>
      {name}
    </span>
  );
}

function PromptCard({ prompt, onSelect }: { prompt: SalesPrompt; onSelect: (text: string) => void }) {
  return (
    <button
      onClick={() => onSelect(prompt.text)}
      className="text-left p-3 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 transition-all shadow-sm group"
    >
      <p className="text-sm text-gray-800 group-hover:text-blue-700 leading-snug">{prompt.text}</p>
      <div className="flex items-center gap-2 mt-1.5">
        <p className="text-xs text-gray-400">{prompt.description}</p>
        <div className="flex gap-1 ml-auto flex-shrink-0">
          {prompt.sources.map(s => (
            <SourceBadge key={s} name={s} />
          ))}
        </div>
      </div>
    </button>
  );
}

export function SalesPrompts({ onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto mt-8">
      {/* Local Market Intelligence */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Local Market Intelligence</h3>
        </div>
        <div className="flex flex-col gap-2">
          {LOCAL_PROMPTS.map((p, i) => (
            <PromptCard key={i} prompt={p} onSelect={onSelect} />
          ))}
        </div>
      </div>

      {/* National Strategy */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">National Strategy</h3>
        </div>
        <div className="flex flex-col gap-2">
          {NATIONAL_PROMPTS.map((p, i) => (
            <PromptCard key={i} prompt={p} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}
