from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    census_api_key: str = ""
    mcp_server_path: str = ""  # Path to Census MCP server dist/index.js
    model: str = "claude-sonnet-4-20250514"

    class Config:
        env_file = str(Path(__file__).resolve().parent.parent.parent / ".env")


settings = Settings()
