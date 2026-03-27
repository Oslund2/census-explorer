import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .mcp_client import mcp_client
from .routes import chat, report

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: connect MCP. Shutdown: disconnect."""
    logger.info("Starting Census Explorer backend...")
    try:
        await mcp_client.connect()
        tools = await mcp_client.list_tools()
        logger.info(f"MCP connected with {len(tools)} tools")
    except Exception as e:
        logger.warning(f"MCP connection failed (will run without Census tools): {e}")
    yield
    logger.info("Shutting down...")
    await mcp_client.disconnect()


app = FastAPI(title="Census Explorer", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(report.router)


@app.get("/api/health")
async def health():
    connected = mcp_client.session is not None
    tools = await mcp_client.list_tools() if connected else []
    return {
        "status": "ok",
        "mcp_connected": connected,
        "tools": [t["name"] for t in tools],
    }
