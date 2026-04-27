# Tilemap Editor

A browser-based tilemap editor with object placement, auto-tiling, and pixel-perfect collision detection. Built with React, Zustand, and the Canvas API.

## Features

- Tile painting: brush, eraser, fill, tint (solid color)
- Auto-tile rules — 9-tile, 13-tile, 4-edge, 4-corner, custom — that pick the right tile based on neighbors
- Object placement from animated spritesheets; animations loop on the canvas, or freeze on a single frame
- Pixel-perfect collision: hold `Ctrl` while placing or dragging objects to slide them up against terrain pixels
- Tile-center snapping: hold `Shift` to snap objects to grid centers
- Layers with visibility, lock, and collision flags
- Mass operations: `Shift+drag` to fill rectangles, `Shift+right-drag` to mass erase
- Zip importer — drop in a packaged asset bundle and tilesets/spritesheets load with their metadata
- Undo/redo, localStorage persistence, JSON/PNG export

## Getting Started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `B` / `E` / `F` | Brush / Eraser / Fill |
| `T` | Tint (color picker) |
| `O` | Place Object |
| `V` | Select / Move |
| `G` | Toggle grid |
| `WASD` | Move tile selection in tileset (when in a tile tool) |
| `Space` + drag | Pan canvas |
| `Shift` + drag | Mass fill rectangle |
| `Shift` + right-drag | Mass erase rectangle |
| `Ctrl/Cmd` + drag (V mode) | Pixel collision sliding |
| `Ctrl/Cmd` + click (Object mode) | Snap to nearest non-colliding spot |
| `Shift` (Object/V mode) | Snap to tile center |
| `Ctrl/Cmd+Z` / `Shift+Ctrl/Cmd+Z` | Undo / Redo |
| `Ctrl/Cmd+C` / `Ctrl/Cmd+V` / `Ctrl/Cmd+D` | Copy / Paste / Duplicate object |
| `Delete` / `Backspace` | Delete selected object |
| Arrow keys | Nudge selected object (1px, or 1 cell with Snap on) |

## Asset Bundles

Two Python scripts in `scripts/` help prepare assets:

- `pack_spritesheets.py` — packs a directory tree of frame PNGs into spritesheets, one animation per row, with sidecar JSON metadata describing each row
- `create_asset_zip.py` — bundles the export folder into a zip you can drop into the editor's **Import** button

The packer handles mixed cases: directories containing distinct sprites (different sizes or unrelated names) get split into separate rows, while same-sized numbered frames stay grouped as one looping animation.

## Project Structure

```
src/
  store/useStore.js              Zustand store + auto-tile resolution + history
  components/
    MapCanvas.jsx                Main canvas (rendering, mouse, keyboard, collision)
    TilesetPanel.jsx             Tileset import + tile selection
    SpritesheetPanel.jsx         Spritesheet import + animation/frame picker
    TileRuleEditor.jsx           Auto-tile rule creation/editing
    LayerPanel.jsx               Layer management
    ObjectPropertiesPanel.jsx    Selected object properties
    Toolbar.jsx                  Top toolbar, settings, import/export
    AssetPicker.jsx              Searchable dropdown for tilesets/spritesheets
scripts/
  pack_spritesheets.py           Frame directory → spritesheet PNG + JSON
  create_asset_zip.py            Export directory → zip
```
