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
  deviceId?: string;  // Changed from deviceType to match App's CodingKeys
  paletteId?: string;
  createdAt: string;
}

interface PreviewStore {
  previews: PreviewSet[];
  settings: {
    defaultDeviceType: string;
    defaultPaletteId: string;
    outputDirectory: string;
    language: string; // "ko", "en", "ja", "zh", etc.
  };
}

// Storage paths
const STORE_PATH = path.join(
  process.env.HOME || "~",
  ".muse-app-preview",
  "previews.json"
);

const SCREENSHOTS_DIR = path.join(
  process.env.HOME || "~",
  ".muse-app-preview",
  "screenshots"
);

const APP_BUNDLE_ID = "musepreviewmaker.loro";

// Ensure storage directory exists
function ensureStorageDir(): void {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Ensure screenshots directory exists
function ensureScreenshotsDir(): void {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
}

// Load preview store
function loadStore(): PreviewStore {
  ensureStorageDir();
  if (fs.existsSync(STORE_PATH)) {
    const data = fs.readFileSync(STORE_PATH, "utf-8");
    const store = JSON.parse(data);
    // Ensure language setting exists for older stores
    if (!store.settings.language) {
      store.settings.language = "ko";
    }
    return store;
  }
  return {
    previews: [],
    settings: {
      defaultDeviceType: "iphone_6_7",
      defaultPaletteId: "ocean",
      outputDirectory: path.join(process.env.HOME || "~", "Desktop", "Previews"),
      language: "ko", // Korean by default
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
    name: "create_app_previews",
    description:
      "Complete workflow to create App Store preview images. Steps: 1) User selects platform (iOS/macOS/watchOS), 2) User selects language, 3) Claude generates marketing text, 4) Auto-capture screenshots, 5) Send to MUSE Preview Maker app or save to folder.",
    inputSchema: {
      type: "object",
      properties: {
        bundleId: {
          type: "string",
          description: "Bundle ID of the app to capture",
        },
        appName: {
          type: "string",
          description: "Name of the app (for generating marketing text)",
        },
        appDescription: {
          type: "string",
          description: "Brief description of what the app does (helps Claude generate better text)",
        },
        platform: {
          type: "string",
          enum: ["ios", "macos", "watchos"],
          description: "Target platform",
        },
        language: {
          type: "string",
          enum: ["ko", "en", "ja", "zh", "es", "fr", "de"],
          description: "Language for preview text (ko=Korean, en=English, etc.)",
        },
        screenCount: {
          type: "number",
          description: "Number of screens to capture. Default: 3",
        },
        previews: {
          type: "array",
          description: "Array of preview definitions with title/subtitle. If not provided, Claude should generate these.",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              subtitle: { type: "string" },
              paletteId: { type: "string" },
            },
          },
        },
        simulatorUDID: {
          type: "string",
          description: "Specific simulator UDID for iOS/watchOS. Optional.",
        },
      },
      required: ["bundleId", "appName", "platform", "language"],
    },
  },
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
        deviceId: {
          type: "string",
          description: "Device ID (iphone_6_7, iphone_6_5, ipad_12_9, mac_retina, etc.). Optional.",
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
        deviceId: {
          type: "string",
          description: "New device ID (optional)",
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
        language: {
          type: "string",
          description: "Language for preview text (ko, en, ja, zh, etc.)",
        },
      },
    },
  },
  {
    name: "capture_simulator",
    description:
      "Capture a screenshot from the running iOS Simulator and add it as a preview set. Claude can use this to automatically capture app screens and generate marketing text.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Main title text for the preview (e.g., 'Easy Login')",
        },
        subtitle: {
          type: "string",
          description: "Subtitle text for the preview (e.g., 'Get started in seconds')",
        },
        deviceId: {
          type: "string",
          description: "Device ID (iphone_6_7, iphone_6_5, ipad_12_9, mac_retina, etc.). Optional.",
        },
        paletteId: {
          type: "string",
          description: "Color palette ID (ocean, sunset, forest, etc.). Optional.",
        },
        simulatorUDID: {
          type: "string",
          description: "Specific simulator UDID to capture from. Optional, uses booted simulator by default.",
        },
      },
      required: ["title", "subtitle"],
    },
  },
  {
    name: "list_simulators",
    description: "List all booted iOS Simulators that can be captured.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "reset_all",
    description:
      "Complete reset: clears all previews, screenshots, and pending data. Use this before starting a fresh preview session.",
    inputSchema: {
      type: "object",
      properties: {
        confirm: {
          type: "boolean",
          description: "Must be true to confirm reset",
        },
      },
      required: ["confirm"],
    },
  },
  {
    name: "launch_and_capture",
    description:
      "Launch an app and capture screenshot. Auto-detects platform (iOS simulator or macOS). For iOS, launches in simulator and captures. For macOS, launches app and captures window.",
    inputSchema: {
      type: "object",
      properties: {
        bundleId: {
          type: "string",
          description: "Bundle ID of the app (e.g., 'com.example.myapp')",
        },
        title: {
          type: "string",
          description: "Title text for the preview",
        },
        subtitle: {
          type: "string",
          description: "Subtitle text for the preview",
        },
        platform: {
          type: "string",
          enum: ["ios", "macos", "auto"],
          description: "Platform: 'ios' for simulator, 'macos' for Mac app, 'auto' to detect. Default: auto",
        },
        waitSeconds: {
          type: "number",
          description: "Seconds to wait after launch before capture. Default: 3",
        },
        simulatorUDID: {
          type: "string",
          description: "Specific iOS simulator UDID. Optional.",
        },
        paletteId: {
          type: "string",
          description: "Color palette ID. Optional.",
        },
        deviceId: {
          type: "string",
          description: "Device ID for preview (iphone_6_7, mac_retina, etc.). Auto-detected if not specified.",
        },
      },
      required: ["bundleId", "title", "subtitle"],
    },
  },
  {
    name: "capture_app_screens",
    description:
      "Capture multiple screens from a running app. Auto-detects platform. Launches app, captures first screen, then captures additional screens with wait intervals.",
    inputSchema: {
      type: "object",
      properties: {
        bundleId: {
          type: "string",
          description: "Bundle ID of the app",
        },
        screens: {
          type: "array",
          description: "Array of screens to capture with titles",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              subtitle: { type: "string" },
              paletteId: { type: "string" },
              waitSeconds: { type: "number" },
            },
          },
        },
        platform: {
          type: "string",
          enum: ["ios", "macos", "auto"],
          description: "Platform: 'ios', 'macos', or 'auto'. Default: auto",
        },
        simulatorUDID: {
          type: "string",
          description: "Specific iOS simulator UDID. Optional.",
        },
      },
      required: ["bundleId", "screens"],
    },
  },
];

