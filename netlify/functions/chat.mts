import Anthropic from "@anthropic-ai/sdk";

const CENSUS_API_BASE = "https://api.census.gov/data";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://paiskiyabhmmlckefqoh.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || "";

const SYSTEM_PROMPT = `You are Census Explorer, an AI assistant that helps users explore U.S. Census Bureau data and FCC TV station/market data through natural language.

You handle ALL of these use cases:
1. **Data Queries**: "What's the population of Austin, TX?" → Look up data and return results with charts.
2. **Comparisons**: "Compare Denver and Portland on income" → Fetch data for multiple geographies, return side-by-side.
3. **Site Selection**: "Find cities over 100k with high income" → Search broadly, filter, rank results.
4. **General Chat**: Answer Census-related questions conversationally.
5. **Reports**: "Generate a report for California" → Fetch comprehensive demographic data.
6. **TV Market Analysis**: "What are the demographics of the Cincinnati DMA?" or "Show me stations in the Dallas market" → Look up TV stations, DMA market boundaries, and Census demographics for those markets.

## Tools Available
- census_fetch: Fetch data from any Census dataset with specific variables and geography filters.
- census_geo_lookup: Look up FIPS codes for geographic areas.
- tv_station_search: Search FCC TV stations by callsign, city, state, DMA, or network.
- dma_counties: Get all counties that make up a TV market (DMA), with state/county FIPS codes for Census lookups.
- bls_fetch: Fetch employment/labor data from the Bureau of Labor Statistics API.
- fred_fetch: Fetch economic indicators from the FRED (Federal Reserve Economic Data) API.
- google_trends: Get Google search interest data by keyword and DMA/region.
- summarize_report: Generate an executive summary from collected market data using AI.

## TV Market / DMA Workflow
When a user asks about a TV market or DMA:
1. Use \`dma_counties\` to find all counties in that DMA
2. Use the county FIPS codes + state FIPS codes to query Census data for those counties
3. Aggregate or summarize the Census data across the DMA
4. Use \`tv_station_search\` to show which TV stations serve that market

When a user asks about a TV station (e.g. "WCPO" or "KHOU"):
1. Use \`tv_station_search\` to find the station details
2. Use \`dma_counties\` to find the counties in that station's DMA
3. Pull Census demographics for the market

## Common Census Variables (ACS 5-Year)
- B01003_001E: Total Population
- B19013_001E: Median Household Income
- B25077_001E: Median Home Value
- B15003_022E: Bachelor's Degree holders
- B15003_023E: Master's Degree holders
- B17001_002E: Population below poverty level
- B25064_001E: Median Gross Rent
- B01002_001E: Median Age
- B02001_002E: White alone population
- B02001_003E: Black alone population
- B03003_003E: Hispanic or Latino population
- B23025_005E: Unemployed population
- B23025_002E: Labor force population
- NAME: Geography name

## Geography Codes
- State FIPS: AL=01, AK=02, AZ=04, AR=05, CA=06, CO=08, CT=09, DE=10, FL=12, GA=13, HI=15, ID=16, IL=17, IN=18, IA=19, KS=20, KY=21, LA=22, ME=23, MD=24, MA=25, MI=26, MN=27, MS=28, MO=29, MT=30, NE=31, NV=32, NH=33, NJ=34, NM=35, NY=36, NC=37, ND=38, OH=39, OK=40, OR=41, PA=42, RI=44, SC=45, SD=46, TN=47, TX=48, UT=49, VT=50, VA=51, WA=53, WV=54, WI=55, WY=56
- Use for=state:* for all states, for=county:* in=state:XX for counties in a state
- Use for=place:* in=state:XX for cities/places in a state
- For DMA queries: use for=county:XXX in=state:YY for each county in the DMA

## Response Format
After your text explanation, ALWAYS include a JSON block wrapped in \`\`\`json\`\`\` fences:

\`\`\`json
{
  "charts": [
    {
      "type": "bar|line|pie|doughnut|radar",
      "title": "Chart Title",
      "data": {
        "labels": ["Label1", "Label2"],
        "datasets": [{"label": "Name", "data": [123, 456], "backgroundColor": ["#3B82F6", "#10B981"]}]
      }
    }
  ],
  "tables": [
    {"title": "Table Title", "headers": ["Col1", "Col2"], "rows": [["val1", "val2"]]}
  ],
  "suggestions": [
    "Follow-up question 1?",
    "Follow-up question 2?",
    "Follow-up question 3?"
  ]
}
\`\`\`

Rules:
- Pick chart type based on data shape: single comparison = bar, time series = line, parts of whole = pie, multi-metric = radar.
- Always include 2-3 contextual follow-up suggestions.
- Format currency with $ and commas. Format percentages with %.
- Keep text concise but informative.
- When showing TV station data, include a table with callsign, channel, city, network affiliation, and DMA.
- When showing DMA demographics, aggregate county-level data and present market-level totals.
- When showing BLS or FRED data, present time series as line charts.
- When showing Google Trends data, use bar charts for DMA-level interest comparison.
- For market reports, use the summarize tool to generate executive summaries from collected data.
- When showing FEMA disaster data, use tables with declaration date, type, title, and designated area.
- When showing business patterns data, use bar charts for establishment/employee counts by industry.
- When showing USDA food access data, note food desert status and poverty rates.
- When geocoding, return the matched address, coordinates, and all FIPS codes found.
- Use the HUD crosswalk to bridge ZIP codes to counties/CBSAs when users provide ZIP codes.

## Additional Tools
- fema_disasters: Search FEMA disaster declarations by state, year, or incident type.
- census_geocoder: Convert an address to coordinates + FIPS codes (state, county, tract, block).
- census_business_patterns: Get establishment/employee/payroll counts by industry (NAICS) and geography.
- usda_food_access: Check if a census tract or county is a food desert, get poverty and food access metrics.
- usda_rural_urban: Get rural-urban classification codes for a county.
- hud_crosswalk: Convert between ZIP codes and counties, tracts, CBSAs, or congressional districts.`;

