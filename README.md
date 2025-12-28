# MUSE App Preview MCP

[![npm version](https://badge.fury.io/js/muse-app-preview-mcp.svg)](https://www.npmjs.com/package/muse-app-preview-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP (Model Context Protocol) server for managing App Store preview screenshots. Claude can automatically capture simulator screenshots, generate marketing text, and create beautiful preview images.

## Features

| Tool | Description |
|------|-------------|
| `capture_simulator` | **NEW** Capture screenshot from running iOS Simulator and add as preview |
| `list_simulators` | **NEW** List all running iOS Simulators |
| `add_preview` | Add a screenshot with title and subtitle as a preview set |
| `list_previews` | List all saved preview sets |
| `remove_preview` | Remove a specific preview by ID |
| `update_preview` | Update an existing preview set |
| `clear_all` | Clear all saved previews |
| `open_app` | Open MUSE Preview Maker app |
| `generate_previews` | Generate all preview images at once |
| `get_settings` | Get current default settings |
| `update_settings` | Update default device type, palette, output directory |

## Installation

### Using Claude Code

```bash
claude mcp add muse-app-preview-mcp npx muse-app-preview-mcp
```

### Global Installation

```bash
npm install -g muse-app-preview-mcp
```

## Automated Workflow

Just say to Claude:

```
"Create App Store previews for my app"
```

Claude will automatically:
1. Analyze your conversation to identify key features
2. Capture screenshots from the running iOS Simulator
3. Generate marketing titles and subtitles
4. Create beautiful App Store preview images

```
┌─────────────────────────────────────────────────────────────┐
│  Fully Automated Preview Generation                         │
│                                                             │
│  User: "Create App Store previews"                          │
│                                                             │
│  Claude:                                                    │
│    1. Analyzes conversation → "Login, Dashboard, Settings"  │
│    2. Generates marketing text:                             │
│       ├── "Easy Login" / "Get started in seconds"           │
│       ├── "Smart Dashboard" / "Everything at a glance"      │
│       └── "Custom Settings" / "Make it yours"               │
│    3. Captures each screen from Simulator                   │
│    4. Sends to MUSE Preview Maker                           │
│    5. Generates all preview images!                         │
└─────────────────────────────────────────────────────────────┘
```

## Manual Usage

### 1. Capture from Simulator

With your app running in iOS Simulator:

```
capture_simulator:
  title: "Amazing Feature"
  subtitle: "Discover new possibilities"
```

### 2. Add Preview from File

```
add_preview:
  screenshotPath: "/path/to/screenshot.png"
  title: "Amazing Feature"
  subtitle: "Discover new possibilities"
  deviceType: "iphone_6_7"  # optional
  paletteId: "ocean"        # optional
```

### 3. Generate All Previews

```
generate_previews:
  outputDirectory: "/path/to/output"  # optional
  exportAllSizes: true                 # optional
```

## Supported Devices

- iPhone 6.7" (1290 x 2796)
- iPhone 6.5" (1284 x 2778)
- iPhone 5.5" (1242 x 2208)
- iPad Pro 12.9" (2048 x 2732)
- Mac (2880 x 1800)
- Apple Watch 45mm (396 x 484)
- Android Phone (1080 x 1920)
- Android Tablet (1200 x 1920)

## Color Palettes

- `ocean` - Blue to Cyan gradient
- `sunset` - Orange to Pink gradient
- `forest` - Green to Teal gradient
- `lavender` - Purple to Pink gradient
- `midnight` - Dark blue to Purple gradient
- `coral` - Coral to Orange gradient

## Requirements

- Node.js 18+
- Xcode Command Line Tools (for simulator capture)
- MUSE Preview Maker app (macOS) - for image generation

## Related

- [MUSE Preview Maker](https://github.com/MUSE-CODE-SPACE/muse-preview-maker) - macOS app for creating App Store preview images

## License

MIT