// Tool handlers
async function handleAddPreview(args: {
  screenshotPath: string;
  title: string;
  subtitle: string;
  deviceId?: string;
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
    deviceId: args.deviceId || store.settings.defaultDeviceType,
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
      deviceId: p.deviceId,
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
  deviceId?: string;
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
  if (args.deviceId) preview.deviceId = args.deviceId;
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
  // Export previews for the app to load
  const store = loadStore();
  const dataDir = path.join(process.env.HOME || "~", ".muse-app-preview");
  const exportPath = path.join(dataDir, "pending-previews.json");

  ensureStorageDir();
  fs.writeFileSync(exportPath, JSON.stringify(store.previews, null, 2));

  // Try to open the app
  try {
    await execAsync(`open -b ${APP_BUNDLE_ID}`);

    return JSON.stringify({
      success: true,
      message: "MUSE Preview Maker opened",
      previewsLoaded: store.previews.length,
      dataFolder: dataDir,
    });
  } catch (error) {
    // App not installed - open folder instead
    await execAsync(`open "${dataDir}"`);

    return JSON.stringify({
      success: true,
      appInstalled: false,
      message: "MUSE Preview Maker app is not installed. Preview data has been saved.",
      hint: "Install MUSE Preview Maker app to generate beautiful App Store preview images with this data.",
      dataFolder: dataDir,
      filesCreated: ["pending-previews.json"],
      previewCount: store.previews.length,
    });
  }
}

async function handleGeneratePreviews(args: {
  outputDirectory?: string;
  exportAllSizes?: boolean;
}): Promise<string> {
  const store = loadStore();
  const dataDir = path.join(process.env.HOME || "~", ".muse-app-preview");

  if (store.previews.length === 0) {
    return JSON.stringify({
      success: false,
      error: "No previews to generate. Add some previews first.",
    });
  }

  const outputDir = args.outputDirectory || store.settings.outputDirectory;

  // Ensure directories exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  ensureStorageDir();

  // Export previews for the app
  const exportPath = path.join(dataDir, "pending-previews.json");

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
      dataFolder: dataDir,
      previews: store.previews.map((p) => ({
        title: p.title,
        subtitle: p.subtitle,
      })),
    });
  } catch (error) {
    // App not installed - open data folder instead
    await execAsync(`open "${dataDir}"`);

    return JSON.stringify({
      success: true,
      appInstalled: false,
      message: "MUSE Preview Maker app is not installed. Preview data has been saved and folder opened.",
      hint: "Install MUSE Preview Maker app to automatically generate beautiful App Store preview images.",
      dataFolder: dataDir,
      outputDirectory: outputDir,
      filesCreated: ["pending-previews.json"],
      previewCount: store.previews.length,
      previews: store.previews.map((p) => ({
        title: p.title,
        subtitle: p.subtitle,
      })),
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
  language?: string;
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
  if (args.language) {
    store.settings.language = args.language;
  }

  saveStore(store);

  return JSON.stringify({
    success: true,
    message: "Settings updated",
    settings: store.settings,
  });
}

// Helper to get booted simulators (iOS/iPadOS only, prioritized)
async function getBootedSimulators(): Promise<Array<{
  name: string;
  udid: string;
  runtime: string;
}>> {
  const { stdout } = await execAsync("xcrun simctl list devices booted -j");
  const data = JSON.parse(stdout);
  const bootedDevices: Array<{ name: string; udid: string; runtime: string; priority: number }> = [];

  for (const [runtime, devices] of Object.entries(data.devices)) {
    // Only include iOS/iPadOS simulators (skip watchOS, tvOS, visionOS)
    if (!runtime.toLowerCase().includes("ios")) {
      continue;
    }

    const deviceList = devices as Array<{ name: string; udid: string; state: string }>;
    for (const device of deviceList) {
      if (device.state === "Booted") {
        const runtimeMatch = runtime.match(/iOS[- ](\d+[.-]\d+)/i);
        const runtimeVersion = runtimeMatch
          ? `iOS ${runtimeMatch[1].replace("-", ".")}`
          : runtime;

        // Priority: iPhone Pro Max > iPhone Pro > iPhone > iPad
        let priority = 0;
        const name = device.name.toLowerCase();
        if (name.includes("iphone") && name.includes("pro max")) priority = 4;
        else if (name.includes("iphone") && name.includes("pro")) priority = 3;
        else if (name.includes("iphone")) priority = 2;
        else if (name.includes("ipad")) priority = 1;

        bootedDevices.push({
          name: device.name,
          udid: device.udid,
          runtime: runtimeVersion,
          priority,
        });
      }
    }
  }

  // Sort by priority (highest first)
  bootedDevices.sort((a, b) => b.priority - a.priority);

  // Remove priority field before returning
  return bootedDevices.map(({ name, udid, runtime }) => ({ name, udid, runtime }));
}

// Map simulator name to deviceId
function mapSimulatorToDeviceId(simulatorName: string): string {
  const name = simulatorName.toLowerCase();

  // iPhone mappings
  if (name.includes("iphone 15 pro max") || name.includes("iphone 16 pro max")) return "iphone_6_7";
  if (name.includes("iphone 15 pro") || name.includes("iphone 16 pro")) return "iphone_6_1_pro";
  if (name.includes("iphone 15 plus") || name.includes("iphone 16 plus")) return "iphone_6_7";
  if (name.includes("iphone 15") || name.includes("iphone 16")) return "iphone_6_1";
  if (name.includes("iphone 14 pro max")) return "iphone_6_7";
  if (name.includes("iphone 14 pro")) return "iphone_6_1_pro";
  if (name.includes("iphone 14 plus")) return "iphone_6_7";
  if (name.includes("iphone 14")) return "iphone_6_1";
  if (name.includes("iphone se")) return "iphone_5_5";

  // iPad mappings
  if (name.includes("ipad pro 12.9") || name.includes("ipad pro (12.9")) return "ipad_12_9";
  if (name.includes("ipad pro 11") || name.includes("ipad pro (11")) return "ipad_11";
  if (name.includes("ipad air")) return "ipad_10_9";
  if (name.includes("ipad mini")) return "ipad_8_3";
  if (name.includes("ipad")) return "ipad_10_9";

  // Default to iPhone 6.7"
  return "iphone_6_7";
}

async function handleCaptureSimulator(args: {
  title: string;
  subtitle: string;
  deviceId?: string;
  paletteId?: string;
  simulatorUDID?: string;
}): Promise<string> {
  try {
    ensureScreenshotsDir();

    // First, detect which simulators are running
    let bootedSimulators: Array<{ name: string; udid: string; runtime: string }> = [];
    try {
      bootedSimulators = await getBootedSimulators();
    } catch (e) {
      // Ignore error, will check later
    }

    if (bootedSimulators.length === 0) {
      return JSON.stringify({
        success: false,
        error: "No iOS Simulator is running",
        hint: "Please launch an iOS Simulator first using Xcode or 'xcrun simctl boot <device>'",
      });
    }

    // Determine which simulator to capture
    let targetSimulator: { name: string; udid: string; runtime: string } | undefined;

    if (args.simulatorUDID) {
      // Use specified simulator
      targetSimulator = bootedSimulators.find(s => s.udid === args.simulatorUDID);
      if (!targetSimulator) {
        return JSON.stringify({
          success: false,
          error: `Simulator with UDID ${args.simulatorUDID} is not booted`,
          bootedSimulators: bootedSimulators,
        });
      }
    } else {
      // Use first booted simulator (most recently interacted one is usually first)
      targetSimulator = bootedSimulators[0];
    }

    // Generate unique filename with simulator info
    const timestamp = Date.now();
    const safeName = targetSimulator.name.replace(/[^a-zA-Z0-9]/g, "_");
    const screenshotPath = path.join(
      SCREENSHOTS_DIR,
      `screenshot_${safeName}_${timestamp}.png`
    );

    // Capture screenshot from the specific simulator
    try {
      await execAsync(
        `xcrun simctl io ${targetSimulator.udid} screenshot "${screenshotPath}"`
      );
    } catch (captureError: any) {
      return JSON.stringify({
        success: false,
        error: `Failed to capture from ${targetSimulator.name}: ${captureError.message}`,
      });
    }

    // Verify screenshot was created
    if (!fs.existsSync(screenshotPath)) {
      return JSON.stringify({
        success: false,
        error: "Failed to capture screenshot",
      });
    }

    // Auto-detect deviceId based on simulator name if not specified
    const autoDeviceId = mapSimulatorToDeviceId(targetSimulator.name);

    // Add to preview store
    const store = loadStore();
    const preview: PreviewSet = {
      id: generateId(),
      screenshotPath: screenshotPath,
      title: args.title,
      subtitle: args.subtitle,
      deviceId: args.deviceId || autoDeviceId,  // Use auto-detected deviceId
      paletteId: args.paletteId || store.settings.defaultPaletteId,
      createdAt: new Date().toISOString(),
    };

    store.previews.push(preview);
    saveStore(store);

    return JSON.stringify({
      success: true,
      message: `Screenshot captured from ${targetSimulator.name}`,
      capturedFrom: {
        name: targetSimulator.name,
        udid: targetSimulator.udid,
        runtime: targetSimulator.runtime,
      },
      autoDetectedDeviceId: autoDeviceId,
      preview: preview,
      totalPreviews: store.previews.length,
      otherBootedSimulators: bootedSimulators.length > 1
        ? bootedSimulators.filter(s => s.udid !== targetSimulator!.udid)
        : undefined,
    });
  } catch (error: any) {
    return JSON.stringify({
      success: false,
      error: `Failed to capture simulator: ${error.message}`,
      hint: "Make sure Xcode Command Line Tools are installed and a simulator is running",
    });
  }
}

async function handleListSimulators(): Promise<string> {
  try {
    const { stdout } = await execAsync(
      "xcrun simctl list devices booted -j"
    );
    const data = JSON.parse(stdout);

    const bootedDevices: Array<{
      name: string;
      udid: string;
      runtime: string;
    }> = [];

    for (const [runtime, devices] of Object.entries(data.devices)) {
      const deviceList = devices as Array<{
        name: string;
        udid: string;
        state: string;
      }>;
      for (const device of deviceList) {
        if (device.state === "Booted") {
          // Extract iOS version from runtime string
          const runtimeMatch = runtime.match(/iOS[- ](\d+[.-]\d+)/i);
          const runtimeVersion = runtimeMatch
            ? `iOS ${runtimeMatch[1].replace("-", ".")}`
            : runtime;

          bootedDevices.push({
            name: device.name,
            udid: device.udid,
            runtime: runtimeVersion,
          });
        }
      }
    }

    if (bootedDevices.length === 0) {
      return JSON.stringify({
        success: true,
        count: 0,
        message: "No simulators are currently running",
        hint: "Launch a simulator using Xcode or 'xcrun simctl boot <device>'",
        simulators: [],
      });
    }

    return JSON.stringify({
      success: true,
      count: bootedDevices.length,
      simulators: bootedDevices,
    });
  } catch (error: any) {
    return JSON.stringify({
      success: false,
      error: `Failed to list simulators: ${error.message}`,
      hint: "Make sure Xcode Command Line Tools are installed",
    });
  }
}

// Helper: Sleep function
function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

// Helper: Check if app is running in simulator
async function isAppRunning(simulatorUDID: string, bundleId: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `xcrun simctl spawn ${simulatorUDID} launchctl list | grep ${bundleId}`
    );
    return stdout.includes(bundleId);
  } catch {
    return false;
  }
}

