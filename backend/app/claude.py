import json
import logging
import re
from typing import AsyncGenerator
from anthropic import AsyncAnthropic
from .config import settings
from .mcp_client import mcp_client
from . import direct_tools

logger = logging.getLogger(__name__)

client = AsyncAnthropic(api_key=settings.anthropic_api_key)

SYSTEM_PROMPT_BASE = """You are Market Connect, an AI-powered sales intelligence assistant for TV advertising sales teams. You help account executives prep for client meetings by pulling real-time data from 12 federal and commercial data sources.

## Response Format
After your text explanation, ALWAYS include a JSON block wrapped in ```json``` fences with this structure:

```json
{
  "charts": [
    {
      "type": "bar|line|pie|doughnut|radar",
      "title": "Chart Title",
      "data": {
        "labels": ["Label1", "Label2"],
        "datasets": [
          {
            "label": "Dataset Name",
            "data": [123, 456],
            "backgroundColor": ["#3B82F6", "#10B981"]
          }
        ]
      }
    }
  ],
  "tables": [
    {
      "title": "Table Title",
      "headers": ["Column1", "Column2"],
      "rows": [["val1", "val2"]]
    }
  ],
  "suggestions": [
    "How has this changed over the last decade?",
    "Compare this with the national average",
    "Break this down by age group"
  ]
}
```

Rules:
- Pick chart type based on data: single comparison = bar, time series = line, parts of whole = pie/doughnut, multi-metric comparison = radar.
- Always include 2-3 contextual follow-up suggestions.
- For comparisons, use grouped bar charts (one dataset per geography).
- For reports, include multiple charts covering different demographic areas.
- Format currency values with $ and commas. Format percentages with %.
- If data isn't available or a tool fails, explain what happened and suggest alternatives.
- Keep text explanations concise but informative.
- NEVER simulate or role-play tool calls. Only use tools that are actually provided to you.
"""

TOOL_INSTRUCTIONS = """
You have access to Census Bureau MCP tools that let you query official statistics.

You handle ALL of these use cases from natural language:

1. **Data Queries**: "What's the population of Austin, TX?" → Resolve geography, fetch data, return results.
2. **Comparisons**: "Compare Denver and Portland on income and education" → Fetch data for multiple geographies, return side-by-side.
3. **Site Selection**: "Find cities over 100k with median income above $60k" → Search broadly, filter, rank results.
4. **General Chat**: Answer Census-related questions conversationally.
5. **Reports**: "Generate a report for California" → Fetch comprehensive demographic data (population, age, income, education, housing, poverty).

## Tool Usage Workflow
1. Always call `resolve-geography-fips` first to get FIPS codes for any geography name.
2. Use `list-datasets` or `search-data-tables` to find the right dataset/variables if unsure.
3. Use `fetch-dataset-geography` to check available geography levels.
4. Use `fetch-aggregate-data` to get the actual data.
"""

NO_TOOL_INSTRUCTIONS = """
Census data tools are not currently connected. Answer questions using your built-in knowledge about U.S. Census data and demographics. Be clear that your answers are from general knowledge and may not reflect the latest Census figures. Do NOT simulate or write out fake tool calls.
"""


def _strip_fake_tool_xml(text: str) -> str:
    """Remove simulated tool-call XML that Claude may emit when no tools are provided."""
    # Remove <invoke>...</invoke>, <function_calls>...</function_calls>, etc.
    text = re.sub(
        r"<(?:invoke|function_calls?|function_result|parameter)[^>]*>.*?</(?:invoke|function_calls?|function_result|parameter)>",
        "", text, flags=re.DOTALL,
    )
    # Remove any remaining orphan opening/closing tags from partial chunks
    text = re.sub(
        r"</?(?:invoke|function_calls?|function_result|parameter)[^>]*>",
        "", text,
    )
    return text


SOURCE_TOOL_MAP = {
    "fema": {"fema-disaster-declarations"},
}


