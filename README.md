# mcp-college-scorecard

College Scorecard MCP — US Department of Education College Scorecard API

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_schools` | Search US colleges and universities by name. Returns school name, location, tuition, admission rate, student size, median earnings, and completion rate. Example: search_schools("MIT", "MA"). |
| `get_school` | Get detailed info for a specific college by its College Scorecard ID. Returns tuition, admission rate, student size, median earnings after 10 years, completion rate, and median debt. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "college-scorecard": {
      "url": "https://gateway.pipeworx.io/college-scorecard/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about College Scorecard data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