// Helper: Detect platform for bundle ID
async function detectPlatform(bundleId: string): Promise<"ios" | "macos" | null> {
  // Check if app exists on macOS
  try {
    const { stdout } = await execAsync(`mdfind "kMDItemCFBundleIdentifier == '${bundleId}'" | head -1`);
    if (stdout.trim()) {
      return "macos";
    }
  } catch {
    // Not found on macOS
  }

  // Check if app exists on any booted iOS simulator
  try {
    const simulators = await getBootedSimulators();
    for (const sim of simulators) {
      try {
        await execAsync(`xcrun simctl get_app_container ${sim.udid} ${bundleId}`);
        return "ios";
      } catch {
        // Not on this simulator
      }
    }
  } catch {
    // No simulators or error
  }

  return null;
}

// Helper: Capture macOS app window
async function captureMacOSWindow(bundleId: string, outputPath: string): Promise<boolean> {
  try {
    // Get window ID for the app
    const { stdout: windowInfo } = await execAsync(`
      osascript -e 'tell application "System Events" to get id of first window of (first process whose bundle identifier is "${bundleId}")'
    `);

    const windowId = windowInfo.trim();
    if (windowId) {
      // Capture specific window by ID
      await execAsync(`screencapture -l ${windowId} -o "${outputPath}"`);
      return fs.existsSync(outputPath);
    }
  } catch {
    // Fallback: capture by app name
  }

  // Fallback: use screencapture with window selection
  try {
    // Bring app to front and capture
    await execAsync(`osascript -e 'tell application id "${bundleId}" to activate'`);
    await sleep(0.5);

    // Capture the frontmost window
    await execAsync(`screencapture -o -w "${outputPath}"`);
    return fs.existsSync(outputPath);
  } catch (error) {
    return false;
  }
}

