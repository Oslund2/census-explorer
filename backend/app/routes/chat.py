import json
import logging
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from anthropic import AsyncAnthropic
from ..models.chat import ChatRequest, PromptBuilderRequest
from ..claude import stream_orchestrate
from ..config import settings
from .. import direct_tools

logger = logging.getLogger(__name__)
router = APIRouter()

_prompt_client = AsyncAnthropic(api_key=settings.anthropic_api_key)

PROMPT_BUILDER_SYSTEM = """You are a prompt engineering assistant for Market Connect, an AI sales intelligence platform used by TV advertising account executives.

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

Return ONLY the JSON, no other text."""


@router.post("/api/prompt-builder")
async def prompt_builder(request: PromptBuilderRequest):
    """Generate 3 tailored research prompts based on client info."""
    user_msg = (
        f"Client Name: {request.client_name}\n"
        f"Client Type/Industry: {request.client_type}\n"
        f"Location/Region: {request.location}\n"
    )
    if request.notes:
        user_msg += f"Additional Context: {request.notes}\n"

    response = await _prompt_client.messages.create(
        model=settings.model,
        max_tokens=2048,
        system=PROMPT_BUILDER_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
    )

    text = response.content[0].text.strip()
    # Strip markdown fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    text = text.strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        logger.error(f"Prompt builder JSON parse error: {text[:200]}")
        data = {"prompts": [], "error": "Failed to generate prompts"}

    return data


@router.post("/api/chat")
async def chat(request: ChatRequest):
    """SSE streaming chat endpoint. Returns text/event-stream."""
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    async def event_generator():
        try:
            async for event in stream_orchestrate(messages):
                data = json.dumps(event)
                yield f"data: {data}\n\n"
        except Exception as e:
            logger.error(f"Chat stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