const tools: Anthropic.Tool[] = [
  {
    name: "census_fetch",
    description:
      "Fetch data from the U.S. Census Bureau API. Supports ACS 1-Year, ACS 5-Year, Decennial Census, and other datasets. Returns tabular data with headers and rows.",
    input_schema: {
      type: "object" as const,
      properties: {
        dataset: {
          type: "string",
          description:
            'Dataset path, e.g. "acs/acs5" for ACS 5-Year, "acs/acs1" for ACS 1-Year, "dec/pl" for Decennial PL',
        },
        year: {
          type: "number",
          description: "Data vintage year, e.g. 2022",
        },
        variables: {
          type: "string",
          description:
            'Comma-separated variable codes, e.g. "NAME,B01003_001E,B19013_001E"',
        },
        for_clause: {
          type: "string",
          description:
            'Geography filter, e.g. "state:*" for all states, "place:*" for all places, "county:*" for all counties',
        },
        in_clause: {
          type: "string",
          description:
            'Parent geography filter, e.g. "state:06" for California. Required when querying counties or places within a state.',
        },
      },
      required: ["dataset", "year", "variables", "for_clause"],
    },
  },
  {
    name: "census_geo_lookup",
    description:
      "Search for a geographic area's FIPS code by name. Queries the Census API to find matching geographies.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description:
            'Name of the geographic area to search for, e.g. "Austin", "Denver County"',
        },
        state_fips: {
          type: "string",
          description:
            'State FIPS code to search within, e.g. "48" for Texas. Required for place/county lookups.',
        },
        geo_type: {
          type: "string",
          enum: ["state", "place", "county"],
          description: "Type of geography to search for",
        },
      },
      required: ["name", "geo_type"],
    },
  },
  {
    name: "tv_station_search",
    description:
      "Search the FCC TV station database. Find stations by callsign, city, state, DMA (TV market), or network affiliation. Returns station details including callsign, channel, city, state, DMA, network, licensee, and status.",
    input_schema: {
      type: "object" as const,
      properties: {
        search: {
          type: "string",
          description:
            'General search term - matches callsign, city, DMA name, or network. E.g. "WCPO", "Dallas", "ABC"',
        },
        dma: {
          type: "string",
          description:
            'Filter by DMA/TV market name. E.g. "Cincinnati", "Dallas", "New York"',
        },
        state: {
          type: "string",
          description: 'Filter by state abbreviation. E.g. "OH", "TX", "CA"',
        },
        limit: {
          type: "number",
          description: "Max results to return (default 50)",
        },
      },
    },
  },
  {
    name: "dma_counties",
    description:
      "Get all counties that make up a TV market (DMA/Designated Market Area). Returns county names, state, state FIPS, and county FIPS codes. Use the FIPS codes to query Census data for these counties. This is essential for getting demographics of a TV market.",
    input_schema: {
      type: "object" as const,
      properties: {
        dma_name: {
          type: "string",
          description:
            'Name or partial name of the DMA. E.g. "Cincinnati", "Dallas", "Los Angeles"',
        },
      },
      required: ["dma_name"],
    },
  },
  {
    name: "bls_fetch",
    description:
      "Fetch employment and labor statistics from the Bureau of Labor Statistics (BLS) API. Returns time series data for unemployment rates, employment levels, labor force, wages, and CPI by metro area or state. Common series prefixes: LAUST (state unemployment), LAUMT (metro unemployment), CEU (national employment by industry), CUUR (CPI).",
    input_schema: {
      type: "object" as const,
      properties: {
        series_ids: {
          type: "array" as const,
          items: { type: "string" },
          description:
            'BLS series IDs. E.g. ["LAUST390000000000003"] for Ohio unemployment rate. Metro unemployment: LAUMT{fips}000000003. State unemployment: LAUST{fips}0000000000003.',
        },
        start_year: {
          type: "string",
          description: 'Start year, e.g. "2020"',
        },
        end_year: {
          type: "string",
          description: 'End year, e.g. "2024"',
        },
      },
      required: ["series_ids"],
    },
  },
  {
    name: "fred_fetch",
    description:
      "Fetch economic data from FRED (Federal Reserve Economic Data). Supports GDP, inflation, housing, income, and other indicators at national, state, and metro (MSA) levels. Common series: MEHOINUS (median household income), GDP, UNRATE (unemployment), MORTGAGE30US, CPIAUCSL (CPI). For metro areas, search for series like CINOH (Cincinnati GDP), DALLTX (Dallas), etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        series_id: {
          type: "string",
          description:
            'FRED series ID. E.g. "MEHOINUSOH646N001" for Ohio median income, "GDP" for national GDP, "UNRATE" for unemployment rate.',
        },
        start_date: {
          type: "string",
          description: 'Start date in YYYY-MM-DD format. E.g. "2020-01-01"',
        },
        end_date: {
          type: "string",
          description: 'End date in YYYY-MM-DD format. E.g. "2024-12-31"',
        },
      },
      required: ["series_id"],
    },
  },
  {
    name: "google_trends",
    description:
      "Get Google search interest data for keywords, optionally filtered by DMA (TV market region) or state. Returns interest over time (0-100 scale) and interest by region. Useful for understanding consumer interest and market dynamics. Note: uses an unofficial endpoint and may have rate limits.",
    input_schema: {
      type: "object" as const,
      properties: {
        keyword: {
          type: "string",
          description:
            'Search keyword or phrase. E.g. "streaming services", "electric vehicles", "home buying"',
        },
        geo: {
          type: "string",
          description:
            'Geographic filter. "US" for national, "US-OH" for Ohio, "US-TX" for Texas. Default "US".',
        },
        timeframe: {
          type: "string",
          description:
            'Time range. "today 12-m" for past year, "today 3-m" for 3 months, "2023-01-01 2024-01-01" for custom range. Default "today 12-m".',
        },
      },
      required: ["keyword"],
    },
  },
  {
    name: "summarize_report",
    description:
      "Generate an executive summary from collected market data. Pass in raw data from Census, BLS, FRED, FCC stations, and Google Trends, and this tool will produce a concise market intelligence brief suitable for broadcast executives. Use this after collecting data from other tools.",
    input_schema: {
      type: "object" as const,
      properties: {
        market_name: {
          type: "string",
          description: 'Name of the market. E.g. "Cincinnati, OH DMA"',
        },
        data_points: {
          type: "string",
          description:
            "JSON string containing collected data points to summarize. Include population, income, employment, economic indicators, TV stations, and trends data.",
        },
      },
      required: ["market_name", "data_points"],
    },
  },
  {
    name: "fema_disasters",
    description:
      "Search FEMA disaster declarations by state, year, or incident type. Returns disaster number, declaration date, type (DR=Major Disaster, EM=Emergency, FM=Fire Management), title, designated area, and program flags. No API key needed.",
    input_schema: {
      type: "object" as const,
      properties: {
        state: {
          type: "string",
          description: 'Two-letter state abbreviation. E.g. "CA", "TX", "FL"',
        },
        year: {
          type: "number",
          description: "Filter by declaration year. E.g. 2024",
        },
        incident_type: {
          type: "string",
          description:
            'Filter by incident type. E.g. "Fire", "Hurricane", "Flood", "Tornado", "Severe Storm(s)", "Earthquake"',
        },
        limit: {
          type: "number",
          description: "Max results to return (default 20)",
        },
      },
    },
  },
  {
    name: "census_geocoder",
    description:
      "Convert a street address to geographic coordinates and Census FIPS codes (state, county, tract, block, congressional district, CBSA). Uses the official Census Bureau Geocoder. No API key needed. Useful for bridging an address to Census geography codes for data lookups.",
    input_schema: {
      type: "object" as const,
      properties: {
        address: {
          type: "string",
          description:
            'Full street address. E.g. "1600 Pennsylvania Ave NW, Washington, DC 20500"',
        },
      },
      required: ["address"],
    },
  },
  {
    name: "census_business_patterns",
    description:
      "Fetch County Business Patterns data from the Census Bureau. Returns establishment counts, employee counts, and annual payroll by industry (NAICS code) and geography. Uses the same Census API key. Available geographies: state, county, metro area (MSA), zip code, congressional district.",
    input_schema: {
      type: "object" as const,
      properties: {
        naics: {
          type: "string",
          description:
            'NAICS industry code. E.g. "72" for Accommodation & Food Services, "44-45" for Retail, "51" for Information, "54" for Professional Services. Use "00" for all industries.',
        },
        for_clause: {
          type: "string",
          description:
            'Geography filter. E.g. "county:037" for LA County, "state:06" for California, "metropolitan statistical area/micropolitan statistical area:*" for all metros.',
        },
        in_clause: {
          type: "string",
          description:
            'Parent geography. E.g. "state:06" when querying counties in California.',
        },
        year: {
          type: "number",
          description: "Data year (default 2021). Available: 2019-2021.",
        },
      },
      required: ["naics", "for_clause"],
    },
  },
  {
    name: "usda_food_access",
    description:
      "Check food access and food desert status for census tracts. Returns data from the USDA Food Access Research Atlas including: low income tract flag, low access flags (1mi/10mi and 0.5mi/10mi), poverty rate, median family income, population, and urban/rural flag. Query by FIPS code or get multiple tracts.",
    input_schema: {
      type: "object" as const,
      properties: {
        fips: {
          type: "string",
          description:
            'State+county FIPS code (5 digits) to get all tracts in a county, or full 11-digit tract FIPS. E.g. "06037" for LA County, "06037201100" for a specific tract.',
        },
        limit: {
          type: "number",
          description: "Max results (default 50)",
        },
      },
      required: ["fips"],
    },
  },
  {
    name: "usda_rural_urban",
    description:
      "Get USDA rural-urban classification for a county. Returns Rural-Urban Continuum Code (1=metro 1M+, 9=rural <2,500), Urban Influence Code, metro/micropolitan status, and county typology flags (farming, mining, manufacturing, recreation, retirement dependent). Query by county FIPS code.",
    input_schema: {
      type: "object" as const,
      properties: {
        county_fips: {
          type: "string",
          description:
            'Five-digit county FIPS code. E.g. "06037" for Los Angeles County, "39061" for Hamilton County OH.',
        },
      },
      required: ["county_fips"],
    },
  },
  {
    name: "hud_crosswalk",
    description:
      "Convert between ZIP codes and other geographies using the HUD USPS Crosswalk. Supports: ZIP→Tract, ZIP→County, ZIP→CBSA, ZIP→Congressional District, and reverse lookups (County→ZIP, Tract→ZIP, CBSA→ZIP). Requires HUD_API_KEY environment variable.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "number",
          description:
            "Crosswalk type: 1=ZIP→Tract, 2=ZIP→County, 3=ZIP→CBSA, 4=ZIP→CBSA Div, 5=ZIP→CD, 6=Tract→ZIP, 7=County→ZIP, 8=CBSA→ZIP, 9=CBSA Div→ZIP, 10=CD→ZIP",
        },
        query: {
          type: "string",
          description:
            'The geographic ID to look up. For ZIP lookups: 5-digit ZIP. For reverse: FIPS code or CBSA code. E.g. "22031", "06037", "17140".',
        },
      },
      required: ["type", "query"],
    },
  },
];

