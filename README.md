# MUSE App Preview MCP

[![npm version](https://badge.fury.io/js/muse-app-preview-mcp.svg)](https://www.npmjs.com/package/muse-app-preview-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP (Model Context Protocol) server for managing App Store preview screenshots. Collect screenshots with titles during app development, then batch generate beautiful preview images.

## Features

| Tool | Description |
|------|-------------|
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

## Usage

### 1. Add Preview Sets

While developing your app, capture screenshots and save them as preview sets:

```
add_preview:
  screenshotPath: "/path/to/screenshot.png"
  title: "Amazing Feature"
  subtitle: "Discover new possibilities"
  deviceType: "iphone_6_7"  # optional
  paletteId: "ocean"        # optional
```

### 2. List Saved Previews

```
list_previews
```

### 3. Generate All Previews

When ready, generate all App Store preview images at once:

```
generate_previews:
  outputDirectory: "/path/to/output"  # optional
  exportAllSizes: true                 # optional
```

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  During App Development with Claude Code                    │
│                                                             │
│  1. Capture screenshot of Feature A                         │
│     → add_preview with title "Feature A"                    │
│                                                             │
│  2. Capture screenshot of Feature B                         │
│     → add_preview with title "Feature B"                    │
│                                                             │
│  3. Capture screenshot of Feature C                         │
│     → add_preview with title "Feature C"                    │
│                                                             │
│  4. Ready to submit to App Store                            │
│     → generate_previews                                     │
│     → All preview images created!                           │
└─────────────────────────────────────────────────────────────┘
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
- MUSE Preview Maker app (macOS) - for image generation

## Related

- [MUSE Preview Maker](https://github.com/MUSE-CODE-SPACE/muse-preview-maker) - macOS app for creating App Store preview images

## License

MIT