// Track launched simulator for this session
let lastLaunchedSimulator: { udid: string; name: string; bundleId: string } | null = null;

// Handler: Complete reset
async function handleResetAll(args: { confirm: boolean }): Promise<string> {
  if (!args.confirm) {
    return JSON.stringify({
      success: false,
      error: "Please set confirm: true to reset all data",
    });
  }

  try {
    const dataDir = path.join(process.env.HOME || "~", ".muse-app-preview");

    // Count what we're deleting
    let screenshotCount = 0;
    let previewCount = 0;

    // Clear screenshots
    if (fs.existsSync(SCREENSHOTS_DIR)) {
      const files = fs.readdirSync(SCREENSHOTS_DIR);
      screenshotCount = files.length;
      for (const file of files) {
        fs.unlinkSync(path.join(SCREENSHOTS_DIR, file));
      }
    }

    // Clear previews
    const store = loadStore();
    previewCount = store.previews.length;
    store.previews = [];
    saveStore(store);

    // Clear pending previews
    const pendingPath = path.join(dataDir, "pending-previews.json");
    if (fs.existsSync(pendingPath)) {
      fs.unlinkSync(pendingPath);
    }

    return JSON.stringify({
      success: true,
      message: "Complete reset done",
      deleted: {
        screenshots: screenshotCount,
        previews: previewCount,
      },
    });
  } catch (error: any) {
    return JSON.stringify({
      success: false,
      error: `Reset failed: ${error.message}`,
    });
  }
}

