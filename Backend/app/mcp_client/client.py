"""Long-lived MCP client that spawns the resume MCP server over stdio."""
import sys
from contextlib import AsyncExitStack

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from app.core.config import BASE_DIR


class ResumeMCPClient:
    def __init__(self) -> None:
        self._stack = AsyncExitStack()
        self.session: ClientSession | None = None
        self.tools: list[dict] = []

    async def start(self) -> None:
        params = StdioServerParameters(
            command=sys.executable,
            args=["-m", "app.mcp_server.server"],
            cwd=str(BASE_DIR),
        )
        read, write = await self._stack.enter_async_context(stdio_client(params))
        self.session = await self._stack.enter_async_context(ClientSession(read, write))
        await self.session.initialize()
        listed = await self.session.list_tools()
        self.tools = [
            {"name": t.name, "description": t.description or "", "input_schema": t.inputSchema}
            for t in listed.tools
        ]

    async def call_tool(self, name: str, args: dict) -> str:
        assert self.session, "MCP client not started"
        result = await self.session.call_tool(name, args)
        text = "\n".join(c.text for c in result.content if getattr(c, "text", None))
        return ("Error: " + text) if result.isError else text

    async def stop(self) -> None:
        await self._stack.aclose()
