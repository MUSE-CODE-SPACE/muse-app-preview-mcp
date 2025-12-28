# MUSE App Preview MCP

MCP server for managing app store preview screenshots with MUSE Preview Maker.

## Features

- **add_preview** - Add screenshot + title + subtitle as a preview set
- **list_previews** - List all saved preview sets
- **remove_preview** - Remove a specific preview
- **update_preview** - Update an existing preview
- **clear_all** - Clear all previews
- **open_app** - Open MUSE Preview Maker app
- **generate_previews** - Generate all preview images
- **get_settings** / **update_settings** - Manage default settings

## Installation

```bash
# Using Claude Code
claude mcp add muse-app-preview-mcp npx muse-app-preview-mcp

# Or install globally
npm install -g muse-app-preview-mcp
```

## Usage

### Add Preview Sets

```
Use add_preview tool:
- screenshotPath: "/path/to/screenshot.png"
- title: "Amazing Feature"
- subtitle: "Discover new possibilities"
```

### Generate Previews

```
Use generate_previews tool to create all preview images.
The MUSE Preview Maker app will open and process all saved sets.
```

## Workflow

1. While developing an app, capture screenshots
2. Use `add_preview` to save each screenshot with title/subtitle
3. Repeat for all preview screens
4. Use `generate_previews` to create all App Store preview images

## Requirements

- Node.js 18+
- MUSE Preview Maker app (macOS/iOS)

## License

MIT
