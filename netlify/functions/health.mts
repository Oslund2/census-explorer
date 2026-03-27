export default async () => {
  const sources = [
    {
      id: "anthropic",
      name: "Claude AI",
      description: "AI analysis & general knowledge",
      connected: !!process.env.ANTHROPIC_API_KEY,
    },
    {
      id: "census_acs",
      name: "Census ACS",
      description: "American Community Survey demographics",
      connected: !!process.env.CENSUS_API_KEY,
    },
    {
      id: "census_geo",
      name: "Census Geography",
      description: "FIPS code resolution",
      connected: !!process.env.CENSUS_API_KEY,
    },
    {
      id: "bls",
      name: "BLS",
      description: "Bureau of Labor Statistics employment data",
      connected: !!process.env.BLS_API_KEY,
    },
    {
      id: "fred",
      name: "FRED",
      description: "Federal Reserve economic data",
      connected: !!process.env.FRED_API_KEY,
    },
    {
      id: "bea",
      name: "BEA",
      description: "Bureau of Economic Analysis — GDP & personal income",
      connected: !!process.env.BEA_API_KEY,
    },
    {
      id: "cbp",
      name: "Business Patterns",
      description: "Establishments & employees by industry",
      connected: !!process.env.CENSUS_API_KEY,
    },
    {
      id: "cdc",
      name: "CDC PLACES",
      description: "County health data — obesity, diabetes, smoking",
      connected: true,
    },
    {
      id: "google_trends",
      name: "Google Trends",
      description: "Search interest trends & regional demand",
      connected: true,
    },
    {
      id: "hud",
      name: "HUD",
      description: "Housing & Urban Development data",
      connected: !!process.env.HUD_API_KEY,
    },
    {
      id: "fema",
      name: "FEMA",
      description: "Disaster & emergency data",
      connected: true,
    },
    {
      id: "fcc",
      name: "FCC",
      description: "TV stations & DMA market data",
      connected: true,
    },
  ];

  return new Response(
    JSON.stringify({
      status: "ok",
      mcp_connected: false,
      tools: [],
      sources,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
};

export const config = {
  path: "/api/health",
};
