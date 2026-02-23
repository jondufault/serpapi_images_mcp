#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;
if (!SERPAPI_API_KEY) {
  console.error("SERPAPI_API_KEY environment variable is required");
  process.exit(1);
}

const server = new McpServer({
  name: "serpapi-images",
  version: "1.1.0",
});

server.tool(
  "search_images",
  "Search Google Images via SerpAPI. Returns image results with titles, sources, thumbnails, original URLs, and dimensions.",
  {
    q: z.string().describe("Search query"),
    limit: z.number().int().min(1).max(100).default(5).describe("Max number of results to return (default 5)"),
    location: z.string().optional().describe("Geographic location for the search"),
    gl: z.string().optional().describe("Country code (e.g. 'us', 'uk')"),
    hl: z.string().optional().describe("Language code (e.g. 'en', 'fr')"),
    imgar: z.enum(["s", "t", "w", "xw"]).optional().describe("Aspect ratio: s=square, t=tall, w=wide, xw=extra wide"),
    imgsz: z.enum(["i", "s", "m", "l", "x"]).optional().describe("Image size: i=icon, s=small, m=medium, l=large, x=extra large"),
    image_color: z
      .enum(["bw", "red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "white", "gray", "black", "brown", "transparent"])
      .optional()
      .describe("Color filter"),
    image_type: z.enum(["face", "photo", "clipart", "lineart", "animated"]).optional().describe("Image type filter"),
    ijn: z.number().int().min(0).max(99).optional().describe("Page number (0-99)"),
    safe: z.enum(["active", "off"]).optional().describe("Safe search setting"),
    license: z
      .enum(["cl", "ol"])
      .optional()
      .describe("Usage rights filter: cl=Creative Commons, ol=commercial & other licenses"),
  },
  async ({ limit, license, ...params }) => {
    const url = new URL("https://serpapi.com/search");
    url.searchParams.set("engine", "google_images");
    url.searchParams.set("api_key", SERPAPI_API_KEY);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    if (license) {
      url.searchParams.set("tbs", `il:${license}`);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      return {
        content: [{ type: "text", text: `SerpAPI error: ${response.status} ${response.statusText}` }],
        isError: true,
      };
    }

    const data = await response.json();

    if (data.error) {
      return {
        content: [{ type: "text", text: `SerpAPI error: ${data.error}` }],
        isError: true,
      };
    }

    const allImages: Array<Record<string, unknown>> = data.images_results ?? [];
    if (allImages.length === 0) {
      return {
        content: [{ type: "text", text: "No image results found." }],
      };
    }

    const images = allImages.slice(0, limit);

    const formatted = images.map((img, i) => {
      const lines = [
        `## ${i + 1}. ${img.title ?? "Untitled"}`,
        `Source: ${img.source ?? "unknown"} — ${img.link ?? ""}`,
        `Thumbnail: ${img.thumbnail ?? "n/a"}`,
        `Original: ${img.original ?? "n/a"}`,
        img.original_width && img.original_height
          ? `Dimensions: ${img.original_width}×${img.original_height}`
          : null,
      ];
      return lines.filter(Boolean).join("\n");
    });

    return {
      content: [
        {
          type: "text",
          text: `Found ${allImages.length} total results, showing top ${images.length} for "${params.q}":\n\n${formatted.join("\n\n")}`,
        },
      ],
    };
  },
);

server.tool(
  "fetch_image",
  "Download an image from a URL and save it to disk. Returns the image as viewable content.",
  {
    url: z.string().url().describe("URL of the image to fetch"),
    save_path: z.string().optional().describe("Absolute file path to save the image (e.g. /tmp/photo.jpg). If omitted, derives filename from URL and saves to /tmp."),
  },
  async ({ url: imageUrl, save_path }) => {
    try {
      const response = await fetch(imageUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        redirect: "follow",
      });

      if (!response.ok) {
        return {
          content: [{ type: "text", text: `Failed to fetch image: ${response.status} ${response.statusText}` }],
          isError: true,
        };
      }

      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      const buffer = Buffer.from(await response.arrayBuffer());

      // Determine save path
      let filePath = save_path;
      if (!filePath) {
        let filename = basename(new URL(imageUrl).pathname) || "image.jpg";
        if (!filename.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)$/i)) {
          const ext = contentType.includes("png") ? ".png" : contentType.includes("gif") ? ".gif" : contentType.includes("webp") ? ".webp" : ".jpg";
          filename += ext;
        }
        filePath = join("/tmp", filename);
      }

      await writeFile(filePath, buffer);

      // Map content type to MCP-supported media type
      const mimeType = contentType.split(";")[0].trim();

      return {
        content: [
          {
            type: "image" as const,
            data: buffer.toString("base64"),
            mimeType,
          },
          {
            type: "text" as const,
            text: `Image saved to ${filePath} (${buffer.length} bytes, ${mimeType})`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error fetching image: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