// Handler: Launch app and capture (supports iOS and macOS)
async function handleLaunchAndCapture(args: {
  bundleId: string;
  title: string;
  subtitle: string;
  platform?: "ios" | "macos" | "auto";
  waitSeconds?: number;
  simulatorUDID?: string;
  paletteId?: string;
  deviceId?: string;
}): Promise<string> {
  try {
    ensureScreenshotsDir();

    const waitTime = args.waitSeconds || 3;
    const timestamp = Date.now();
    const safeBundleId = args.bundleId.replace(/[^a-zA-Z0-9]/g, "_");

    // Determine platform
    let platform = args.platform || "auto";
    if (platform === "auto") {
      const detected = await detectPlatform(args.bundleId);
      if (!detected) {
        return JSON.stringify({
          success: false,
          error: `App not found: ${args.bundleId}`,
          hint: "Make sure the app is installed on macOS or iOS simulator",
        });
      }
      platform = detected;
    }

    let screenshotPath: string;
    let deviceId: string;
    let captureInfo: any = {};

    if (platform === "macos") {
      // === macOS App Capture ===
      screenshotPath = path.join(SCREENSHOTS_DIR, `${safeBundleId}_mac_${timestamp}.png`);

      // Launch macOS app
      try {
        await execAsync(`open -b "${args.bundleId}"`);
      } catch (launchError: any) {
        return JSON.stringify({
          success: false,
          error: `Failed to launch macOS app: ${launchError.message}`,
          bundleId: args.bundleId,
        });
      }

      // Wait for app to load
      await sleep(waitTime);

      // Capture window
      const captured = await captureMacOSWindow(args.bundleId, screenshotPath);
      if (!captured) {
        return JSON.stringify({
          success: false,
          error: "Failed to capture macOS window",
          hint: "Make sure the app has a visible window",
        });
      }

      deviceId = args.deviceId || "mac_retina";
      captureInfo = { platform: "macos" };

    } else {
      // === iOS Simulator Capture ===
      const bootedSimulators = await getBootedSimulators();
      if (bootedSimulators.length === 0) {
        return JSON.stringify({
          success: false,
          error: "No iOS Simulator is running",
          hint: "Please launch an iOS Simulator first",
        });
      }

      // Find target simulator
      let targetSimulator = args.simulatorUDID
        ? bootedSimulators.find(s => s.udid === args.simulatorUDID)
        : null;

      // If not specified, find simulator that has the app installed
      if (!targetSimulator) {
        for (const sim of bootedSimulators) {
          try {
            await execAsync(`xcrun simctl get_app_container ${sim.udid} ${args.bundleId}`);
            targetSimulator = sim;
            break;
          } catch {
            // App not on this simulator
          }
        }
      }

      // Fallback to first simulator
      if (!targetSimulator) {
        targetSimulator = bootedSimulators[0];
      }

      screenshotPath = path.join(SCREENSHOTS_DIR, `${safeBundleId}_ios_${timestamp}.png`);

      // Terminate app first (clean state)
      try {
        await execAsync(`xcrun simctl terminate ${targetSimulator.udid} ${args.bundleId}`);
        await sleep(0.5);
      } catch {
        // App might not be running
      }

      // Launch the app
      try {
        await execAsync(`xcrun simctl launch ${targetSimulator.udid} ${args.bundleId}`);
      } catch (launchError: any) {
        return JSON.stringify({
          success: false,
          error: `Failed to launch app: ${launchError.message}`,
          hint: "Make sure the app is installed on the simulator",
          bundleId: args.bundleId,
          simulator: targetSimulator.name,
        });
      }

      // Track this simulator
      lastLaunchedSimulator = {
        udid: targetSimulator.udid,
        name: targetSimulator.name,
        bundleId: args.bundleId,
      };

      // Wait for app to load
      await sleep(waitTime);

      // Capture screenshot from specific simulator
      await execAsync(`xcrun simctl io ${targetSimulator.udid} screenshot "${screenshotPath}"`);

      if (!fs.existsSync(screenshotPath)) {
        return JSON.stringify({
          success: false,
          error: "Screenshot capture failed",
        });
      }

      deviceId = args.deviceId || mapSimulatorToDeviceId(targetSimulator.name);
      captureInfo = {
        platform: "ios",
        simulator: {
          name: targetSimulator.name,
          udid: targetSimulator.udid,
        },
      };
    }

    // Add to preview store
    const store = loadStore();
    const preview: PreviewSet = {
      id: generateId(),
      screenshotPath: screenshotPath,
      title: args.title,
      subtitle: args.subtitle,
      deviceId: deviceId,
      paletteId: args.paletteId || store.settings.defaultPaletteId,
      createdAt: new Date().toISOString(),
    };

    store.previews.push(preview);
    saveStore(store);

    return JSON.stringify({
      success: true,
      message: `App launched and captured (${platform}): ${args.bundleId}`,
      ...captureInfo,
      waitedSeconds: waitTime,
      preview: preview,
      totalPreviews: store.previews.length,
    });
  } catch (error: any) {
    return JSON.stringify({
      success: false,
      error: `Launch and capture failed: ${error.message}`,
    });
  }
}