async def stream_orchestrate(
    messages: list[dict],
    max_rounds: int = 10,
    disabled_sources: set[str] | None = None,
) -> AsyncGenerator[dict, None]:
    """
    Streaming agentic loop: Claude + MCP tools.
    Yields SSE-compatible event dicts.
    """
    mcp_tools = await mcp_client.list_tools()
    api_tools = direct_tools.get_available_tools()

    # Filter out disabled sources
    if disabled_sources:
        disabled_tool_names: set[str] = set()
        for src in disabled_sources:
            disabled_tool_names.update(SOURCE_TOOL_MAP.get(src, set()))
        api_tools = [t for t in api_tools if t["name"] not in disabled_tool_names]

    direct_tool_names = {t["name"] for t in api_tools}

    # Merge MCP tools + direct API tools
    tools = mcp_tools + api_tools
    system_prompt = SYSTEM_PROMPT_BASE + (TOOL_INSTRUCTIONS if mcp_tools else NO_TOOL_INSTRUCTIONS)
    strip_xml = not tools  # Filter fake tool XML when no real tools

    for round_num in range(max_rounds):
        # Stream Claude's response
        collected_content = []
        current_tool_use = None
        text_buffer = ""  # Buffer for XML filtering

        stream_kwargs = dict(
            model=settings.model,
            max_tokens=8192,
            system=system_prompt,
            messages=messages,
        )
        if tools:
            stream_kwargs["tools"] = tools

        async with client.messages.stream(**stream_kwargs) as stream:
            async for event in stream:
                if event.type == "content_block_start":
                    if event.content_block.type == "text":
                        pass  # Text block starting
                    elif event.content_block.type == "tool_use":
                        current_tool_use = {
                            "id": event.content_block.id,
                            "name": event.content_block.name,
                            "input_json": "",
                        }
                        yield {
                            "type": "tool_start",
                            "name": event.content_block.name,
                        }

                elif event.type == "content_block_delta":
                    if event.delta.type == "text_delta":
                        if strip_xml:
                            text_buffer += event.delta.text
                        else:
                            yield {
                                "type": "text_delta",
                                "text": event.delta.text,
                            }
                    elif event.delta.type == "input_json_delta":
                        if current_tool_use:
                            current_tool_use["input_json"] += event.delta.partial_json

                elif event.type == "content_block_stop":
                    if current_tool_use:
                        collected_content.append({
                            "type": "tool_use",
                            "id": current_tool_use["id"],
                            "name": current_tool_use["name"],
                            "input": json.loads(current_tool_use["input_json"]) if current_tool_use["input_json"] else {},
                        })
                        current_tool_use = None

            # Get the full message for the conversation
            response = await stream.get_final_message()

        # Flush buffered text with XML stripped
        if strip_xml and text_buffer:
            cleaned = _strip_fake_tool_xml(text_buffer)
            # Collapse runs of blank lines left by stripped XML
            cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
            if cleaned.strip():
                yield {"type": "text_delta", "text": cleaned}
            text_buffer = ""

        # Check if we need to execute tools
        tool_use_blocks = [b for b in response.content if b.type == "tool_use"]

        if not tool_use_blocks:
            # No more tools — we're done
            yield {"type": "done"}
            return

        # Execute each tool call
        messages.append({"role": "assistant", "content": response.content})

        tool_results = []
        for tool_block in tool_use_blocks:
            try:
                # Route to direct API handler or MCP
                if tool_block.name in direct_tool_names:
                    result_text = await direct_tools.call_tool(
                        tool_block.name, tool_block.input
                    )
                else:
                    result_text = await mcp_client.call_tool(
                        tool_block.name, tool_block.input
                    )
                yield {
                    "type": "tool_result",
                    "name": tool_block.name,
                    "result": result_text[:500],  # Truncate for SSE display
                }
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_block.id,
                    "content": result_text,
                })
            except Exception as e:
                logger.error(f"Tool {tool_block.name} failed: {e}")
                error_msg = f"Error calling {tool_block.name}: {str(e)}"
                yield {
                    "type": "tool_error",
                    "name": tool_block.name,
                    "error": str(e),
                }
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_block.id,
                    "content": error_msg,
                    "is_error": True,
                })

        messages.append({"role": "user", "content": tool_results})

    # Max rounds reached
    yield {"type": "text_delta", "text": "\n\n*Reached maximum tool call rounds. Please try a simpler query.*"}
    yield {"type": "done"}
