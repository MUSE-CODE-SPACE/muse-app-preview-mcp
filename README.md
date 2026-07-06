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
  deviceId: "iphone_6.7"    # optional
  paletteId: "ocean"        # optional
```

### 3. Generate All Previews

```
generate_previews:
  outputDirectory: "/path/to/output"  # optional
  exportAllSizes: true                 # optional
```

## Supported Devices

Device ids accepted by `deviceId` (matching MUSE Preview Maker 1.1.1). The classic underscore ids (`iphone_6_7`, `ipad_12_9`, ...) are still accepted and translated automatically.

| Device | `deviceId` | Size |
|--------|-----------|------|
| iPhone 6.9" (17 Pro Max) | `iphone_6.9` | 1320 x 2868 |
| iPhone 6.7" (15 Pro Max) | `iphone_6.7` | 1290 x 2796 |
| iPhone Air 6.5" | `iphone_air_6.5` | 1260 x 2736 |
| iPhone 6.5" (14 Plus) | `iphone_6.5` | 1284 x 2778 |
| iPhone 6.3" (17 Pro) | `iphone_6.3` | 1206 x 2622 |
| iPhone 6.1" (16) | `iphone_6.1` | 1179 x 2556 |
| iPhone 5.5" (8 Plus) | `iphone_5.5` | 1242 x 2208 |
| iPad Pro 13" M4 | `ipad_13_m4` | 2064 x 2752 |
| iPad Pro 12.9" | `ipad_12.9` | 2048 x 2732 |
| iPad Air / Pro 11" | `ipad_11` | 1668 x 2388 |
| iPad 10.9" | `ipad_10.9` | 1640 x 2360 |
| Mac App Store | `mac_standard` | 1280 x 800 |
| Mac App Store (Retina) | `mac_retina` | 2880 x 1800 |
| Apple Watch Ultra 49mm | `watch_ultra_49mm` | 410 x 502 |
| Apple Watch 46mm (S10) | `watch_series10_46mm` | 416 x 496 |
| Apple Watch 45mm | `watch_45mm` | 396 x 484 |
| Apple Watch 42mm (S10) | `watch_series10_42mm` | 374 x 446 |
| Apple Watch 41mm (SE) | `watch_41mm` | 352 x 430 |
| Apple Vision Pro | `visionpro` | 3840 x 2160 |
| Apple TV | `appletv_4k` / `appletv_4k_uhd` | 1920 x 1080 / 3840 x 2160 |
| Android Phone | `android_phone` | 1080 x 1920 |
| Android Tablet | `android_tablet` | 1200 x 1920 |
| Instagram | `instagram_2_3` / `instagram_4_5` / `instagram_1_1` / `instagram_story` | 2:3 / 4:5 / 1:1 / story |

## Color Palettes

Palette ids accepted by `paletteId` (MUSE Preview Maker 1.1.1):

`ocean` · `azure` · `midnight` · `sunset` · `coral` · `peach` · `forest` · `mint` · `purple` · `lavender` · `galaxy` · `dark` · `charcoal` · `light` · `cream` · `neon` · `aurora`

## Requirements

- Node.js 18+
- Xcode Command Line Tools (for simulator capture)
- MUSE Preview Maker app 1.1.1+ (macOS) - for image generation (older versions work, but the full device table above requires 1.1+)

## Related

- MUSE Preview Maker - macOS app for creating App Store preview images (v1.1.1)

## License

MIT
