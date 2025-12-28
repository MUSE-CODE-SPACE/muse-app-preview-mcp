#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Preview set interface
interface PreviewSet {
  id: string;
  screenshotPath: string;
  title: string;
  subtitle: string;
  deviceType?: string;
  paletteId?: string;
  createdAt: string;
}

interface PreviewStore {
  previews: PreviewSet[];
  settings: {
    defaultDeviceType: string;
    defaultPaletteId: string;
    outputDirectory: string;
  };
}

// Storage path
const STORE_PATH = path.join(
  process.env.HOME || "~",
  ".muse-app-preview",
  "previews.json"
);

const APP_BUNDLE_ID = "musepreviewmaker.loro";

// Ensure storage directory exists
function ensureStorageDir(): void {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Load preview store
function loadStore(): PreviewStore {
  ensureStorageDir();
  if (fs.existsSync(STORE_PATH)) {
    const data = fs.readFileSync(STORE_PATH, "utf-8");
    return JSON.parse(data);
  }
  return {
    previews: [],
    settings: {
      defaultDeviceType: "iphone_6_7",
      defaultPaletteId: "ocean",
      outputDirectory: path.join(process.env.HOME || "~", "Desktop", "Previews"),
    },
  };
}

// Save preview store
function saveStore(store: PreviewStore): void {
  ensureStorageDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

// Generate unique ID
function generateId(): string {
  return `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Tool definitions
const tools: Tool[] = [
  {
    name: "add_preview",
    description:
      "Add a new preview set with screenshot, title, and subtitle. The screenshot will be used to generate an app store preview image.",
    inputSchema: {
      type: "object",
      properties: {
        screenshotPath: {
          type: "string",
          description: "Absolute path to the screenshot image file",
        },
        title: {
          type: "string",
          description: "Main title text for the preview (e.g., 'Amazing Feature')",
        },
        subtitle: {
          type: "string",
          description: "Subtitle text for the preview (e.g., 'Discover new possibilities')",
        },
        deviceType: {
          type: "string",
          description: "Device type (iphone_6_7, iphone_6_5, ipad_12_9, etc.). Optional.",
        },
        paletteId: {
          type: "string",
          description: "Color palette ID (ocean, sunset, forest, etc.). Optional.",
        },
      },
      required: ["screenshotPath", "title", "subtitle"],
    },
  },
  {
    name: "list_previews",
    description: "List all saved preview sets with their details.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "remove_preview",
    description: "Remove a specific preview set by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ID of the preview to remove",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "update_preview",
    description: "Update an existing preview set.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ID of the preview to update",
        },
        title: {
          type: "string",
          description: "New title (optional)",
        },
        subtitle: {
          type: "string",
          description: "New subtitle (optional)",
        },
        screenshotPath: {
          type: "string",
          description: "New screenshot path (optional)",
        },
        deviceType: {
          type: "string",
          description: "New device type (optional)",
        },
        paletteId: {
          type: "string",
          description: "New palette ID (optional)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "clear_all",
    description: "Clear all saved preview sets.",
    inputSchema: {
      type: "object",
      properties: {
        confirm: {
          type: "boolean",
          description: "Must be true to confirm clearing all previews",
        },
      },
      required: ["confirm"],
    },
  },
  {
    name: "open_app",
    description:
      "Open MUSE Preview Maker app. If previews are saved, they will be loaded automatically.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "generate_previews",
    description:
      "Generate all preview images using MUSE Preview Maker. The app will process all saved preview sets and export them.",
    inputSchema: {
      type: "object",
      properties: {
        outputDirectory: {
          type: "string",
          description: "Directory to save generated previews. Optional.",
        },
        exportAllSizes: {
          type: "boolean",
          description: "Export all device sizes for each preview. Default: false.",
        },
      },
    },
  },
  {
    name: "get_settings",
    description: "Get current settings (default device type, palette, output directory).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "update_settings",
    description: "Update default settings.",
    inputSchema: {
      type: "object",
      properties: {
        defaultDeviceType: {
          type: "string",
          description: "Default device type for new previews",
        },
        defaultPaletteId: {
          type: "string",
          description: "Default color palette for new previews",
        },
        outputDirectory: {
          type: "string",
          description: "Default output directory for generated previews",
        },
      },
    },
  },
];

// Tool handlers
async function handleAddPreview(args: {
  screenshotPath: string;
  title: string;
  subtitle: string;
  deviceType?: string;
  paletteId?: string;
}): Promise<string> {
  // Validate screenshot exists
  if (!fs.existsSync(args.screenshotPath)) {
    return JSON.stringify({
      success: false,
      error: `Screenshot not found: ${args.screenshotPath}`,
    });
  }

  const store = loadStore();
  const preview: PreviewSet = {
    id: generateId(),
    screenshotPath: args.screenshotPath,
    title: args.title,
    subtitle: args.subtitle,
    deviceType: args.deviceType || store.settings.defaultDeviceType,
    paletteId: args.paletteId || store.settings.defaultPaletteId,
    createdAt: new Date().toISOString(),
  };

  store.previews.push(preview);
  saveStore(store);

  return JSON.stringify({
    success: true,
    message: `Preview added successfully`,
    preview: preview,
    totalPreviews: store.previews.length,
  });
}

async function handleListPreviews(): Promise<string> {
  const store = loadStore();
  return JSON.stringify({
    success: true,
    count: store.previews.length,
    previews: store.previews.map((p, index) => ({
      index: index + 1,
      id: p.id,
      title: p.title,
      subtitle: p.subtitle,
      screenshotPath: p.screenshotPath,
      deviceType: p.deviceType,
      paletteId: p.paletteId,
      createdAt: p.createdAt,
    })),
  });
}

async function handleRemovePreview(args: { id: string }): Promise<string> {
  const store = loadStore();
  const index = store.previews.findIndex((p) => p.id === args.id);

  if (index === -1) {
    return JSON.stringify({
      success: false,
      error: `Preview not found: ${args.id}`,
    });
  }

  const removed = store.previews.splice(index, 1)[0];
  saveStore(store);

  return JSON.stringify({
    success: true,
    message: `Preview removed`,
    removed: removed,
    remainingPreviews: store.previews.length,
  });
}

async function handleUpdatePreview(args: {
  id: string;
  title?: string;
  subtitle?: string;
  screenshotPath?: string;
  deviceType?: string;
  paletteId?: string;
}): Promise<string> {
  const store = loadStore();
  const preview = store.previews.find((p) => p.id === args.id);

  if (!preview) {
    return JSON.stringify({
      success: false,
      error: `Preview not found: ${args.id}`,
    });
  }

  if (args.title) preview.title = args.title;
  if (args.subtitle) preview.subtitle = args.subtitle;
  if (args.screenshotPath) {
    if (!fs.existsSync(args.screenshotPath)) {
      return JSON.stringify({
        success: false,
        error: `Screenshot not found: ${args.screenshotPath}`,
      });
    }
    preview.screenshotPath = args.screenshotPath;
  }
  if (args.deviceType) preview.deviceType = args.deviceType;
  if (args.paletteId) preview.paletteId = args.paletteId;

  saveStore(store);

  return JSON.stringify({
    success: true,
    message: `Preview updated`,
    preview: preview,
  });
}

async function handleClearAll(args: { confirm: boolean }): Promise<string> {
  if (!args.confirm) {
    return JSON.stringify({
      success: false,
      error: "Please set confirm: true to clear all previews",
    });
  }

  const store = loadStore();
  const count = store.previews.length;
  store.previews = [];
  saveStore(store);

  return JSON.stringify({
    success: true,
    message: `Cleared ${count} preview(s)`,
  });
}

async function handleOpenApp(): Promise<string> {
  try {
    // Export previews for the app to load
    const store = loadStore();
    const exportPath = path.join(
      process.env.HOME || "~",
      ".muse-app-preview",
      "pending-previews.json"
    );
    fs.writeFileSync(exportPath, JSON.stringify(store.previews, null, 2));

    // Try to open the app
    await execAsync(`open -b ${APP_BUNDLE_ID}`);

    return JSON.stringify({
      success: true,
      message: "MUSE Preview Maker opened",
      previewsLoaded: store.previews.length,
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Failed to open app: ${error}`,
      hint: "Make sure MUSE Preview Maker is installed",
    });
  }
}

