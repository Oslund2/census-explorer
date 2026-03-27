import Anthropic from "@anthropic-ai/sdk";

const CENSUS_API_BASE = "https://api.census.gov/data";

const SYSTEM_PROMPT = `You are Census Explorer, an AI assistant that helps users explore U.S. Census Bureau data through natural language.

You handle ALL of these use cases:
1. **Data Queries**: "What's the population of Austin, TX?" → Look up data and return results with charts.
2. **Comparisons**: "Compare Denver and Portland on income" → Fetch data for multiple geographies, return side-by-side.
3. **Site Selection**: "Find cities over 100k with high income" → Search broadly, filter, rank results.
4. **General Chat**: Answer Census-related questions conversationally.
5. **Reports**: "Generate a report for California" → Fetch comprehensive demographic data.

## Tools Available
You have tools to query the Census Bureau API directly:
- census_fetch: Fetch data from any Census dataset with specific variables and geography filters.
- census_geo_lookup: Look up FIPS codes for geographic areas.

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
- Keep text concise but informative.`;

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
      "Search for a geographic area's FIPS code by name. Queries the Census API to find matching geographies. Use this when you need to find the FIPS code for a city, county, or state.",
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
];

async function callCensusTool(
  name: string,
  input: Record<string, unknown>,
  apiKey: string
): Promise<string> {
  if (name === "census_fetch") {
    const { dataset, year, variables, for_clause, in_clause } = input as {
      dataset: string;
      year: number;
      variables: string;
      for_clause: string;
      in_clause?: string;
    };

    let url = `${CENSUS_API_BASE}/${year}/${dataset}?get=${variables}&for=${for_clause}&key=${apiKey}`;
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
      url = `${CENSUS_API_BASE}/2022/acs/acs5?get=NAME&for=state:*&key=${apiKey}`;
    } else if (geo_type === "place" && state_fips) {
      url = `${CENSUS_API_BASE}/2022/acs/acs5?get=NAME&for=place:*&in=state:${state_fips}&key=${apiKey}`;
    } else if (geo_type === "county" && state_fips) {
      url = `${CENSUS_API_BASE}/2022/acs/acs5?get=NAME&for=county:*&in=state:${state_fips}&key=${apiKey}`;
    } else if (geo_type === "county") {
      url = `${CENSUS_API_BASE}/2022/acs/acs5?get=NAME&for=county:*&key=${apiKey}`;
    } else {
      return JSON.stringify({ error: "state_fips required for place/county lookup" });
    }

    const res = await fetch(url);
    if (!res.ok) {
      return JSON.stringify({ error: `Census API returned ${res.status}` });
    }
    const data: string[][] = await res.json();

    // Filter by name (case-insensitive partial match)
    const matches = data
      .slice(1)
      .filter((row) => row[0]?.toLowerCase().includes(geoName.toLowerCase()))
      .slice(0, 10);

    return JSON.stringify({ headers: data[0], matches });
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

  // Create a readable stream for SSE
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

          // Process content blocks
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

              const result = await callCensusTool(
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

          // Continue conversation with tool results
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