// Handler: Capture multiple app screens
async function handleCaptureAppScreens(args: {
  bundleId: string;
  screens: Array<{
    title: string;
    subtitle: string;
    paletteId?: string;
    waitSeconds?: number;
  }>;
  simulatorUDID?: string;
}): Promise<string> {
  try {
    ensureScreenshotsDir();

    if (!args.screens || args.screens.length === 0) {
      return JSON.stringify({
        success: false,
        error: "No screens defined to capture",
      });
    }

    // Get target simulator
    const bootedSimulators = await getBootedSimulators();
    if (bootedSimulators.length === 0) {
      return JSON.stringify({
        success: false,
        error: "No iOS Simulator is running",
      });
    }

    let targetSimulator = args.simulatorUDID
      ? bootedSimulators.find(s => s.udid === args.simulatorUDID)
      : bootedSimulators[0];

    if (!targetSimulator) {
      return JSON.stringify({
        success: false,
        error: "Specified simulator not found",
      });
    }

    // Terminate and relaunch app for clean state
    try {
      await execAsync(`xcrun simctl terminate ${targetSimulator.udid} ${args.bundleId}`);
      await sleep(0.5);
    } catch {
      // App might not be running
    }

    await execAsync(`xcrun simctl launch ${targetSimulator.udid} ${args.bundleId}`);
    await sleep(2); // Initial load time

    const store = loadStore();
    const autoDeviceId = mapSimulatorToDeviceId(targetSimulator.name);
    const capturedPreviews: PreviewSet[] = [];

    // Capture each screen
    for (let i = 0; i < args.screens.length; i++) {
      const screen = args.screens[i];

      // Wait before capture (allows for navigation between screens)
      const waitTime = screen.waitSeconds || 2;
      if (i > 0) {
        await sleep(waitTime);
      }

      // Capture
      const timestamp = Date.now();
      const safeBundleId = args.bundleId.replace(/[^a-zA-Z0-9]/g, "_");
      const screenshotPath = path.join(
        SCREENSHOTS_DIR,
        `${safeBundleId}_screen${i + 1}_${timestamp}.png`
      );

      await execAsync(
        `xcrun simctl io ${targetSimulator.udid} screenshot "${screenshotPath}"`
      );

      if (fs.existsSync(screenshotPath)) {
        const preview: PreviewSet = {
          id: generateId(),
          screenshotPath: screenshotPath,
          title: screen.title,
          subtitle: screen.subtitle,
          deviceId: autoDeviceId,
          paletteId: screen.paletteId || store.settings.defaultPaletteId,
          createdAt: new Date().toISOString(),
        };

        store.previews.push(preview);
        capturedPreviews.push(preview);
      }
    }

    saveStore(store);

    return JSON.stringify({
      success: true,
      message: `Captured ${capturedPreviews.length} screens from ${args.bundleId}`,
      simulator: {
        name: targetSimulator.name,
        udid: targetSimulator.udid,
      },
      previews: capturedPreviews,
      totalPreviews: store.previews.length,
    });
  } catch (error: any) {
    return JSON.stringify({
      success: false,
      error: `Capture app screens failed: ${error.message}`,
    });
  }
}

