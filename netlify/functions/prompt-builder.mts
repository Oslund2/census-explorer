import Anthropic from "@anthropic-ai/sdk";
import type { Config } from "@netlify/functions";

const PROMPT_BUILDER_SYSTEM = `You are a prompt engineering assistant for Market Connect, an AI sales intelligence platform used by TV advertising account executives.

The AE is prepping for a client meeting and needs data-driven talking points. Based on the client info provided, generate exactly 3 research prompts the AE can run in Market Connect.

Available data sources and what they provide:
- Census ACS: population, median income, median age, education, housing stats by city/county/state
- Census Business Patterns: number of businesses & employees by industry (restaurants, auto dealers, hospitals, etc.)
- BLS: unemployment rate, CPI, wages, employment by sector
- FRED: GDP, housing starts, consumer sentiment, interest rates
- BEA: state/metro GDP, per capita personal income trends
- CDC PLACES: county health data (obesity, diabetes, smoking, depression rates)
- Google Trends: search interest over time and by region/DMA for any keyword
- HUD: fair market rents, income limits by state/county
- FEMA: disaster declarations by state/type/year
- FCC/DMA: TV market rankings, TV households by DMA

For each prompt:
1. Write it as if the AE is talking naturally ("I have a meeting with...")
2. Reference the specific client name, type, and location
3. Request data from 3-5 sources that are most relevant to closing this sale
4. Focus on data that helps the AE understand the client's market and make the business case for advertising

Return valid JSON with this exact structure:
{
  "prompts": [
    {
      "title": "Short title (5-8 words)",
      "prompt": "The full natural-language prompt the AE would run",
      "sources": ["Census", "BLS", "Trends"],
      "rationale": "One sentence on why this data helps close the sale"
    }
  ]
}

Return ONLY the JSON, no other text.`;

export default async (req: Request) => {
  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ prompts: [], error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await req.json();
  const { client_name, client_type, location, notes } = body;

  let userMsg = `Client Name: ${client_name}\nClient Type/Industry: ${client_type}\nLocation/Region: ${location}\n`;
  if (notes) {
    userMsg += `Additional Context: ${notes}\n`;
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: PROMPT_BUILDER_SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });

  let text = (response.content[0] as { type: "text"; text: string }).text.trim();

  // Strip markdown fences if present
  if (text.startsWith("```")) {
    text = text.split("\n").slice(1).join("\n");
  }
  if (text.endsWith("```")) {
    text = text.slice(0, text.lastIndexOf("```")).trim();
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { prompts: [], error: "Failed to generate prompts" };
  }

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
};

export const config: Config = {
  path: "/api/prompt-builder",
};
