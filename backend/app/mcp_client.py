import os
import json
import logging
from contextlib import AsyncExitStack
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from .config import settings

logger = logging.getLogger(__name__)


class MCPClient:
    """Singleton MCP client that manages the Census MCP server subprocess."""

    def __init__(self):
        self.session: ClientSession | None = None
        self._exit_stack: AsyncExitStack | None = None
        self._tools_cache: list[dict] | None = None

    async def connect(self):
        """Connect to the Census MCP server via stdio."""
        mcp_path = settings.mcp_server_path
        if not mcp_path:
            # Default: look for census-mcp in project root
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            mcp_path = os.path.join(project_root, "census-mcp", "mcp-server", "dist", "index.js")

        if not os.path.exists(mcp_path):
            logger.warning(f"MCP server not found at {mcp_path}. Running in mock mode.")
            return

        server_params = StdioServerParameters(
            command="node",
            args=[mcp_path],
            env={
                **os.environ,
                "CENSUS_API_KEY": settings.census_api_key,
                "DATABASE_URL": os.environ.get(
                    "DATABASE_URL",
                    "postgres://census:census@localhost:5432/census_mcp"
                ),
            },
        )

        self._exit_stack = AsyncExitStack()
        stdio_transport = await self._exit_stack.enter_async_context(
            stdio_client(server_params)
        )
        read_stream, write_stream = stdio_transport
        self.session = await self._exit_stack.enter_async_context(
            ClientSession(read_stream, write_stream)
        )
        await self.session.initialize()
        logger.info("MCP client connected to Census MCP server")

    async def disconnect(self):
        """Disconnect from the MCP server."""
        if self._exit_stack:
            await self._exit_stack.aclose()
            self.session = None
            self._exit_stack = None
            self._tools_cache = None
            logger.info("MCP client disconnected")

    async def list_tools(self) -> list[dict]:
        """Get available tools in Anthropic API format."""
        if self._tools_cache:
            return self._tools_cache

        if not self.session:
            return []

        result = await self.session.list_tools()
        self._tools_cache = [
            {
                "name": tool.name,
                "description": tool.description or "",
                "input_schema": tool.inputSchema,
            }
            for tool in result.tools
        ]
        logger.info(f"Loaded {len(self._tools_cache)} MCP tools: {[t['name'] for t in self._tools_cache]}")
        return self._tools_cache

    async def call_tool(self, name: str, arguments: dict) -> str:
        """Call an MCP tool and return the result as a string."""
        if not self.session:
            return json.dumps({"error": "MCP server not connected"})

        logger.info(f"Calling MCP tool: {name} with args: {json.dumps(arguments)[:200]}")
        result = await self.session.call_tool(name, arguments)

        # Extract text content from result
        texts = []
        for content in result.content:
            if hasattr(content, "text"):
                texts.append(content.text)
        return "\n".join(texts) if texts else json.dumps({"result": "empty"})


# Singleton instance
mcp_client = MCPClient()
