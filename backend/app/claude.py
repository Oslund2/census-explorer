import json
import logging
from typing import AsyncGenerator
from anthropic import AsyncAnthropic
from .config import settings
from .mcp_client import mcp_client

logger = logging.getLogger(__name__)

client = AsyncAnthropic(api_key=settings.anthropic_api_key)

SYSTEM_PROMPT = """You are Census Explorer, an AI assistant that helps users explore U.S. Census Bureau data. You have access to Census Bureau MCP tools that let you query official statistics.

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
"""


async def stream_orchestrate(
    messages: list[dict],
    max_rounds: int = 10,
) -> AsyncGenerator[dict, None]:
    """
    Streaming agentic loop: Claude + MCP tools.
    Yields SSE-compatible event dicts.
    """
    tools = await mcp_client.list_tools()

    for round_num in range(max_rounds):
        # Stream Claude's response
        collected_content = []
        current_tool_use = None

        async with client.messages.stream(
            model=settings.model,
            max_tokens=8192,
            system=SYSTEM_PROMPT,
            messages=messages,
            tools=tools if tools else [],
        ) as stream:
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
