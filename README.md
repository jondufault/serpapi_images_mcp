# serpapi-images-mcp

An MCP server that provides Google Images search via [SerpAPI](https://serpapi.com). Designed for use with Claude and other MCP-compatible AI assistants.

## Tools

### `search_images`

Search Google Images with filtering options for color, size, aspect ratio, type, location, language, safe search, and pagination.

### `fetch_image`

Download an image from a URL, save it to disk, and return it as viewable content.

## Setup

You'll need a [SerpAPI API key](https://serpapi.com/manage-api-key).

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "serpapi-images": {
      "command": "npx",
      "args": ["-y", "serpapi-images-mcp"],
      "env": {
        "SERPAPI_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add serpapi-images -- npx -y serpapi-images-mcp
```

Then set `SERPAPI_API_KEY` in your environment.

### From source

```bash
git clone https://github.com/yourusername/serpapi-images-mcp.git
cd serpapi-images-mcp
npm install
```

## License

MIT