async function handleGeneratePreviews(args: {
  outputDirectory?: string;
  exportAllSizes?: boolean;
}): Promise<string> {
  const store = loadStore();

  if (store.previews.length === 0) {
    return JSON.stringify({
      success: false,
      error: "No previews to generate. Add some previews first.",
    });
  }

  const outputDir = args.outputDirectory || store.settings.outputDirectory;

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Export previews for the app
  const exportPath = path.join(
    process.env.HOME || "~",
    ".muse-app-preview",
    "pending-previews.json"
  );

  const exportData = {
    previews: store.previews,
    options: {
      outputDirectory: outputDir,
      exportAllSizes: args.exportAllSizes || false,
      autoGenerate: true,
    },
  };

  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

  try {
    // Open the app with generate flag
    await execAsync(`open -b ${APP_BUNDLE_ID} --args --generate`);

    return JSON.stringify({
      success: true,
      message: `Generation started for ${store.previews.length} preview(s)`,
      outputDirectory: outputDir,
      previews: store.previews.map((p) => ({
        title: p.title,
        subtitle: p.subtitle,
      })),
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Failed to start generation: ${error}`,
    });
  }
}

async function handleGetSettings(): Promise<string> {
  const store = loadStore();
  return JSON.stringify({
    success: true,
    settings: store.settings,
  });
}

async function handleUpdateSettings(args: {
  defaultDeviceType?: string;
  defaultPaletteId?: string;
  outputDirectory?: string;
}): Promise<string> {
  const store = loadStore();

  if (args.defaultDeviceType) {
    store.settings.defaultDeviceType = args.defaultDeviceType;
  }
  if (args.defaultPaletteId) {
    store.settings.defaultPaletteId = args.defaultPaletteId;
  }
  if (args.outputDirectory) {
    store.settings.outputDirectory = args.outputDirectory;
  }

  saveStore(store);

  return JSON.stringify({
    success: true,
    message: "Settings updated",
    settings: store.settings,
  });
}

// Main server setup
const server = new Server(
  {
    name: "muse-app-preview-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  let result: string;

  switch (name) {
    case "add_preview":
      result = await handleAddPreview(args as any);
      break;
    case "list_previews":
      result = await handleListPreviews();
      break;
    case "remove_preview":
      result = await handleRemovePreview(args as any);
      break;
    case "update_preview":
      result = await handleUpdatePreview(args as any);
      break;
    case "clear_all":
      result = await handleClearAll(args as any);
      break;
    case "open_app":
      result = await handleOpenApp();
      break;
    case "generate_previews":
      result = await handleGeneratePreviews(args as any);
      break;
    case "get_settings":
      result = await handleGetSettings();
      break;
    case "update_settings":
      result = await handleUpdateSettings(args as any);
      break;
    default:
      result = JSON.stringify({ error: `Unknown tool: ${name}` });
  }

  return {
    content: [{ type: "text", text: result }],
  };
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MUSE App Preview MCP server started");
}

main().catch(console.error);
