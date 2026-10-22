// Pure helpers shared by the MCP server (index.ts) and the unit tests (test/).
// Nothing in here touches the filesystem, simulators, or the MCP transport.

// Preview set as stored in ~/.muse-app-preview/previews.json
export interface PreviewSet {
  id: string;
  screenshotPath: string;
  title: string;
  subtitle: string;
  deviceId?: string; // Matches the App's CodingKeys
  paletteId?: string;
  createdAt: string;
}

// Generate unique ID
export function generateId(): string {
  return `preview_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// Map MCP-style device ids (underscore notation) to MUSE Preview Maker 1.1.x
// device ids (dot notation, see DeviceType.allDevices in the app).
// Unknown ids are passed through unchanged so app-native ids keep working.
export const DEVICE_ID_ALIASES: Record<string, string> = {
  iphone_6_9: "iphone_6.9",
  iphone_6_7: "iphone_6.7",
  iphone_6_5: "iphone_6.5",
  iphone_6_3: "iphone_6.3",
  iphone_6_1: "iphone_6.1",
  iphone_6_1_pro: "iphone_6.1",
  iphone_5_5: "iphone_5.5",
  iphone_air: "iphone_air_6.5",
  ipad_12_9: "ipad_12.9",
  ipad_10_9: "ipad_10.9",
  ipad_8_3: "ipad_10.9", // app has no 8.3" canvas; nearest iPad size
};

export function toAppDeviceId(deviceId?: string): string | undefined {
  if (!deviceId) return deviceId;
  return DEVICE_ID_ALIASES[deviceId] ?? deviceId;
}

// Previews as written to pending-previews.json for the app to load
export function exportPreviewsForApp(previews: PreviewSet[]): PreviewSet[] {
  return previews.map((p) => ({ ...p, deviceId: toAppDeviceId(p.deviceId) }));
}

// Map a simulator name (from `xcrun simctl list`) to an MCP device id.
export function mapSimulatorToDeviceId(simulatorName: string): string {
  const name = simulatorName.toLowerCase();

  // iPhone mappings
  if (name.includes("iphone 17 pro max")) return "iphone_6_9";
  if (name.includes("iphone 17 pro")) return "iphone_6_3";
  if (name.includes("iphone 17")) return "iphone_6_3";
  if (name.includes("iphone air")) return "iphone_air";
  if (name.includes("iphone 16 pro max")) return "iphone_6_9";
  if (name.includes("iphone 16 pro")) return "iphone_6_3";
  if (name.includes("iphone 15 pro max")) return "iphone_6_7";
  if (name.includes("iphone 15 pro")) return "iphone_6_1_pro";
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
