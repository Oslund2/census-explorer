/**
 * Netlify Function: Query FCC TV stations and DMA data from Supabase.
 *
 * GET /api/stations?search=WCPO
 * GET /api/stations?dma=Cincinnati
 * GET /api/stations?state=OH
 * GET /api/stations?dma_counties=Cincinnati  (returns counties in a DMA)
 */

const SUPABASE_URL = process.env.SUPABASE_URL || "https://paiskiyabhmmlckefqoh.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || "";

async function supabaseQuery(table: string, params: Record<string, string>): Promise<any> {
  const query = new URLSearchParams(params);
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return res.json();
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const search = url.searchParams.get("search");
  const dma = url.searchParams.get("dma");
  const state = url.searchParams.get("state");
  const dmaCounties = url.searchParams.get("dma_counties");
  const limit = url.searchParams.get("limit") || "100";

  try {
    let data: any;

    if (dmaCounties) {
      // Get all counties in a DMA
      data = await supabaseQuery("dma_counties", {
        dma_name: `ilike.*${dmaCounties}*`,
        select: "state,state_abbr,county,county_fips,state_fips,dma_name,msa",
        limit,
      });
    } else if (search) {
      // Full text search on stations
      data = await supabaseQuery("tv_stations", {
        or: `(callsign.ilike.*${search}*,city.ilike.*${search}*,dma_name.ilike.*${search}*,network_affiliation.ilike.*${search}*)`,
        select: "*",
        limit,
      });
    } else if (dma) {
      // Stations in a DMA
      data = await supabaseQuery("tv_stations", {
        dma_name: `ilike.*${dma}*`,
        select: "*",
        limit,
      });
    } else if (state) {
      // Stations in a state
      data = await supabaseQuery("tv_stations", {
        state: `eq.${state.toUpperCase()}`,
        select: "*",
        limit,
      });
    } else {
      return new Response(
        JSON.stringify({
          error: "Provide ?search=, ?dma=, ?state=, or ?dma_counties= parameter",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config = {
  path: "/api/stations",
};