async function supabaseQuery(
  table: string,
  params: Record<string, string>
): Promise<any> {
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
    return { error: `Supabase query failed: ${res.status} - ${text}` };
  }
  return res.json();
}

async function callTool(
  name: string,
  input: Record<string, unknown>,
  censusKey: string
): Promise<string> {
  if (name === "census_fetch") {
    const { dataset, year, variables, for_clause, in_clause } = input as {
      dataset: string;
      year: number;
      variables: string;
      for_clause: string;
      in_clause?: string;
    };

    let url = `${CENSUS_API_BASE}/${year}/${dataset}?get=${variables}&for=${for_clause}&key=${censusKey}`;
    if (in_clause) url += `&in=${in_clause}`;

    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      return JSON.stringify({
        error: `Census API returned ${res.status}: ${text}`,
      });
    }
    const data = await res.json();
    return JSON.stringify(data);
  }

  if (name === "census_geo_lookup") {
    const { name: geoName, state_fips, geo_type } = input as {
      name: string;
      state_fips?: string;
      geo_type: string;
    };

    let url: string;
    if (geo_type === "state") {
      url = `${CENSUS_API_BASE}/2022/acs/acs5?get=NAME&for=state:*&key=${censusKey}`;
    } else if (geo_type === "place" && state_fips) {
      url = `${CENSUS_API_BASE}/2022/acs/acs5?get=NAME&for=place:*&in=state:${state_fips}&key=${censusKey}`;
    } else if (geo_type === "county" && state_fips) {
      url = `${CENSUS_API_BASE}/2022/acs/acs5?get=NAME&for=county:*&in=state:${state_fips}&key=${censusKey}`;
    } else if (geo_type === "county") {
      url = `${CENSUS_API_BASE}/2022/acs/acs5?get=NAME&for=county:*&key=${censusKey}`;
    } else {
      return JSON.stringify({
        error: "state_fips required for place/county lookup",
      });
    }

    const res = await fetch(url);
    if (!res.ok) {
      return JSON.stringify({ error: `Census API returned ${res.status}` });
    }
    const data: string[][] = await res.json();

    const matches = data
      .slice(1)
      .filter((row) => row[0]?.toLowerCase().includes(geoName.toLowerCase()))
      .slice(0, 10);

    return JSON.stringify({ headers: data[0], matches });
  }

  if (name === "tv_station_search") {
    const { search, dma, state, limit } = input as {
      search?: string;
      dma?: string;
      state?: string;
      limit?: number;
    };
    const lim = String(limit || 50);
    const params: Record<string, string> = { limit: lim, select: "*" };

    if (search) {
      params.or = `(callsign.ilike.*${search}*,city.ilike.*${search}*,dma_name.ilike.*${search}*,network_affiliation.ilike.*${search}*)`;
    } else if (dma) {
      params.dma_name = `ilike.*${dma}*`;
    } else if (state) {
      params.state = `eq.${state.toUpperCase()}`;
    }

    const data = await supabaseQuery("tv_stations", params);
    return JSON.stringify(data);
  }

  if (name === "dma_counties") {
    const { dma_name } = input as { dma_name: string };
    const data = await supabaseQuery("dma_counties", {
      dma_name: `ilike.*${dma_name}*`,
      select:
        "state,state_abbr,county,county_fips,state_fips,dma_name,msa",
      limit: "200",
    });
    return JSON.stringify(data);
  }

  if (name === "bls_fetch") {
    const { series_ids, start_year, end_year } = input as {
      series_ids: string[];
      start_year?: string;
      end_year?: string;
    };
    const blsKey = process.env.BLS_API_KEY || "";
    const body: Record<string, unknown> = {
      seriesid: series_ids.slice(0, 25),
      startyear: start_year || "2020",
      endyear: end_year || "2024",
    };
    if (blsKey) body.registrationkey = blsKey;

    const res = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return JSON.stringify({ error: `BLS API returned ${res.status}` });
    }
    const data = await res.json();
    return JSON.stringify(data);
  }

  if (name === "fred_fetch") {
    const { series_id, start_date, end_date } = input as {
      series_id: string;
      start_date?: string;
      end_date?: string;
    };
    const fredKey = process.env.FRED_API_KEY || "";
    if (!fredKey) {
      return JSON.stringify({ error: "FRED_API_KEY not configured. FRED data unavailable." });
    }
    let url = `https://api.stlouisfed.org/fred/series/observations?series_id=${series_id}&api_key=${fredKey}&file_type=json`;
    if (start_date) url += `&observation_start=${start_date}`;
    if (end_date) url += `&observation_end=${end_date}`;

    const res = await fetch(url);
    if (!res.ok) {
      return JSON.stringify({ error: `FRED API returned ${res.status}` });
    }
    const data = await res.json();
    // Trim to last 50 observations to keep token usage reasonable
    if (data.observations && data.observations.length > 50) {
      data.observations = data.observations.slice(-50);
    }
    return JSON.stringify(data);
  }

  if (name === "google_trends") {
    const { keyword, geo, timeframe } = input as {
      keyword: string;
      geo?: string;
      timeframe?: string;
    };
    // Use Google Trends unofficial endpoint via a public proxy approach
    // Since there's no stable free API, we return a structured message
    // pointing Claude to use its knowledge + available DMA data
    const geoParam = geo || "US";
    const tfParam = timeframe || "today 12-m";

    // Try the SerpApi if key is available
    const serpKey = process.env.SERPAPI_KEY || "";
    if (serpKey) {
      const params = new URLSearchParams({
        engine: "google_trends",
        q: keyword,
        geo: geoParam,
        date: tfParam,
        api_key: serpKey,
      });
      const res = await fetch(`https://serpapi.com/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        return JSON.stringify(data);
      }
    }

    // Fallback: return guidance for Claude to use its knowledge
    return JSON.stringify({
      note: "Google Trends API key not configured. Using general market knowledge.",
      keyword,
      geo: geoParam,
      timeframe: tfParam,
      suggestion: "Based on your training data, provide estimated search interest trends for this keyword in the specified market. Note that these are approximations.",
    });
  }

  if (name === "fema_disasters") {
    const { state, year, incident_type, limit } = input as {
      state?: string;
      year?: number;
      incident_type?: string;
      limit?: number;
    };
    const filters: string[] = [];
    if (state) filters.push(`state eq '${state.toUpperCase()}'`);
    if (year) filters.push(`declarationDate ge '${year}-01-01T00:00:00.000Z' and declarationDate le '${year}-12-31T23:59:59.000Z'`);
    if (incident_type) filters.push(`incidentType eq '${incident_type}'`);

    const params = new URLSearchParams({
      $top: String(limit || 20),
      $orderby: "declarationDate desc",
      $select: "disasterNumber,state,declarationType,declarationDate,incidentType,declarationTitle,designatedArea,fipsStateCode,fipsCountyCode,paProgramDeclared,hmProgramDeclared,ihProgramDeclared",
    });
    if (filters.length > 0) params.set("$filter", filters.join(" and "));

    const res = await fetch(
      `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?${params}`
    );
    if (!res.ok) {
      return JSON.stringify({ error: `FEMA API returned ${res.status}` });
    }
    const data = await res.json();
    return JSON.stringify(data);
  }

  if (name === "census_geocoder") {
    const { address } = input as { address: string };
    const params = new URLSearchParams({
      address,
      benchmark: "Public_AR_Current",
      vintage: "Current_Current",
      format: "json",
    });
    const res = await fetch(
      `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?${params}`
    );
    if (!res.ok) {
      return JSON.stringify({ error: `Census Geocoder returned ${res.status}` });
    }
    const data = await res.json();
    return JSON.stringify(data);
  }

  if (name === "census_business_patterns") {
    const { naics, for_clause, in_clause, year } = input as {
      naics: string;
      for_clause: string;
      in_clause?: string;
      year?: number;
    };
    const yr = year || 2021;
    let url = `${CENSUS_API_BASE}/${yr}/cbp?get=ESTAB,EMP,PAYANN,NAICS2017&for=${for_clause}&NAICS2017=${naics}&key=${censusKey}`;
    if (in_clause) url += `&in=${in_clause}`;

    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      return JSON.stringify({ error: `Census CBP API returned ${res.status}: ${text}` });
    }
    const data = await res.json();
    return JSON.stringify(data);
  }

  if (name === "usda_food_access") {
    const { fips, limit } = input as { fips: string; limit?: number };
    const lim = limit || 50;
    // Query the USDA Food Access Research Atlas via ArcGIS REST
    let where: string;
    if (fips.length === 5) {
      // County FIPS - match tracts starting with this county
      where = `CensusTract LIKE '${fips}%'`;
    } else if (fips.length === 11) {
      where = `CensusTract = '${fips}'`;
    } else {
      where = `CensusTract LIKE '${fips}%'`;
    }

    const params = new URLSearchParams({
      where,
      outFields: "CensusTract,LILATracts_1And10,LILATracts_halfAnd10,LowIncomeTracts,PovertyRate,MedianFamilyIncome,LA1and10,LAhalfand10,Urban,POP2010,OHU2010,GroupQuartersFlag",
      f: "json",
      resultRecordCount: String(lim),
    });
    const res = await fetch(
      `https://gisportal.ers.usda.gov/server/rest/services/FARA/FARA_2019/MapServer/30/query?${params}`
    );
    if (!res.ok) {
      return JSON.stringify({ error: `USDA Food Access API returned ${res.status}` });
    }
    const data = await res.json();
    // Simplify the ArcGIS response
    const features = (data.features || []).map((f: { attributes: Record<string, unknown> }) => f.attributes);
    return JSON.stringify({ count: features.length, tracts: features });
  }

  if (name === "usda_rural_urban") {
    const { county_fips } = input as { county_fips: string };
    const params = new URLSearchParams({
      where: `FIPSTXT = '${county_fips}'`,
      outFields: "*",
      f: "json",
      resultRecordCount: "1",
    });
    const res = await fetch(
      `https://gisportal.ers.usda.gov/server/rest/services/Rural_Atlas_Data/County_Classifications/MapServer/0/query?${params}`
    );
    if (!res.ok) {
      return JSON.stringify({ error: `USDA Rural-Urban API returned ${res.status}` });
    }
    const data = await res.json();
    const features = (data.features || []).map((f: { attributes: Record<string, unknown> }) => f.attributes);
    return JSON.stringify(features.length > 0 ? features[0] : { error: "County not found" });
  }

  if (name === "hud_crosswalk") {
    const { type, query } = input as { type: number; query: string };
    const hudKey = process.env.HUD_API_KEY || "";
    if (!hudKey) {
      return JSON.stringify({ error: "HUD_API_KEY not configured. HUD crosswalk unavailable." });
    }
    const params = new URLSearchParams({
      type: String(type),
      query,
    });
    const res = await fetch(
      `https://www.huduser.gov/hudapi/public/usps?${params}`,
      {
        headers: { Authorization: `Bearer ${hudKey}` },
      }
    );
    if (!res.ok) {
      return JSON.stringify({ error: `HUD API returned ${res.status}` });
    }
    const data = await res.json();
    return JSON.stringify(data);
  }

  if (name === "summarize_report") {
    const { market_name, data_points } = input as {
      market_name: string;
      data_points: string;
    };
    // Return the data back to Claude for summarization in its response
    return JSON.stringify({
      action: "summarize",
      market: market_name,
      data: data_points,
      instructions: "Generate a concise executive market intelligence brief from this data. Include: Market Overview, Demographics, Economic Health, Media Landscape, and Key Trends. Format for broadcast executives.",
    });
  }

  return JSON.stringify({ error: `Unknown tool: ${name}` });
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const censusKey = process.env.CENSUS_API_KEY;

  if (!anthropicKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500 }
    );
  }

  const { messages } = await req.json();
  const client = new Anthropic({ apiKey: anthropicKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        let currentMessages = messages.map(
          (m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })
        );

        for (let round = 0; round < 10; round++) {
          const response = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            messages: currentMessages,
            tools,
          });

          let hasToolUse = false;
          const toolResults: Array<{
            type: "tool_result";
            tool_use_id: string;
            content: string;
          }> = [];

          for (const block of response.content) {
            if (block.type === "text") {
              sendEvent({ type: "text_delta", text: block.text });
            } else if (block.type === "tool_use") {
              hasToolUse = true;
              sendEvent({ type: "tool_start", name: block.name });

              const result = await callTool(
                block.name,
                block.input as Record<string, unknown>,
                censusKey || ""
              );
              sendEvent({
                type: "tool_result",
                name: block.name,
                result: result.slice(0, 500),
              });

              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: result,
              });
            }
          }

          if (!hasToolUse) {
            sendEvent({ type: "done" });
            controller.close();
            return;
          }

          currentMessages = [
            ...currentMessages,
            { role: "assistant" as const, content: response.content },
            { role: "user" as const, content: toolResults },
          ];
        }

        sendEvent({
          type: "text_delta",
          text: "\n\n*Reached maximum tool rounds.*",
        });
        sendEvent({ type: "done" });
      } catch (err) {
        sendEvent({
          type: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
        sendEvent({ type: "done" });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

export const config = {
  path: "/api/chat",
};