// Handler: Complete workflow to create app previews
async function handleCreateAppPreviews(args: {
  bundleId: string;
  appName: string;
  appDescription?: string;
  platform: "ios" | "macos" | "watchos";
  language: string;
  screenCount?: number;
  previews?: Array<{ title: string; subtitle: string; paletteId?: string }>;
  simulatorUDID?: string;
}): Promise<string> {
  try {
    ensureScreenshotsDir();

    const screenCount = args.screenCount || 3;
    const palettes = ["ocean", "sunset", "forest", "lavender", "coral"];

    // Step 1: Reset existing data
    const dataDir = path.join(process.env.HOME || "~", ".muse-app-preview");
    if (fs.existsSync(SCREENSHOTS_DIR)) {
      const files = fs.readdirSync(SCREENSHOTS_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(SCREENSHOTS_DIR, file));
      }
    }
    const store = loadStore();
    store.previews = [];
    saveStore(store);

    // Step 2: Determine device ID based on platform
    let deviceId: string;
    let captureMethod: "simulator" | "macos" | "watch";

    switch (args.platform) {
      case "macos":
        deviceId = "mac_retina";
        captureMethod = "macos";
        break;
      case "watchos":
        deviceId = "watch_45mm";
        captureMethod = "watch";
        break;
      default:
        deviceId = "iphone_6_7";
        captureMethod = "simulator";
    }

    // Step 3: Prepare preview definitions
    const previewDefs = args.previews || [];

    // If previews not provided, this will be empty and Claude should fill them
    if (previewDefs.length === 0) {
      return JSON.stringify({
        success: false,
        needsInput: true,
        message: "Please provide preview titles and subtitles",
        hint: `Generate ${screenCount} marketing phrases for ${args.appName} in ${args.language}`,
        template: {
          previews: Array.from({ length: screenCount }, (_, i) => ({
            title: `[Title ${i + 1}]`,
            subtitle: `[Subtitle ${i + 1}]`,
            paletteId: palettes[i % palettes.length],
          })),
        },
        appInfo: {
          name: args.appName,
          description: args.appDescription,
          platform: args.platform,
          language: args.language,
        },
      });
    }

    // Step 4: Capture screenshots based on platform
    const capturedPreviews: PreviewSet[] = [];

    if (captureMethod === "macos") {
      // macOS capture
      try {
        await execAsync(`open -b "${args.bundleId}"`);
      } catch {
        return JSON.stringify({
          success: false,
          error: `App not found: ${args.bundleId}`,
          hint: "Make sure the macOS app is installed",
        });
      }

      await sleep(3);

      for (let i = 0; i < previewDefs.length; i++) {
        const def = previewDefs[i];
        const timestamp = Date.now();
        const screenshotPath = path.join(SCREENSHOTS_DIR, `mac_${i + 1}_${timestamp}.png`);

        const captured = await captureMacOSWindow(args.bundleId, screenshotPath);
        if (captured) {
          const preview: PreviewSet = {
            id: generateId(),
            screenshotPath,
            title: def.title,
            subtitle: def.subtitle,
            deviceId,
            paletteId: def.paletteId || palettes[i % palettes.length],
            createdAt: new Date().toISOString(),
          };
          store.previews.push(preview);
          capturedPreviews.push(preview);
        }

        if (i < previewDefs.length - 1) {
          await sleep(2);
        }
      }
    } else {
      // iOS/watchOS simulator capture
      const bootedSimulators = await getBootedSimulators();
      if (bootedSimulators.length === 0) {
        return JSON.stringify({
          success: false,
          error: "No iOS Simulator is running",
          hint: "Please launch an iOS Simulator first",
        });
      }

      // Find appropriate simulator
      let targetSimulator = args.simulatorUDID
        ? bootedSimulators.find(s => s.udid === args.simulatorUDID)
        : null;

      if (!targetSimulator) {
        for (const sim of bootedSimulators) {
          try {
            await execAsync(`xcrun simctl get_app_container ${sim.udid} ${args.bundleId}`);
            targetSimulator = sim;
            break;
          } catch {}
        }
      }

      if (!targetSimulator) {
        targetSimulator = bootedSimulators[0];
      }

      // Launch app
      try {
        await execAsync(`xcrun simctl terminate ${targetSimulator.udid} ${args.bundleId}`);
        await sleep(0.5);
      } catch {}

      try {
        await execAsync(`xcrun simctl launch ${targetSimulator.udid} ${args.bundleId}`);
      } catch (e: any) {
        return JSON.stringify({
          success: false,
          error: `Failed to launch app: ${e.message}`,
          hint: "Make sure the app is installed on the simulator",
        });
      }

      // Track simulator
      lastLaunchedSimulator = {
        udid: targetSimulator.udid,
        name: targetSimulator.name,
        bundleId: args.bundleId,
      };

      await sleep(3);
      deviceId = mapSimulatorToDeviceId(targetSimulator.name);

      for (let i = 0; i < previewDefs.length; i++) {
        const def = previewDefs[i];
        const timestamp = Date.now();
        const screenshotPath = path.join(SCREENSHOTS_DIR, `ios_${i + 1}_${timestamp}.png`);

        await execAsync(`xcrun simctl io ${targetSimulator.udid} screenshot "${screenshotPath}"`);

        if (fs.existsSync(screenshotPath)) {
          const preview: PreviewSet = {
            id: generateId(),
            screenshotPath,
            title: def.title,
            subtitle: def.subtitle,
            deviceId,
            paletteId: def.paletteId || palettes[i % palettes.length],
            createdAt: new Date().toISOString(),
          };
          store.previews.push(preview);
          capturedPreviews.push(preview);
        }

        if (i < previewDefs.length - 1) {
          await sleep(2);
        }
      }
    }

    saveStore(store);

    // Step 5: Send to app or save to folder
    const pendingPath = path.join(dataDir, "pending-previews.json");
    fs.writeFileSync(pendingPath, JSON.stringify({ previews: store.previews }, null, 2));

    let appOpened = false;
    try {
      await execAsync(`open -b ${APP_BUNDLE_ID}`);
      appOpened = true;
    } catch {
      // App not installed
    }

    if (appOpened) {
      return JSON.stringify({
        success: true,
        message: `Created ${capturedPreviews.length} preview(s) and opened MUSE Preview Maker`,
        platform: args.platform,
        language: args.language,
        previews: capturedPreviews.map(p => ({ title: p.title, subtitle: p.subtitle, paletteId: p.paletteId })),
        appOpened: true,
      });
    } else {
      // Open folder instead
      await execAsync(`open "${dataDir}"`);

      return JSON.stringify({
        success: true,
        message: `Created ${capturedPreviews.length} preview(s). MUSE Preview Maker not installed.`,
        platform: args.platform,
        language: args.language,
        previews: capturedPreviews.map(p => ({ title: p.title, subtitle: p.subtitle, paletteId: p.paletteId })),
        appOpened: false,
        dataFolder: dataDir,
        hint: "Install MUSE Preview Maker to generate final images, or use the screenshots directly.",
      });
    }
  } catch (error: any) {
    return JSON.stringify({
      success: false,
      error: `Create app previews failed: ${error.message}`,
    });
  }
}

// Main server setup
const server = new Server(
  {
    name: "muse-app-preview-mcp",
    version: "1.4.0",
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
    case "capture_simulator":
      result = await handleCaptureSimulator(args as any);
      break;
    case "list_simulators":
      result = await handleListSimulators();
      break;
    case "reset_all":
      result = await handleResetAll(args as any);
      break;
    case "launch_and_capture":
      result = await handleLaunchAndCapture(args as any);
      break;
    case "capture_app_screens":
      result = await handleCaptureAppScreens(args as any);
      break;
    case "create_app_previews":
      result = await handleCreateAppPreviews(args as any);
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
