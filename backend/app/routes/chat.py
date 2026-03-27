import json
import logging
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from ..models.chat import ChatRequest
from ..claude import stream_orchestrate

logger = logging.getLogger(__name__)
router = APIRouter()


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
