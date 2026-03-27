import logging
import truststore
truststore.inject_into_ssl()
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .mcp_client import mcp_client
from .routes import chat, report
from . import direct_tools

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


app = FastAPI(title="Market Connect", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(report.router)


# Map MCP tool names to their data source
TOOL_SOURCE_MAP = {
    "fetch-aggregate-data": "Census ACS",
    "fetch-dataset-geography": "Census ACS",
    "list-datasets": "Census ACS",
    "resolve-geography-fips": "Census Geography",
    "search-data-tables": "Census ACS",
}

# All sources the app can use — MCP-backed ones plus always-on ones
ALL_SOURCES = [
    {"id": "anthropic", "name": "Claude AI", "description": "AI analysis & general knowledge"},
    {"id": "census_acs", "name": "Census ACS", "description": "American Community Survey demographics"},
    {"id": "census_geo", "name": "Census Geography", "description": "FIPS code resolution"},
    {"id": "bls", "name": "BLS", "description": "Bureau of Labor Statistics employment data"},
    {"id": "fred", "name": "FRED", "description": "Federal Reserve economic data"},
    {"id": "bea", "name": "BEA", "description": "Bureau of Economic Analysis — GDP & personal income"},
    {"id": "cbp", "name": "Business Patterns", "description": "Establishments & employees by industry"},
    {"id": "cdc", "name": "CDC PLACES", "description": "County health data — obesity, diabetes, smoking"},
    {"id": "google_trends", "name": "Google Trends", "description": "Search interest trends & regional demand"},
    {"id": "hud", "name": "HUD", "description": "Housing & Urban Development data"},
    {"id": "fema", "name": "FEMA", "description": "Disaster & emergency data"},
    {"id": "fcc", "name": "FCC", "description": "TV stations & DMA market data"},
]


@app.get("/api/health")
async def health():
    mcp_connected = mcp_client.session is not None
    tools = await mcp_client.list_tools() if mcp_connected else []
    tool_names = {t["name"] for t in tools}

    # Determine which MCP-backed sources have at least one tool connected
    connected_sources = set()
    for tool_name, source_name in TOOL_SOURCE_MAP.items():
        if tool_name in tool_names:
            connected_sources.add(source_name)

    # Anthropic is connected if the API key is configured
    from .config import settings
    if settings.anthropic_api_key:
        connected_sources.add("Claude AI")

    # Direct API tool status
    api_status = direct_tools.get_source_status()
    for source_id, is_connected in api_status.items():
        if is_connected:
            # Map source_id to display name
            for src in ALL_SOURCES:
                if src["id"] == source_id:
                    connected_sources.add(src["name"])

    sources = []
    for src in ALL_SOURCES:
        sources.append({
            **src,
            "connected": src["name"] in connected_sources,
        })

    return {
        "status": "ok",
        "mcp_connected": mcp_connected,
        "tools": [t["name"] for t in tools],
        "sources": sources,
    }
