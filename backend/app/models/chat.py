from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    disabled_sources: list[str] = []


class PromptBuilderRequest(BaseModel):
    client_name: str
    client_type: str
    location: str
    notes: str = ""


class PromptBuilderRequest(BaseModel):
    client_name: str
    client_type: str
    location: str
    notes: str = ""
